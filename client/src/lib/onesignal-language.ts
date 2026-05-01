// Maps Glukky's app locale to the closest OneSignal-supported language tag.
// OneSignal's translation catalog has en and zh-Hant, but no yue —
// written Cantonese is closest to Traditional Chinese for email purposes.
export function mapAppLocaleToOneSignal(lang: string): "en" | "zh-Hant" {
  if (lang === "zh-Hant" || lang === "yue") return "zh-Hant";
  return "en";
}

// Sync the user's app language to OneSignal so emails and push are
// delivered in the right locale. Fire-and-forget: never blocks the caller.
//
// Fan-out matches the existing setExternalId pattern in App.tsx — push to
// OneSignalDeferred for the Web SDK v16 path, then probe the BN/Natively
// wrapper bridges. Each leg is wrapped in try/catch and logs with the
// [onesignal] prefix used elsewhere. Missing methods are a no-op.
//
// IMPORTANT: do NOT call this from App.tsx mount, the auth/profile query
// path, or anything on the cold-launch / cube-loading-screen window. The
// codebase convention (PostHog idle-defer at App.tsx:1357 and the
// onboardingComplete gate at App.tsx:668) keeps cold-launch boot free of
// OneSignal traffic. Call this only from explicit user actions deep in
// the app: onboarding completion and profile language switch.
export function syncOneSignalLanguage(appLang: string): void {
  const lang = mapAppLocaleToOneSignal(appLang);
  const w = window as any;

  // (a) OneSignal Web SDK v16 — queue via OneSignalDeferred so the call
  //     waits cleanly for SDK init.
  try {
    w.OneSignalDeferred = w.OneSignalDeferred || [];
    w.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        await OneSignal?.User?.setLanguage?.(lang);
        console.log(`[onesignal] setLanguage via OneSignalDeferred: ${lang}`);
      } catch (e: any) {
        console.warn("[onesignal] OneSignalDeferred.setLanguage error:", e?.message ?? e);
      }
    });
  } catch (e: any) {
    console.warn("[onesignal] OneSignalDeferred push error:", e?.message ?? e);
  }

  // (a2) Legacy OneSignal Web SDK shape — only fires if the older
  //      flat `OneSignal.setLanguage` is exposed and we're NOT in v16
  //      (v16 also defines `OneSignal.User.setLanguage`, which the
  //      OneSignalDeferred path above already covers — calling both
  //      would be a redundant write but harmless either way).
  try {
    const OS = w.OneSignal;
    if (OS && typeof OS.setLanguage === "function" && !OS?.User?.setLanguage) {
      try {
        const r = OS.setLanguage(lang);
        if (r && typeof r.then === "function") {
          r.catch((e: any) =>
            console.warn("[onesignal] legacy OneSignal.setLanguage rejected:", e?.message ?? e),
          );
        }
        console.log(`[onesignal] setLanguage via legacy OneSignal.setLanguage: ${lang}`);
      } catch (e: any) {
        console.warn("[onesignal] legacy OneSignal.setLanguage error:", e?.message ?? e);
      }
    }
  } catch (e: any) {
    console.warn("[onesignal] legacy OneSignal probe error:", e?.message ?? e);
  }

  // (b) BN/Natively wrapper — NativelyNotifications bridge.
  try {
    if (w.NativelyNotifications) {
      const notif = new w.NativelyNotifications();
      if (typeof notif.setLanguage === "function") {
        try {
          notif.setLanguage({ language: lang });
          console.log(`[onesignal] setLanguage via NativelyNotifications: ${lang}`);
        } catch (e: any) {
          console.warn("[onesignal] NativelyNotifications.setLanguage error:", e?.message ?? e);
        }
      } else {
        console.log("[onesignal] NativelyNotifications.setLanguage: method not present");
      }
    }
  } catch (e: any) {
    console.warn("[onesignal] NativelyNotifications init error:", e?.message ?? e);
  }

  // (c) BN/Natively wrapper — NativelyPush bridge (fallback shape).
  try {
    if (w.NativelyPush) {
      const push = new w.NativelyPush();
      if (typeof push.setLanguage === "function") {
        try {
          push.setLanguage({ language: lang });
          console.log(`[onesignal] setLanguage via NativelyPush: ${lang}`);
        } catch (e: any) {
          console.warn("[onesignal] NativelyPush.setLanguage error:", e?.message ?? e);
        }
      } else {
        console.log("[onesignal] NativelyPush.setLanguage: method not present");
      }
    }
  } catch (e: any) {
    console.warn("[onesignal] NativelyPush init error:", e?.message ?? e);
  }
}
