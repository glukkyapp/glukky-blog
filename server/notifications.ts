import * as fs from "fs";
import * as path from "path";
import { db } from "./db";
import { userProfiles, weeklyPlans, weeklyPlanDays, dailyLogs } from "@shared/schema";
import { eq, and, isNotNull, sql, lte, desc } from "drizzle-orm";
import { sendPushNotification } from "./onesignal";
import { log } from "./index";

const DEDUP_FILE = path.join(process.cwd(), ".notification-scheduled-date");
const SCHEDULE_HOUR_UTC = 13;

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
  return `${String(hour).padStart(2, "0")}:00`;
}

async function getRegisteredUsers() {
  return db.select({
    userId: userProfiles.userId,
    onesignalPlayerId: userProfiles.onesignalPlayerId,
  })
    .from(userProfiles)
    .where(and(
      isNotNull(userProfiles.onesignalPlayerId),
      eq(userProfiles.onboardingComplete, true),
    ));
}

async function scheduleLateDinnerReminder(): Promise<boolean> {
  const now = new Date();
  const todayDow = (now.getDay() + 6) % 7;

  const usersWithLateDinner = await db
    .select({
      userId: userProfiles.userId,
      onesignalPlayerId: userProfiles.onesignalPlayerId,
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

  const playerIds = usersWithLateDinner
    .map(u => u.onesignalPlayerId)
    .filter((id): id is string => id !== null);

  if (playerIds.length === 0) {
    log("Late dinner reminder: no users with late dinner today", "notifications");
    return true;
  }

  log(`Late dinner reminder: scheduling for ${playerIds.length} users at 2 PM local time`, "notifications");
  return sendPushNotification({
    title: "Glukky",
    subtitle: "Dinner reminder",
    message: "Dinner's planned late today — any chance you could move it to before 9 pm? 🍽️",
    deepLink: "/",
    playerIds,
    delivery_time_of_day: formatTimeOfDay(14),
    delayed_option: "timezone",
  });
}

async function scheduleReengagementReminder(): Promise<boolean> {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const threeDaysAgoStr = threeDaysAgo.toISOString().split("T")[0];

  const registeredUsers = await getRegisteredUsers();

  const eligiblePlayerIds: string[] = [];

  for (const user of registeredUsers) {
    if (!user.onesignalPlayerId) continue;

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
      eligiblePlayerIds.push(user.onesignalPlayerId);
      await db.update(userProfiles)
        .set({ lastReengagementNotification: new Date() })
        .where(eq(userProfiles.userId, user.userId));
    }
  }

  if (eligiblePlayerIds.length === 0) {
    log("Re-engagement: no inactive users to notify", "notifications");
    return true;
  }

  log(`Re-engagement: scheduling for ${eligiblePlayerIds.length} users at 6 PM local time`, "notifications");
  return sendPushNotification({
    title: "Glukky",
    subtitle: "We miss you!",
    message: "Your plan is waiting — even a small step counts.",
    deepLink: "/",
    playerIds: eligiblePlayerIds,
    delivery_time_of_day: formatTimeOfDay(18),
    delayed_option: "timezone",
  });
}

async function scheduleSundayPlanningReminder(): Promise<boolean> {
  const users = await getRegisteredUsers();
  const playerIds = users
    .map(u => u.onesignalPlayerId)
    .filter((id): id is string => id !== null);

  if (playerIds.length === 0) {
    log("Sunday planning reminder: no registered users", "notifications");
    return true;
  }

  log(`Sunday planning reminder: scheduling for ${playerIds.length} users at 10 PM local time`, "notifications");
  return sendPushNotification({
    title: "Glukky",
    subtitle: "Weekly review",
    message: "Your weekly review is ready! Check your progress and plan next week.",
    deepLink: "/plan",
    playerIds,
    delivery_time_of_day: formatTimeOfDay(22),
    delayed_option: "timezone",
  });
}

async function scheduleDailyCheckInReminder(): Promise<boolean> {
  const users = await getRegisteredUsers();
  const playerIds = users
    .map(u => u.onesignalPlayerId)
    .filter((id): id is string => id !== null);

  if (playerIds.length === 0) {
    log("Daily check-in reminder: no registered users", "notifications");
    return true;
  }

  log(`Daily check-in reminder: scheduling for ${playerIds.length} users at 10 PM local time`, "notifications");
  return sendPushNotification({
    title: "Glukky",
    subtitle: "Daily check-in",
    message: "Your daily check-in is open — tap to log your day!",
    deepLink: "/",
    playerIds,
    delivery_time_of_day: formatTimeOfDay(22),
    delayed_option: "timezone",
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
