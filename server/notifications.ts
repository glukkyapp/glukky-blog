import { db } from "./db";
import { userProfiles, weeklyPlans, weeklyPlanDays, dailyLogs } from "@shared/schema";
import { eq, and, isNotNull, sql, lte, desc } from "drizzle-orm";
import { sendPushNotification } from "./onesignal";
import { log } from "./index";

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

async function sendLateDinnerReminder() {
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
    return;
  }

  log(`Late dinner reminder: sending to ${playerIds.length} users`, "notifications");
  await sendPushNotification({
    title: "Glukky",
    subtitle: "Dinner reminder",
    message: "Dinner's planned late today — any chance you could move it to before 9 pm? 🍽️",
    deepLink: "/",
    playerIds,
  });
}

async function sendSundayPlanningReminder() {
  const users = await getRegisteredUsers();
  const playerIds = users
    .map(u => u.onesignalPlayerId)
    .filter((id): id is string => id !== null);

  if (playerIds.length === 0) {
    log("Sunday planning reminder: no registered users", "notifications");
    return;
  }

  log(`Sunday planning reminder: sending to ${playerIds.length} users`, "notifications");
  await sendPushNotification({
    title: "Glukky",
    subtitle: "Weekly review",
    message: "Your weekly review is ready! Check your progress and plan next week.",
    deepLink: "/plan",
    playerIds,
  });
}

async function sendReengagementReminder() {
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
    return;
  }

  log(`Re-engagement: sending to ${eligiblePlayerIds.length} users`, "notifications");
  await sendPushNotification({
    title: "Glukky",
    subtitle: "We miss you!",
    message: "Your plan is waiting — even a small step counts.",
    deepLink: "/",
    playerIds: eligiblePlayerIds,
  });
}

async function sendDailyCheckInReminder() {
  const users = await getRegisteredUsers();
  const playerIds = users
    .map(u => u.onesignalPlayerId)
    .filter((id): id is string => id !== null);

  if (playerIds.length === 0) {
    log("Daily check-in reminder: no registered users", "notifications");
    return;
  }

  log(`Daily check-in reminder: sending to ${playerIds.length} users`, "notifications");
  await sendPushNotification({
    title: "Glukky",
    subtitle: "Daily check-in",
    message: "Your daily check-in is open — tap to log your day!",
    deepLink: "/",
    playerIds,
  });
}

let lastRunHour = -1;
let lastRunDate = "";

export function startNotificationScheduler() {
  log("Notification scheduler started (checking every 30 minutes)", "notifications");

  const check = async () => {
    const now = new Date();
    const hour = now.getHours();
    const dateStr = now.toISOString().split("T")[0];
    const dayOfWeek = now.getDay();
    const runKey = `${dateStr}-${hour}`;

    if (runKey === `${lastRunDate}-${lastRunHour}`) return;

    try {
      if (hour === 14) {
        lastRunHour = hour;
        lastRunDate = dateStr;
        log("Running 2 PM check: late dinner reminder", "notifications");
        await sendLateDinnerReminder();
      }

      if (hour === 18) {
        lastRunHour = hour;
        lastRunDate = dateStr;
        log("Running 6 PM check: re-engagement", "notifications");
        await sendReengagementReminder();
      }

      if (hour === 22 && dayOfWeek === 0) {
        lastRunHour = hour;
        lastRunDate = dateStr;
        log("Running 10 PM Sunday check: planning reminder", "notifications");
        await sendSundayPlanningReminder();
      }

      if (hour === 22 && dayOfWeek !== 0) {
        lastRunHour = hour;
        lastRunDate = dateStr;
        log("Running 10 PM daily check-in reminder (non-Sunday)", "notifications");
        await sendDailyCheckInReminder();
      }
    } catch (error: any) {
      log(`Notification scheduler error: ${error.message}`, "notifications");
    }
  };

  check();
  setInterval(check, 30 * 60 * 1000);
}
