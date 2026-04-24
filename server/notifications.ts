import * as fs from "fs";
import * as path from "path";
import { db } from "./db";
import { userProfiles, weeklyPlans, weeklyPlanDays, dailyLogs } from "@shared/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { sendPushNotification } from "./onesignal";
import { authStorage } from "./replit_integrations/auth/storage";
import { log } from "./index";

const DEDUP_FILE = path.join(process.cwd(), ".notification-scheduled-date");

// Run the scheduling pass at the start of the UTC day so every
// timezone still has all of today's local trigger times in the
// future. Without this, deployments that wake later than the
// configured trigger hour silently roll the send to "tomorrow"
// for all users in already-passed timezones (this is exactly the
// failure that affected the 2026-04-24 6 PM HKT and 10 PM HKT
// re-engagement / daily-checkin sends — the deployment did not
// wake until 14:16 UTC = 22:16 HKT).
//
// **Awake-at-the-hour mechanism:** moving SCHEDULE_HOUR_UTC alone
// is not enough on autoscale — the deployment is also asleep at
// 00:00 UTC. The chosen mechanism (smallest-change for the
// current `deploymentTarget = "autoscale"` setup) is an external
// uptime ping against `GET /api/uptime/ping`. Configure
// UptimeRobot / cron-job.org to hit that endpoint every 5 minutes
// between 23:55 UTC and 00:10 UTC; the inbound request wakes the
// instance, the boot calls scheduleAllNotifications() once, and
// the in-process setInterval keeps the pass running while the
// instance stays up. If/when this deployment is upgraded to a
// reserved VM, the uptime ping becomes optional.
const SCHEDULE_HOUR_UTC = 0;

type NotificationType = "late_dinner" | "reengagement" | "evening";

function getTodayDateStr(): string {
  return new Date().toISOString().split("T")[0];
}

function getScheduledTypes(dateStr: string): Set<NotificationType> {
  try {
    const content = fs.readFileSync(DEDUP_FILE, "utf-8").trim();
    const data = JSON.parse(content);
    if (data.date === dateStr && Array.isArray(data.types)) {
      return new Set(data.types as NotificationType[]);
    }
    return new Set();
  } catch {
    return new Set();
  }
}

function markTypeScheduled(dateStr: string, type: NotificationType): void {
  const existing = getScheduledTypes(dateStr);
  existing.add(type);
  fs.writeFileSync(DEDUP_FILE, JSON.stringify({ date: dateStr, types: Array.from(existing) }), "utf-8");
}

function formatTimeOfDay(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:00${period}`;
}

// DST-correct local hour/minute lookup. We do NOT use
// `new Date(date.toLocaleString("en-US", {timeZone}))` — that
// idiom misparses around DST transitions and on locales whose
// default formatter isn't en-US. `formatToParts` is the
// supported way to read calendar fields in another timezone.
function getLocalHourMinute(at: Date, timeZone: string): { hour: number; minute: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(at);
    let hour: number | null = null;
    let minute: number | null = null;
    for (const p of parts) {
      if (p.type === "hour") hour = parseInt(p.value, 10);
      else if (p.type === "minute") minute = parseInt(p.value, 10);
    }
    if (hour === null || minute === null || Number.isNaN(hour) || Number.isNaN(minute)) return null;
    // hour-cycle 'h23' returns 24 for midnight in some impls; normalize.
    if (hour === 24) hour = 0;
    return { hour, minute };
  } catch {
    return null;
  }
}

interface RegisteredUser {
  userId: string;
  onesignalPlayerId: string;
  deviceTimezone: string | null;
}

async function getRegisteredUsers(): Promise<RegisteredUser[]> {
  const rows = await db.select({
    userId: userProfiles.userId,
    onesignalPlayerId: userProfiles.onesignalPlayerId,
    deviceTimezone: userProfiles.deviceTimezone,
  })
    .from(userProfiles)
    .where(and(
      isNotNull(userProfiles.onesignalPlayerId),
      eq(userProfiles.onboardingComplete, true),
    ));
  return rows
    .filter((r): r is RegisteredUser => r.onesignalPlayerId !== null)
    .map((r) => ({
      userId: r.userId,
      onesignalPlayerId: r.onesignalPlayerId,
      deviceTimezone: r.deviceTimezone ?? null,
    }));
}

async function lookupEmails(userIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  // authStorage.getUser is one-by-one, but the lists are small
  // (<= a few hundred) and this only runs once per scheduled
  // notification type. If this ever grows we can switch to a
  // bulk join against the auth users table.
  await Promise.all(
    userIds.map(async (uid) => {
      try {
        const u = await authStorage.getUser(uid);
        if (u?.email) out.set(uid, u.email);
      } catch {}
    }),
  );
  return out;
}

function summarizeEmails(emails: string[]): string {
  if (emails.length === 0) return "[]";
  if (emails.length <= 12) return `[${emails.join(", ")}]`;
  return `[${emails.slice(0, 12).join(", ")}, …+${emails.length - 12}]`;
}

interface SplitResult {
  futureUsers: RegisteredUser[];   // local trigger still upcoming today → schedule via timezone path
  passedUsers: RegisteredUser[];   // local trigger already past today → send immediately
  unknownTimezoneUserIds: string[];
}

// Split users into "today's local trigger time is still in the
// future" vs "already passed". UTC-fallback users are bucketed
// as "passed" per the task spec — we'd rather send them slightly
// off-time today than silently roll to tomorrow.
function splitUsersByLocalTrigger(
  users: RegisteredUser[],
  triggerHour: number,
  now: Date,
): SplitResult {
  const futureUsers: RegisteredUser[] = [];
  const passedUsers: RegisteredUser[] = [];
  const unknownTimezoneUserIds: string[] = [];
  for (const u of users) {
    const tz = u.deviceTimezone ?? null;
    if (!tz || tz === "UTC") {
      // Treat unknown / UTC-fallback as "may have passed".
      passedUsers.push(u);
      if (!tz) unknownTimezoneUserIds.push(u.userId);
      continue;
    }
    const local = getLocalHourMinute(now, tz);
    if (!local) {
      // Bad / unrecognized timezone string — treat as passed.
      passedUsers.push(u);
      unknownTimezoneUserIds.push(u.userId);
      continue;
    }
    // Strictly-greater: if we are exactly at the trigger hour:00,
    // OneSignal's timezone path would already be on the boundary
    // and could no-op for some users. Sending immediately is the
    // safer, on-time choice.
    if (local.hour < triggerHour) {
      futureUsers.push(u);
    } else {
      passedUsers.push(u);
    }
  }
  return { futureUsers, passedUsers, unknownTimezoneUserIds };
}

// Compute the "latest local trigger UTC instant" across the
// targeted future-group users. Used to schedule the post-trigger
// delivery report fetch. For users whose local time has not yet
// reached the trigger hour today, the next occurrence is today's
// trigger in their timezone; we approximate by walking through
// the targeted users and tracking the maximum UTC timestamp.
function maxUtcMillisForTodayLocalTrigger(
  users: RegisteredUser[],
  triggerHour: number,
  now: Date,
): number | null {
  let maxMillis: number | null = null;
  for (const u of users) {
    if (!u.deviceTimezone || u.deviceTimezone === "UTC") continue;
    const local = getLocalHourMinute(now, u.deviceTimezone);
    if (!local) continue;
    // Hours until today's local trigger fires in this user's tz.
    const hoursUntil = triggerHour - local.hour;
    if (hoursUntil <= 0) continue;
    // Approximate: trigger at top of triggerHour:00 local. Subtract
    // the current minute to land near the user's local triggerHour:00.
    const minutesUntil = hoursUntil * 60 - local.minute;
    const utcMs = now.getTime() + minutesUntil * 60_000;
    if (maxMillis === null || utcMs > maxMillis) maxMillis = utcMs;
  }
  return maxMillis;
}

// Send one logical notification to BOTH groups (future via
// timezone schedule, passed via immediate send). Returns true
// only if every sub-send succeeded; the caller uses that to
// decide whether to write the dedup mark.
async function sendSplit(opts: {
  type: NotificationType;
  label: string;
  triggerHour: number;
  users: RegisteredUser[];
  payload: { title: string; subtitle: string; message: string; deepLink: string };
}): Promise<boolean> {
  const now = new Date();
  const { futureUsers, passedUsers, unknownTimezoneUserIds } = splitUsersByLocalTrigger(
    opts.users,
    opts.triggerHour,
    now,
  );

  if (futureUsers.length === 0 && passedUsers.length === 0) {
    log(`${opts.label}: no targeted users`, "notifications");
    return true;
  }

  const allUserIds = [
    ...futureUsers.map((u) => u.userId),
    ...passedUsers.map((u) => u.userId),
  ];
  const emailMap = await lookupEmails(allUserIds);
  const futureEmails = futureUsers.map((u) => emailMap.get(u.userId) ?? u.userId);
  const passedEmails = passedUsers.map((u) => emailMap.get(u.userId) ?? u.userId);

  log(
    `${opts.label}: targeted ${allUserIds.length} users emails=${summarizeEmails([...futureEmails, ...passedEmails])} schedule=${formatTimeOfDay(opts.triggerHour)}/timezone unknown_tz=${unknownTimezoneUserIds.length}`,
    "notifications",
  );

  let allOk = true;

  // Compute "ms until 5 minutes after the latest user's local
  // trigger fires today" so the delivery-report fetch happens
  // after OneSignal has actually delivered the future-group
  // batch. We only schedule the post-trigger report when the
  // future-group batch is non-empty.
  const latestUtcMs = maxUtcMillisForTodayLocalTrigger(futureUsers, opts.triggerHour, now);
  let postTriggerDelayMs: number | undefined;
  if (latestUtcMs !== null) {
    const delay = latestUtcMs - Date.now() + 5 * 60_000;
    if (delay > 0 && delay < 24 * 60 * 60_000) postTriggerDelayMs = delay;
  }

  if (futureUsers.length > 0) {
    log(
      `${opts.label}: future-group n=${futureUsers.length} emails=${summarizeEmails(futureEmails)} → delivery_time_of_day ${formatTimeOfDay(opts.triggerHour)}/timezone post_trigger_report_in_ms=${postTriggerDelayMs ?? "n/a"}`,
      "notifications",
    );
    const ok = await sendPushNotification({
      ...opts.payload,
      playerIds: futureUsers.map((u) => u.onesignalPlayerId),
      delivery_time_of_day: formatTimeOfDay(opts.triggerHour),
      delayed_option: "timezone",
      postTriggerReportAfterMs: postTriggerDelayMs,
      postTriggerReportLabel: `${opts.label}/post-trigger`,
    });
    if (!ok) allOk = false;
  }

  if (passedUsers.length > 0) {
    log(
      `${opts.label}: passed-group n=${passedUsers.length} emails=${summarizeEmails(passedEmails)} → immediate (today's local trigger already past or tz unknown)`,
      "notifications",
    );
    const ok = await sendPushNotification({
      ...opts.payload,
      playerIds: passedUsers.map((u) => u.onesignalPlayerId),
    });
    if (!ok) allOk = false;
  }

  return allOk;
}

async function scheduleLateDinnerReminder(): Promise<boolean> {
  const now = new Date();
  const todayDow = (now.getDay() + 6) % 7;

  const usersWithLateDinner = await db
    .select({
      userId: userProfiles.userId,
      onesignalPlayerId: userProfiles.onesignalPlayerId,
      deviceTimezone: userProfiles.deviceTimezone,
    })
    .from(userProfiles)
    .innerJoin(weeklyPlans, eq(weeklyPlans.userId, userProfiles.userId))
    .innerJoin(weeklyPlanDays, eq(weeklyPlanDays.weeklyPlanId, weeklyPlans.id))
    .where(and(
      isNotNull(userProfiles.onesignalPlayerId),
      eq(userProfiles.onboardingComplete, true),
      eq(weeklyPlanDays.dayOfWeek, todayDow),
      eq(weeklyPlanDays.lateDinnerScheduled, true),
      eq(weeklyPlans.weekNumber, userProfiles.currentWeek),
    ));

  const users: RegisteredUser[] = usersWithLateDinner
    .filter((u) => u.onesignalPlayerId !== null)
    .map((u) => ({
      userId: u.userId,
      onesignalPlayerId: u.onesignalPlayerId as string,
      deviceTimezone: u.deviceTimezone ?? null,
    }));

  if (users.length === 0) {
    log("Late dinner reminder: no users with late dinner today", "notifications");
    return true;
  }

  return sendSplit({
    type: "late_dinner",
    label: "late_dinner",
    triggerHour: 14,
    users,
    payload: {
      title: "Glukky",
      subtitle: "Dinner reminder",
      message: "Dinner's planned late today — any chance you could move it to before 9 pm? 🍽️",
      deepLink: "/",
    },
  });
}

async function scheduleReengagementReminder(): Promise<boolean> {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const threeDaysAgoStr = threeDaysAgo.toISOString().split("T")[0];

  const registeredUsers = await getRegisteredUsers();

  const eligibleUsers: RegisteredUser[] = [];

  for (const user of registeredUsers) {
    const profile = await db.select({
      lastReengagementNotification: userProfiles.lastReengagementNotification,
    })
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.userId))
      .then(rows => rows[0]);

    if (profile?.lastReengagementNotification) {
      const cooldownEnd = new Date(profile.lastReengagementNotification);
      cooldownEnd.setDate(cooldownEnd.getDate() + 3);
      if (new Date() < cooldownEnd) continue;
    }

    const recentLogs = await db.select({ id: dailyLogs.id })
      .from(dailyLogs)
      .where(and(
        eq(dailyLogs.userId, user.userId),
        sql`${dailyLogs.date} >= ${threeDaysAgoStr}`,
      ))
      .limit(1);

    if (recentLogs.length === 0) {
      eligibleUsers.push(user);
      await db.update(userProfiles)
        .set({ lastReengagementNotification: new Date() })
        .where(eq(userProfiles.userId, user.userId));
    }
  }

  if (eligibleUsers.length === 0) {
    log("Re-engagement: no inactive users to notify", "notifications");
    return true;
  }

  return sendSplit({
    type: "reengagement",
    label: "reengagement",
    triggerHour: 18,
    users: eligibleUsers,
    payload: {
      title: "Glukky",
      subtitle: "We miss you!",
      message: "Your plan is waiting — even a small step counts.",
      deepLink: "/",
    },
  });
}

async function scheduleSundayPlanningReminder(): Promise<boolean> {
  const users = await getRegisteredUsers();
  if (users.length === 0) {
    log("Sunday planning reminder: no registered users", "notifications");
    return true;
  }
  return sendSplit({
    type: "evening",
    label: "sunday_planning",
    triggerHour: 22,
    users,
    payload: {
      title: "Glukky",
      subtitle: "Weekly review",
      message: "Your weekly review is ready! Check your progress and plan next week.",
      deepLink: "/plan",
    },
  });
}

async function scheduleDailyCheckInReminder(): Promise<boolean> {
  const users = await getRegisteredUsers();
  if (users.length === 0) {
    log("Daily check-in reminder: no registered users", "notifications");
    return true;
  }
  return sendSplit({
    type: "evening",
    label: "daily_check_in",
    triggerHour: 22,
    users,
    payload: {
      title: "Glukky",
      subtitle: "Daily check-in",
      message: "Your daily check-in is open — tap to log your day!",
      deepLink: "/",
    },
  });
}

async function scheduleAllNotifications() {
  const dateStr = getTodayDateStr();
  const now = new Date();
  const currentHourUtc = now.getUTCHours();

  if (currentHourUtc < SCHEDULE_HOUR_UTC) {
    log(`Waiting for ${SCHEDULE_HOUR_UTC}:00 UTC to schedule notifications (currently ${currentHourUtc}:00 UTC)`, "notifications");
    return;
  }

  const alreadyScheduled = getScheduledTypes(dateStr);
  const allTypes: NotificationType[] = ["late_dinner", "reengagement", "evening"];
  const pending = allTypes.filter(t => !alreadyScheduled.has(t));

  if (pending.length === 0) {
    log(`All notifications already scheduled for ${dateStr}, skipping`, "notifications");
    return;
  }

  log(`Scheduling notifications for ${dateStr} (pending: ${pending.join(", ")})`, "notifications");

  for (const type of pending) {
    try {
      // The dedup write happens AFTER every sub-send for this type
      // has completed. Previously we wrote dedup after the first
      // (and only) send call, which on a server restart between
      // the future-group send and the passed-group send could
      // cause the passed group to never be sent (or — under the
      // new split — the same group to fire twice).
      let success = false;
      switch (type) {
        case "late_dinner":
          success = await scheduleLateDinnerReminder();
          break;
        case "reengagement":
          success = await scheduleReengagementReminder();
          break;
        case "evening":
          if (now.getDay() === 0) {
            success = await scheduleSundayPlanningReminder();
          } else {
            success = await scheduleDailyCheckInReminder();
          }
          break;
      }
      if (success) {
        markTypeScheduled(dateStr, type);
      } else {
        log(`OneSignal returned failure for ${type}, will retry on next run`, "notifications");
      }
    } catch (error: any) {
      log(`Failed to schedule ${type} notification: ${error.message}`, "notifications");
    }
  }

  log(`Notification scheduling complete for ${dateStr}`, "notifications");
}

export function startNotificationScheduler() {
  log("Notification scheduler started (schedules via OneSignal timezone delivery)", "notifications");

  scheduleAllNotifications();

  setInterval(() => {
    scheduleAllNotifications();
  }, 60 * 60 * 1000);
}
