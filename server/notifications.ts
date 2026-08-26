import { db } from "./db";
import { userProfiles, mealSnaps, scheduledNotifications } from "@shared/schema";
import { eq, and, isNotNull, sql, desc, gt } from "drizzle-orm";
import { sendPushNotification, cancelOneSignalNotification } from "./onesignal";
import { storage } from "./storage";
import { authStorage } from "./replit_integrations/auth/storage";
import { log } from "./index";

// Forward window: every pre-scheduling pass queues every eligible
// (user, type) whose next local trigger falls within this many
// hours. 36h is the smallest window that covers today's 18:00 +
// tomorrow's 19:00 local triggers even when the only wakeup of
// the UTC day happens at 00:00 UTC (= 8 AM HKT).
const LOOKAHEAD_HOURS = 36;
const LOOKAHEAD_MS = LOOKAHEAD_HOURS * 60 * 60 * 1000;

// Hourly cadence keeps the dedup table fresh and gives every
// (user, type) ~24 attempts to enter the window before its
// trigger time. Boot pass + every-hour pass means the only way to
// miss a send is for the entire instance to be dead for an
// entire UTC day, which is exactly what the existing
// /api/uptime/ping safety net guards against.
const PASS_INTERVAL_MS = 60 * 60 * 1000;

type NotificationType =
  | "foodsnap_reminder" // 7 PM local — conditional: no dinner snap today
  | "hstix_reminder"    // event-triggered — 55 min after snap (not pre-scheduled)
  | "reengagement";     // 6 PM local — inactive ≥ 3 days, max once per 14 days

// hstix_reminder is excluded — event-triggered from the snap route.
const ALL_TYPES: NotificationType[] = [
  "foodsnap_reminder",
  "reengagement",
];

// Opaque brand that prevents runtime-computed strings from reaching
// notification headings or bodies at compile time.
// t() accepts a plain string literal at the call site; the cast is internal.
// Any template literal or variable expression produces a plain `string` which
// is NOT assignable to TemplateString, so the type gate holds at the
// NotificationLocale boundary without restricting what call sites write.
// MCHK Code §1.4.1 — no health values or PII in notification content.
declare const _brand: unique symbol;
type TemplateString = string & { readonly [_brand]: "TemplateString" };
function t(s: string): TemplateString { return s as unknown as TemplateString; }

interface NotificationLocale {
  title: TemplateString;
  subtitle: TemplateString;
  message: TemplateString;
}

interface NotificationContent {
  en: NotificationLocale;
  zhHant: NotificationLocale;
  deepLink: string;
}

export const CONTENTS: Record<NotificationType, NotificationContent> = {
  foodsnap_reminder: {
    en:     { title: t("Glukky"), subtitle: t(""), message: t("Time to snap your dinner!") },
    zhHant: { title: t("Glukky"), subtitle: t(""), message: t("記錄今晚晚餐的時間到了！") },
    deepLink: "/",
  },
  hstix_reminder: {
    en:     { title: t("Glukky"), subtitle: t(""), message: t("Ready to log your HStix reading?") },
    zhHant: { title: t("Glukky"), subtitle: t(""), message: t("準備好量度你的血糖了嗎？") },
    deepLink: "/hstix",
  },
  reengagement: {
    en:     { title: t("Glukky"), subtitle: t(""), message: t("We miss you — come back when you are ready.") },
    zhHant: { title: t("Glukky"), subtitle: t(""), message: t("我們想念你——準備好時再回來吧。") },
    deepLink: "/",
  },
};

// Dev-panel test notification templates — same TemplateString gate as CONTENTS.
// Dev sends are English-only so zhHant mirrors en; the type guard still applies.
export const DEV_TEST_TEMPLATES: Record<string, NotificationContent> = {
  reengagement: {
    en:     { title: t("Glukky"), subtitle: t("We miss you!"), message: t("Come back when you are ready.") },
    zhHant: { title: t("Glukky"), subtitle: t("We miss you!"), message: t("Come back when you are ready.") },
    deepLink: "/",
  },
};

const TRIGGER_HOUR_LOCAL: Partial<Record<NotificationType, number>> = {
  foodsnap_reminder: 19, // 7 PM
  reengagement:      18, // 6 PM
};

// Web/webview redirect URL sent as the OneSignal `url` field for each
// pre-scheduled type. Overrides deepLink for the tap destination while
// deepLink continues as the in-app navigator path (data.deepLink).
// hstix_reminder is event-triggered at the send site in routes.ts.
const REDIRECT_URL: Partial<Record<NotificationType, string>> = {
  foodsnap_reminder: "/snap",
};

interface ScheduledUser {
  userId: string;
  onesignalPlayerId: string | null;
  onesignalExternalId: string | null;
  deviceTimezone: string | null;
}

async function getRegisteredUsers(): Promise<ScheduledUser[]> {
  // Targets every onboarded user that has SOME way to receive a
  // push (alias OR player id). The new alias path is preferred
  // when both exist; user_profiles rows with neither are excluded
  // because there's nothing OneSignal can deliver to them.
  const rows = await db.select({
    userId: userProfiles.userId,
    onesignalPlayerId: userProfiles.onesignalPlayerId,
    onesignalExternalId: userProfiles.onesignalExternalId,
    deviceTimezone: userProfiles.deviceTimezone,
  })
    .from(userProfiles)
    .where(and(
      eq(userProfiles.onboardingComplete, true),
      sql`(${userProfiles.onesignalPlayerId} IS NOT NULL OR ${userProfiles.onesignalExternalId} IS NOT NULL)`,
    ));
  return rows.map((r) => ({
    userId: r.userId,
    onesignalPlayerId: r.onesignalPlayerId ?? null,
    onesignalExternalId: r.onesignalExternalId ?? null,
    deviceTimezone: r.deviceTimezone ?? null,
  }));
}

// DST-correct calendar-field lookup in another timezone. Returns
// the full set of fields (year/month/day/hour/minute/weekday)
// because the scheduler needs all of them to compute the next
// local trigger UTC instant.
interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  hour: number;  // 0-23
  minute: number;
  weekday: number; // 0=Sun..6=Sat
}

function getLocalParts(at: Date, timeZone: string): LocalParts | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "short",
    });
    const parts = fmt.formatToParts(at);
    let year: number | null = null;
    let month: number | null = null;
    let day: number | null = null;
    let hour: number | null = null;
    let minute: number | null = null;
    let weekdayStr: string | null = null;
    for (const p of parts) {
      if (p.type === "year") year = parseInt(p.value, 10);
      else if (p.type === "month") month = parseInt(p.value, 10);
      else if (p.type === "day") day = parseInt(p.value, 10);
      else if (p.type === "hour") hour = parseInt(p.value, 10);
      else if (p.type === "minute") minute = parseInt(p.value, 10);
      else if (p.type === "weekday") weekdayStr = p.value;
    }
    if (year === null || month === null || day === null || hour === null || minute === null) return null;
    if (Number.isNaN(year + month + day + hour + minute)) return null;
    if (hour === 24) hour = 0;
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const weekday = weekdayStr && weekdayStr in weekdayMap ? weekdayMap[weekdayStr] : 0;
    return { year, month, day, hour, minute, weekday };
  } catch {
    return null;
  }
}

// Convert the UTC offset of `timeZone` at moment `at` into ms.
// We compute it by rounding the difference between the wall clock
// in `timeZone` and the wall clock in UTC at the same instant.
function utcOffsetMs(at: Date, timeZone: string): number | null {
  const local = getLocalParts(at, timeZone);
  const utc = getLocalParts(at, "UTC");
  if (!local || !utc) return null;
  const localUtcEpoch = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const utcUtcEpoch = Date.UTC(utc.year, utc.month - 1, utc.day, utc.hour, utc.minute);
  return localUtcEpoch - utcUtcEpoch;
}

interface NextTrigger {
  // YYYY-MM-DD in the user's local tz, identifies "which day's
  // trigger" this is — used as the dedup key.
  localTriggerDate: string;
  // UTC instant when OneSignal should deliver. Always strictly
  // in the future.
  sendAtUtc: Date;
  // Local weekday (0=Sun..6=Sat) the trigger fires on.
  weekday: number;
}

// Build a candidate trigger for a specific (yy, mm, dd) firing at
// triggerHourLocal:00 in `timeZone`. Re-resolves the UTC offset
// AT the candidate instant (not at `now`) so DST jumps land on
// the correct UTC moment. `localTriggerDate`, `weekday` and
// `sendAtUtc` are by construction in lock-step — the dedup key
// and the per-type weekday gating cannot drift apart.
function buildLocalTrigger(
  now: Date,
  timeZone: string,
  triggerHourLocal: number,
  yy: number,
  mm: number,
  dd: number,
  weekday: number,
): NextTrigger | null {
  const wallAsUtcMs = Date.UTC(yy, mm - 1, dd, triggerHourLocal, 0, 0);
  const offsetGuess = utcOffsetMs(now, timeZone);
  if (offsetGuess === null) return null;
  let cand = new Date(wallAsUtcMs - offsetGuess);
  const offsetAtCand = utcOffsetMs(cand, timeZone);
  if (offsetAtCand !== null && offsetAtCand !== offsetGuess) {
    cand = new Date(wallAsUtcMs - offsetAtCand);
  }
  return {
    localTriggerDate: formatYmd(yy, mm, dd),
    sendAtUtc: cand,
    weekday,
  };
}

// Enumerate every occurrence of `triggerHourLocal:00` in
// `timeZone` whose UTC instant is strictly future and within
// `lookaheadMs` of `now`. Yielded candidates are sorted ascending
// by sendAtUtc and each carries a (date, weekday) consistent with
// its sendAtUtc — see `buildLocalTrigger`.
//
// Every occurrence in the lookahead window is considered so an
// ineligible candidate cannot prevent a later eligible one from
// being queued by this pass.
function* enumerateLocalTriggers(
  now: Date,
  timeZone: string,
  triggerHourLocal: number,
  lookaheadMs: number,
): Generator<NextTrigger> {
  const local = getLocalParts(now, timeZone);
  if (!local) return;
  // Hard cap so a tz misconfiguration cannot loop forever. The
  // 36 h lookahead never needs more than 2-3 days.
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const seed = new Date(Date.UTC(local.year, local.month - 1, local.day) + dayOffset * 24 * 60 * 60 * 1000);
    const yy = seed.getUTCFullYear();
    const mm = seed.getUTCMonth() + 1;
    const dd = seed.getUTCDate();
    const wd = (local.weekday + dayOffset) % 7;
    const c = buildLocalTrigger(now, timeZone, triggerHourLocal, yy, mm, dd, wd);
    if (!c) continue;
    const delta = c.sendAtUtc.getTime() - now.getTime();
    if (delta <= 0) continue;
    if (delta > lookaheadMs) return; // ascending → further days also out of window
    yield c;
  }
}

function formatYmd(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

interface EligibilityContext {
  user: ScheduledUser;
  type: NotificationType;
  next: NextTrigger;
  now: Date;
}

type EligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: string };

async function isEligible(ctx: EligibilityContext): Promise<EligibilityResult> {
  switch (ctx.type) {

    case "foodsnap_reminder": {
      // Only fire if the user has NOT snapped anything today.
      // meal_snaps.local_date is stored in the user's local timezone,
      // so a direct string match against localTriggerDate is correct.
      const snapped = await db.select({ id: mealSnaps.id })
        .from(mealSnaps)
        .where(and(
          eq(mealSnaps.userId, ctx.user.userId),
          eq(mealSnaps.localDate, ctx.next.localTriggerDate),
        ))
        .limit(1);
      if (snapped.length > 0) return { eligible: false, reason: "already_snapped_today" };
      return { eligible: true };
    }

    case "reengagement": {
      // Only fire if the user hasn't snapped any meal in the last 3 days.
      const threeDaysAgo = new Date(ctx.now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const [latestSnap] = await db
        .select({ snapTime: mealSnaps.snapTime })
        .from(mealSnaps)
        .where(eq(mealSnaps.userId, ctx.user.userId))
        .orderBy(desc(mealSnaps.snapTime))
        .limit(1);
      if (latestSnap && new Date(latestSnap.snapTime) > threeDaysAgo) {
        return { eligible: false, reason: "snapped_recently" };
      }
      // Only fire if last reengagement was >14 days ago (or never sent).
      const [profile] = await db
        .select({ lastReengagement: userProfiles.lastReengagementNotification })
        .from(userProfiles)
        .where(eq(userProfiles.userId, ctx.user.userId))
        .limit(1);
      if (profile?.lastReengagement) {
        const fourteenDaysAgo = new Date(ctx.now.getTime() - 14 * 24 * 60 * 60 * 1000);
        if (new Date(profile.lastReengagement) > fourteenDaysAgo) {
          return { eligible: false, reason: "reengagement_sent_recently" };
        }
      }
      return { eligible: true };
    }

    case "hstix_reminder":
      // Never reaches isEligible — excluded from ALL_TYPES.
      return { eligible: false, reason: "event_triggered_only" };

  }
}

// Send a single (user, type) pre-scheduled notification.
// Targets by external_id when present, falls back to player_id.
// Returns the OneSignal notification id on success (so the caller
// can persist it for later cancellation).
async function queueOneNotification(
  user: ScheduledUser,
  type: NotificationType,
  next: NextTrigger,
  emailForLog: string,
  opts?: { redirectUrl?: string },
): Promise<{ ok: boolean; notificationId: string | null; targetMode: "alias" | "player_id" | "none" }> {
  const content = CONTENTS[type];
  const sendAfter = next.sendAtUtc.toISOString();

  // Prefer alias path (Rule C: keep player-id fallback).
  const useAlias = !!user.onesignalExternalId;
  const targetMode: "alias" | "player_id" | "none" = useAlias
    ? "alias"
    : user.onesignalPlayerId
      ? "player_id"
      : "none";

  if (targetMode === "none") {
    log(
      `notif/skipped type=${type} user=${emailForLog} reason=no_targets`,
      "notifications",
    );
    return { ok: false, notificationId: null, targetMode };
  }

  const result = await sendPushNotification({
    title:    { en: content.en.title,    "zh-Hant": content.zhHant.title },
    subtitle: { en: content.en.subtitle, "zh-Hant": content.zhHant.subtitle },
    message:  { en: content.en.message,  "zh-Hant": content.zhHant.message },
    deepLink: content.deepLink,
    redirectUrl: opts?.redirectUrl,
    send_after: sendAfter,
    externalIds: useAlias ? [user.onesignalExternalId as string] : undefined,
    playerIds: useAlias ? undefined : [user.onesignalPlayerId as string],
  });

  log(
    `notif/queued type=${type} user=${emailForLog} external_id=${user.onesignalExternalId ?? "none"} player_id=${user.onesignalPlayerId ?? "none"} target_mode=${targetMode} send_after=${sendAfter} notification_id=${result.notificationId ?? "none"} ok=${result.success}`,
    "notifications",
  );

  return { ok: result.success, notificationId: result.notificationId, targetMode };
}

interface PassCounters {
  queued: number;
  alreadyScheduled: number;
  ineligible: number;
  outOfWindow: number;
  noTargets: number;
  errored: number;
  // Number of users skipped this pass because their
  // device_timezone hasn't been captured yet (or is the unsafe
  // "UTC" placeholder). Broken out from `errored` so the boot-time
  // / first-app-open population is visible in pass-complete logs.
  skippedNoTimezone: number;
}

async function lookupEmails(userIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
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

async function preScheduleAll(): Promise<void> {
  const now = new Date();
  const users = await getRegisteredUsers();
  if (users.length === 0) {
    log("notif/pass-complete window=36h queued=0 already_scheduled=0 ineligible=0 (no registered users)", "notifications");
    return;
  }

  const emails = await lookupEmails(users.map((u) => u.userId));
  const counters: PassCounters = {
    queued: 0,
    alreadyScheduled: 0,
    ineligible: 0,
    outOfWindow: 0,
    noTargets: 0,
    errored: 0,
    skippedNoTimezone: 0,
  };

  for (const user of users) {
    const emailForLog = emails.get(user.userId) ?? user.userId;

    // Hard skip: a user whose device_timezone hasn't been
    // captured yet (NULL) — or whose value is the unsafe "UTC"
    // placeholder — is excluded from EVERY type for this pass.
    // The bridge (`OneSignal.User.setLanguage` + tz capture) re-
    // pushes the real tz on next app open, so the next pass
    // picks them up correctly.
    //
    // Why treat literal "UTC" as missing: the cold-start path
    // briefly writes "UTC" before the bridge resolves the real
    // tz, and a real-UTC user (Iceland, parts of West Africa) is
    // rare enough that one extra hour of "no notification" is a
    // strictly better failure mode than firing a 22:00-UTC HK
    // user at 06:00 HK. Revisit if real-UTC users complain.
    const tz = user.deviceTimezone && user.deviceTimezone !== "UTC"
      ? user.deviceTimezone
      : null;
    if (!tz) {
      counters.skippedNoTimezone++;
      log(
        `notif/skipped user=${emailForLog} reason=no_timezone device_timezone=${user.deviceTimezone ?? "null"}`,
        "notifications",
      );
      continue;
    }

    for (const type of ALL_TYPES) {
      try {
        const triggerHour = TRIGGER_HOUR_LOCAL[type];
        if (triggerHour === undefined) continue;

        // Walk every (user × type) trigger occurrence inside the
        // lookahead window rather than only the next occurrence.
        const candidates: NextTrigger[] = [];
        for (const c of enumerateLocalTriggers(now, tz, triggerHour, LOOKAHEAD_MS)) {
          candidates.push(c);
        }
        if (candidates.length === 0) {
          // Either tz resolve failed or no occurrence falls in
          // the window. The former is loud; the latter normal
          // and silent.
          if (!getLocalParts(now, tz)) {
            counters.errored++;
            log(
              `notif/skipped type=${type} user=${emailForLog} reason=tz_resolve_failed tz=${tz}`,
              "notifications",
            );
          } else {
            counters.outOfWindow++;
          }
          continue;
        }

        for (const next of candidates) {
          // Fast-path dedup check (cheap read; the authoritative
          // race-safety check is the unique-index reservation
          // below).
          const existing = await storage.getScheduledNotification(
            user.userId,
            type,
            next.localTriggerDate,
          );
          if (existing) {
            counters.alreadyScheduled++;
            continue;
          }

          // Eligibility is evaluated per candidate, not against `now`.
          const elig = await isEligible({ user, type, next, now });
          if (!elig.eligible) {
            counters.ineligible++;
            continue;
          }

          // RESERVE-THEN-SEND-THEN-FINALIZE. We insert the dedup
          // row FIRST with NULL notification_id; the unique index
          // on (user_id, type, local_trigger_date) atomically
          // serialises concurrent passes — the loser sees
          // inserted=false and skips, so OneSignal never receives
          // duplicate sends for the same trigger. We then POST
          // and either UPDATE the row with the returned
          // notification id or DELETE it on failure so the next
          // hourly pass can retry. Net effect: the table stays
          // truthful AND duplicate sends are impossible.
          const reservation = await storage.recordScheduledNotification(
            user.userId,
            type,
            next.localTriggerDate,
            next.sendAtUtc,
            null,
          );
          if (!reservation.inserted) {
            counters.alreadyScheduled++;
            continue;
          }
          const reservedId = reservation.row?.id;
          if (reservedId === undefined) {
            // Should never happen: inserted=true implies
            // returning produced a row. Defensive log + skip.
            counters.errored++;
            log(`notif/reservation-missing-id type=${type} user=${emailForLog}`, "notifications");
            continue;
          }

          const r = await queueOneNotification(user, type, next, emailForLog, { redirectUrl: REDIRECT_URL[type] });
          if (r.targetMode === "none") {
            await storage.deleteScheduledNotificationById(reservedId);
            counters.noTargets++;
            // No targets is a per-user condition, not per-day —
            // skip remaining candidates for this (user, type).
            break;
          }
          if (!r.ok) {
            await storage.deleteScheduledNotificationById(reservedId);
            counters.errored++;
            continue;
          }

          await storage.setScheduledNotificationId(reservedId, r.notificationId);
          // After queuing a reengagement, stamp the profile so the
          // 14-day gate works correctly for subsequent passes.
          if (type === "reengagement") {
            try {
              await storage.updateProfile(user.userId, { lastReengagementNotification: new Date() });
            } catch (e: any) {
              log(`notif/reengagement-stamp-failed user=${emailForLog} ${e?.message ?? e}`, "notifications");
            }
          }
          counters.queued++;
        }
      } catch (e: any) {
        counters.errored++;
        log(
          `notif/error type=${type} user=${emailForLog} ${e?.message ?? e}`,
          "notifications",
        );
      }
    }
  }

  log(
    `notif/pass-complete window=${LOOKAHEAD_HOURS}h users=${users.length} queued=${counters.queued} already_scheduled=${counters.alreadyScheduled} ineligible=${counters.ineligible} out_of_window=${counters.outOfWindow} no_targets=${counters.noTargets} skipped_no_timezone=${counters.skippedNoTimezone} errored=${counters.errored}`,
    "notifications",
  );
}

// Parse a "YYYY-MM-DD" local-trigger date string into integer
// year/month/day. Returns null on malformed input so the caller
// can skip the row defensively.
function parseLocalTriggerDate(s: string): { yy: number; mm: number; dd: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const yy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  if (!Number.isFinite(yy + mm + dd)) return null;
  return { yy, mm, dd };
}

// Boot-time reconciliation (task #507).
//
// Why this exists: before the no-timezone skip rule landed, the
// pre-scheduler treated NULL/`"UTC"` device_timezone as literal
// UTC and queued sends accordingly. For users whose real tz was
// captured on a later app open, those rows now sit in OneSignal
// pointing at the WRONG wall-clock instant (e.g. an HK user's
// 22:00 daily check-in goes out at HK 06:00). The skip rule
// prevents new bad rows but cannot retroactively cancel the ones
// already queued.
//
// Strategy: on every boot, walk every future scheduled_notifications
// row. For users whose device_timezone is now real, recompute
// what `send_at_utc` SHOULD be — using exactly the same
// `buildLocalTrigger` the pre-scheduler uses — and only cancel
// rows whose stored `send_at_utc` differs. Equality check is
// strict (millisecond getTime equality on Date instances), so a
// row that was correct stays untouched and the boot reconcile
// becomes a no-op once the cohort is healthy.
//
// We deliberately do this on every boot rather than as a
// one-shot migration: it's also the right place to catch the
// other failure mode (orphan reservations with NULL
// notification_id from a crash between INSERT and POST), and
// once the mismatch check is in place a clean cohort costs only
// the SELECT.
//
// For rows whose user still has NULL/UTC tz, leave them alone:
// we can't tell if they're wrong yet, and the skip rule in the
// hourly pass already prevents adding new ones until tz arrives.
//
// Cancel-failure rule: if OneSignal returns non-2xx (or the
// request throws), we KEEP the DB row and log loudly. Deleting
// the row would orphan a live OneSignal notification that we no
// longer have a handle to cancel. The next boot will retry.
//
// DB-delete-failure-after-cancel rule: the OneSignal notification
// is already gone. If the DB delete also fails, the row's stale
// `onesignal_notification_id` AND the dedup unique index will
// block the next hourly pass from re-reserving this trigger date,
// silently losing the send. We retry the DELETE up to 3 times,
// and on persistent failure log `notif/reconcile-stuck-row` so
// an operator can drop the row by hand. In practice DELETE BY
// PRIMARY KEY essentially never fails outside of connection
// drops, so this path is rare but the loud log makes the rare
// case fixable.
//
// Pacing: 100 ms between OneSignal cancel calls to stay well
// below the documented 30 RPS rate limit even if a large backlog
// accumulates after a long bridge outage.
async function reconcileBadlyScheduledRows(): Promise<void> {
  const start = Date.now();
  const now = new Date();
  let rows;
  try {
    rows = await storage.listFutureScheduledForReconciliation(now);
  } catch (e: any) {
    log(`notif/reconcile-failed list error=${e?.message ?? e}`, "notifications");
    return;
  }

  let leftAloneNoTz = 0;
  let keptCorrect = 0;
  let cancelled = 0;
  let cancelFailed = 0;
  let stuckAfterCancel = 0;
  let deletedOrphan = 0;       // reserved-but-never-finalised (no notification id)
  let unparseableSkipped = 0;  // unknown type or malformed date — leave alone

  for (const row of rows) {
    const tz = row.deviceTimezone && row.deviceTimezone !== "UTC"
      ? row.deviceTimezone
      : null;
    if (!tz) {
      leftAloneNoTz++;
      continue;
    }

    if (!row.onesignalNotificationId) {
      // Reservation with no OneSignal id — either a previous pass
      // crashed between INSERT and POST, or POST failed and the
      // rollback didn't finish. Safe to drop; next hourly pass
      // will re-reserve and re-send.
      try {
        await storage.deleteScheduledNotificationById(row.id);
        deletedOrphan++;
        log(
          `notif/reconcile-deleted-orphan id=${row.id} user=${row.userId} type=${row.notificationType} local_date=${row.localTriggerDate}`,
          "notifications",
        );
      } catch (e: any) {
        log(
          `notif/reconcile-orphan-delete-failed id=${row.id} ${e?.message ?? e}`,
          "notifications",
        );
      }
      continue;
    }

    // Mismatch check: re-derive what the pre-scheduler WOULD
    // queue for this (user, type, local_date) given the user's
    // current tz, then compare millisecond-equal against the
    // stored sendAtUtc. Anything that already matches stays put.
    const triggerHour = TRIGGER_HOUR_LOCAL[row.notificationType as NotificationType];
    if (triggerHour === undefined) {
      // Unknown notification type — not something this scheduler
      // owns. Don't touch it.
      unparseableSkipped++;
      log(
        `notif/reconcile-unknown-type id=${row.id} type=${row.notificationType} (left alone)`,
        "notifications",
      );
      continue;
    }
    const parsed = parseLocalTriggerDate(row.localTriggerDate);
    if (!parsed) {
      unparseableSkipped++;
      log(
        `notif/reconcile-bad-date id=${row.id} local_date=${row.localTriggerDate} (left alone)`,
        "notifications",
      );
      continue;
    }
    // weekday is required by buildLocalTrigger but isn't read
    // when we only need sendAtUtc for the equality check; derive
    // it anyway from a UTC-noon anchor on that calendar date so
    // it's correct for the few cases where buildLocalTrigger
    // future-evolves to consume it.
    const anchor = new Date(Date.UTC(parsed.yy, parsed.mm - 1, parsed.dd, 12));
    const weekday = anchor.getUTCDay();
    const expected = buildLocalTrigger(now, tz, triggerHour, parsed.yy, parsed.mm, parsed.dd, weekday);
    if (!expected) {
      // tz resolve failed at this exact instant — extremely
      // unlikely, but treat it the same as "no tz": leave alone.
      leftAloneNoTz++;
      log(
        `notif/reconcile-tz-resolve-failed id=${row.id} tz=${tz} (left alone)`,
        "notifications",
      );
      continue;
    }
    if (expected.sendAtUtc.getTime() === row.sendAtUtc.getTime()) {
      // Already correct — leave the OneSignal notification and
      // the dedup row exactly as they are. This is the steady
      // state once the cohort is healthy: every boot's reconcile
      // is essentially a SELECT plus this no-op branch.
      keptCorrect++;
      continue;
    }

    const drift = expected.sendAtUtc.getTime() - row.sendAtUtc.getTime();
    log(
      `notif/reconcile-mismatch id=${row.id} user=${row.userId} type=${row.notificationType} local_date=${row.localTriggerDate} stored=${row.sendAtUtc.toISOString()} expected=${expected.sendAtUtc.toISOString()} drift_ms=${drift}`,
      "notifications",
    );

    const result = await cancelOneSignalNotification(row.onesignalNotificationId);
    if (!result.ok) {
      // KEEP the DB row. We do NOT know whether OneSignal will
      // still fire this notification, so deleting our record
      // would lose all trace of it. Loud log so the operator can
      // investigate manually if needed.
      cancelFailed++;
      log(
        `notif/cancel-failed-leaving-row id=${row.id} user=${row.userId} type=${row.notificationType} onesignal_id=${row.onesignalNotificationId} status=${result.status ?? "null"}`,
        "notifications",
      );
    } else {
      // Retry DB delete — see comment above the function.
      let deleted = false;
      let lastErr: any = null;
      for (let attempt = 0; attempt < 3 && !deleted; attempt++) {
        try {
          await storage.deleteScheduledNotificationById(row.id);
          deleted = true;
        } catch (e: any) {
          lastErr = e;
          if (attempt < 2) await new Promise((r) => setTimeout(r, 200));
        }
      }
      if (deleted) {
        cancelled++;
        log(
          `notif/reconcile-cancelled id=${row.id} user=${row.userId} type=${row.notificationType} local_date=${row.localTriggerDate} onesignal_id=${row.onesignalNotificationId}`,
          "notifications",
        );
      } else {
        stuckAfterCancel++;
        log(
          `notif/reconcile-stuck-row id=${row.id} user=${row.userId} type=${row.notificationType} after_onesignal_cancel manual_intervention_required ${lastErr?.message ?? lastErr}`,
          "notifications",
        );
      }
    }

    // Pacing: 100 ms between OneSignal calls.
    await new Promise((r) => setTimeout(r, 100));
  }

  log(
    `notif/reconcile-complete future_rows=${rows.length} kept_correct=${keptCorrect} cancelled=${cancelled} cancel_failed=${cancelFailed} stuck_after_cancel=${stuckAfterCancel} deleted_orphan=${deletedOrphan} left_no_tz=${leftAloneNoTz} unparseable=${unparseableSkipped} duration_ms=${Date.now() - start}`,
    "notifications",
  );
}

// Retired notification types — purge any rows created before the planner
// removal. Future OneSignal messages must be cancelled before their DB rows
// are deleted; past rows are already delivered and can be removed directly.
async function purgeRetiredTypes(): Promise<void> {
  const start = Date.now();
  const now = new Date();
  let rows: Array<{
    id: number;
    notificationType: string;
    sendAtUtc: Date;
    onesignalNotificationId: string | null;
  }>;

  try {
    rows = await db
      .select({
        id: scheduledNotifications.id,
        notificationType: scheduledNotifications.notificationType,
        sendAtUtc: scheduledNotifications.sendAtUtc,
        onesignalNotificationId: scheduledNotifications.onesignalNotificationId,
      })
      .from(scheduledNotifications)
      .where(
        sql`${scheduledNotifications.notificationType} IN ('daily_report','weekly_report','monthly_report','daily_checkin')`,
      );
  } catch (e: any) {
    log(`notif/purge-retired list-error=${e?.message ?? e}`, "notifications");
    return;
  }

  let cancelledFuture = 0;
  let cancelFailed = 0;
  let deletedPast = 0;
  let deletedFuture = 0;

  for (const row of rows) {
    const isFuture = row.sendAtUtc > now;
    if (isFuture && row.onesignalNotificationId) {
      const result = await cancelOneSignalNotification(row.onesignalNotificationId);
      if (!result.ok) {
        cancelFailed++;
        log(
          `notif/purge-cancel-failed id=${row.id} type=${row.notificationType} onesignal_id=${row.onesignalNotificationId}`,
          "notifications",
        );
        continue;
      }
      cancelledFuture++;
    }

    try {
      await storage.deleteScheduledNotificationById(row.id);
      if (isFuture) deletedFuture++;
      else deletedPast++;
    } catch (e: any) {
      log(`notif/purge-delete-failed id=${row.id} ${e?.message ?? e}`, "notifications");
    }
    if (isFuture) await new Promise((resolve) => setTimeout(resolve, 100));
  }

  log(
    `notif/purge-retired-complete rows=${rows.length} cancelled_future=${cancelledFuture} cancel_failed=${cancelFailed} deleted_past=${deletedPast} deleted_future=${deletedFuture} duration_ms=${Date.now() - start}`,
    "notifications",
  );
}

let passInFlight = false;

async function runPassGuarded(): Promise<void> {
  if (passInFlight) {
    log("notif/pass-skipped reason=in_flight", "notifications");
    return;
  }
  passInFlight = true;
  try {
    await preScheduleAll();
  } catch (e: any) {
    log(`notif/pass-failed ${e?.message ?? e}`, "notifications");
  } finally {
    passInFlight = false;
  }
}

export function startNotificationScheduler() {
  log(
    `Notification pre-scheduler started (lookahead=${LOOKAHEAD_HOURS}h, cadence=hourly, target=external_id with player_id fallback)`,
    "notifications",
  );

  // Boot sequence:
  // 1. purgeRetiredTypes — cancel + delete old planner notification rows.
  // 2. reconcileBadlyScheduledRows — cancel rows whose send_at_utc drifted
  //                                  after timezone was captured.
  // 3. runPassGuarded     — immediate first scheduling pass.
  void (async () => {
    try {
      await purgeRetiredTypes();
      await reconcileBadlyScheduledRows();
    } catch (e: any) {
      log(`notif/reconcile-failed-uncaught ${e?.message ?? e}`, "notifications");
    }
    await runPassGuarded();
  })();

  setInterval(() => {
    void runPassGuarded();
  }, PASS_INTERVAL_MS);
}
