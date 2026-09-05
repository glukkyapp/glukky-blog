import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ONESIGNAL_ACTIVE_USER_KEY,
  ONESIGNAL_PENDING_USER_KEY,
  associateOneSignalIdentity,
  endOneSignalSession,
  prepareOneSignalIdentityForUser,
  releaseOneSignalIdentity,
  type OneSignalIdentityRuntime,
} from "../client/src/lib/onesignal-identity.ts";

class MemoryStorage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }
}

function runtime(
  storage: MemoryStorage,
  globals: any,
  timeoutMs = 50,
  sessionStorage?: MemoryStorage,
): OneSignalIdentityRuntime {
  return { storage, globals, timeoutMs, pollIntervalMs: 1, sessionStorage };
}

{
  const events: string[] = [];
  const storage = new MemoryStorage();
  let nativeExternalId: string | null = null;

  class Notifications {
    removeExternalId(callback: (value: unknown) => void) {
      events.push("release-a-start");
      setTimeout(() => {
        nativeExternalId = null;
        events.push("release-a-confirmed");
        callback({ success: true });
      }, 5);
    }
  }

  const sharedRuntime = runtime(storage, { NativelyNotifications: Notifications });
  const associatedA = await associateOneSignalIdentity(
    "account-a",
    async () => {
      nativeExternalId = "account-a";
      events.push("associate-a");
      return true;
    },
    sharedRuntime,
  );
  assert.equal(associatedA, true);

  let serverSessionEnded = false;
  const released = await endOneSignalSession(
    "manual_logout",
    async () => {
      serverSessionEnded = true;
      events.push("server-logout-a");
    },
    sharedRuntime,
  );
  assert.equal(released.ok, true);
  assert.equal(serverSessionEnded, true);

  const associated = await associateOneSignalIdentity(
    "account-b",
    async () => {
      nativeExternalId = "account-b";
      events.push("associate-b");
      return true;
    },
    sharedRuntime,
  );

  assert.equal(associated, true);
  assert.deepEqual(events, [
    "associate-a",
    "release-a-start",
    "release-a-confirmed",
    "server-logout-a",
    "associate-b",
  ]);
  assert.equal(nativeExternalId, "account-b");
  assert.equal(storage.getItem(ONESIGNAL_ACTIVE_USER_KEY), "account-b");
  assert.equal(storage.getItem("glukky_onesignal_pid_account-a"), null);
  assert.equal(storage.getItem("glukky_onesignal_external_id_account-a"), null);
}

{
  const events: string[] = [];
  const storage = new MemoryStorage();
  // Upgrade path: the old build wrote per-user caches but did not have
  // ONESIGNAL_ACTIVE_USER_KEY. The first reconciliation must still unlink.
  storage.setItem("glukky_onesignal_external_id_account-a", "account-a");

  class Notifications {
    removeExternalId(callback: () => void) {
      events.push("legacy-release");
      callback();
    }
  }

  const associated = await associateOneSignalIdentity(
    "account-b",
    async () => {
      events.push("associate-b");
      return true;
    },
    runtime(storage, { NativelyNotifications: Notifications }),
  );

  assert.equal(associated, true);
  assert.deepEqual(events, ["legacy-release", "associate-b"]);
}

{
  const storage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  let nativeExternalId: string | null = "account-a";
  storage.setItem(ONESIGNAL_ACTIVE_USER_KEY, "account-a");

  class Notifications {
    removeExternalId(callback: () => void) {
      setTimeout(() => {
        nativeExternalId = null;
        callback();
      }, 15);
    }
  }

  const sharedRuntime = runtime(storage, { NativelyNotifications: Notifications }, 10, sessionStorage);
  const released = await releaseOneSignalIdentity("manual_logout", sharedRuntime);
  assert.equal(released.ok, false);

  const associatedB = await associateOneSignalIdentity(
    "account-b",
    async () => {
      nativeExternalId = "account-b";
      return true;
    },
    sharedRuntime,
  );
  assert.equal(associatedB, false, "a timed-out remove must poison later commands in this WebView");
  assert.equal(nativeExternalId, null);

  const sameWebViewReload = runtime(
    storage,
    { NativelyNotifications: Notifications },
    10,
    sessionStorage,
  );
  assert.equal(
    await associateOneSignalIdentity("account-b", async () => true, sameWebViewReload),
    false,
    "session storage must preserve the poison across a page reload",
  );

  class RestartedNotifications {
    removeExternalId(callback: () => void) {
      nativeExternalId = null;
      callback();
    }
  }
  const afterFullAppRestart = runtime(
    storage,
    { NativelyNotifications: RestartedNotifications },
    10,
    new MemoryStorage(),
  );
  assert.equal(await prepareOneSignalIdentityForUser("account-b", afterFullAppRestart), true);
  assert.equal(
    await associateOneSignalIdentity("account-b", async () => {
      nativeExternalId = "account-b";
      return true;
    }, afterFullAppRestart),
    true,
  );
  assert.equal(nativeExternalId, "account-b");
}

{
  const storage = new MemoryStorage();
  let nativeExternalId: string | null = "account-a";
  let removeCalls = 0;
  class Notifications {
    removeExternalId(callback: () => void) {
      removeCalls += 1;
      nativeExternalId = null;
      callback();
    }
  }

  const released = await releaseOneSignalIdentity(
    "manual_logout_without_local_cache",
    runtime(storage, { NativelyNotifications: Notifications }),
  );
  assert.equal(released.ok, true);
  assert.equal(removeCalls, 1, "session end must invoke native removal even with empty localStorage");
  assert.equal(nativeExternalId, null);
}

{
  const storage = new MemoryStorage();
  storage.setItem(ONESIGNAL_ACTIVE_USER_KEY, "account-a");
  let removeAttempts = 0;
  class Notifications {
    removeExternalId(callback: () => void) {
      removeAttempts += 1;
      if (removeAttempts === 1) return;
      callback();
    }
  }
  const sharedRuntime = runtime(storage, { NativelyNotifications: Notifications }, 10);
  let registerRequests = 0;
  const runRegistration = async () => {
    const ready = await prepareOneSignalIdentityForUser("account-b", sharedRuntime);
    if (!ready) return;
    registerRequests += 1;
  };

  await runRegistration();
  assert.equal(registerRequests, 0, "B player registration must not run after A removal times out");
  await runRegistration();
  assert.equal(registerRequests, 1, "B player registration may run after compensating removal confirms");
}

{
  const storage = new MemoryStorage();
  storage.setItem(ONESIGNAL_ACTIVE_USER_KEY, "account-a");
  let associated = false;

  class Notifications {
    removeExternalId(_callback: () => void) {
      // A missing callback confirmation is a timeout, not success.
    }
  }

  const result = await associateOneSignalIdentity(
    "account-b",
    async () => {
      associated = true;
      return true;
    },
    runtime(storage, { NativelyNotifications: Notifications }, 10),
  );

  assert.equal(result, false);
  assert.equal(associated, false, "new identity must not associate before prior release confirms");
  assert.equal(storage.getItem(ONESIGNAL_ACTIVE_USER_KEY), "account-a");
  assert.equal(storage.getItem(ONESIGNAL_PENDING_USER_KEY), null);
}

{
  const storage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  let nativeExternalId: string | null = null;
  const globals = {};
  const poisonedRuntime = runtime(storage, globals, 10, sessionStorage);

  const associatedA = await associateOneSignalIdentity(
    "account-a",
    async () => {
      setTimeout(() => {
        nativeExternalId = "account-a";
      }, 15);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return false;
    },
    poisonedRuntime,
  );
  assert.equal(associatedA, false);
  assert.equal(storage.getItem(ONESIGNAL_PENDING_USER_KEY), "account-a");

  let removeWasIssued = false;
  class Notifications {
    removeExternalId(callback: () => void) {
      removeWasIssued = true;
      // Native identity operations are queued in invocation order: this
      // compensating remove completes after the earlier delayed set.
      setTimeout(() => {
        nativeExternalId = null;
        callback();
      }, 8);
    }
  }
  globals.NativelyNotifications = Notifications;
  assert.equal((await releaseOneSignalIdentity("manual_logout", poisonedRuntime)).ok, true);
  assert.equal(removeWasIssued, true, "logout must enqueue a compensating remove after a timed-out set");
  assert.equal(nativeExternalId, null);
  assert.equal(
    await associateOneSignalIdentity("account-b", async () => true, poisonedRuntime),
    true,
  );
}

{
  const storage = new MemoryStorage();
  storage.setItem(ONESIGNAL_ACTIVE_USER_KEY, "account-a");
  class Notifications {
    removeExternalId(callback: () => void) {
      callback();
    }
  }
  const released = await releaseOneSignalIdentity(
    "auth_401",
    runtime(storage, { NativelyNotifications: Notifications }),
  );
  assert.equal(released.ok, true);
  assert.equal(storage.getItem(ONESIGNAL_ACTIVE_USER_KEY), null);
}

const appSource = fs.readFileSync("client/src/App.tsx", "utf8");
const authSource = fs.readFileSync("client/src/hooks/use-auth.ts", "utf8");
const landingSource = fs.readFileSync("client/src/pages/landing.tsx", "utf8");
const profileSource = fs.readFileSync("client/src/pages/profile.tsx", "utf8");

assert.match(appSource, /await associateOneSignalIdentity\(userId, trySetExternalIdOnBridge\)/);
assert.match(
  appSource,
  /const identityReady = await prepareOneSignalIdentityForUser\(userId\);\s*if \(cancelled\) return;\s*if \(!identityReady\) \{[\s\S]*?return;[\s\S]*?window\.addEventListener\("message", onMessage\);[\s\S]*?await associateOneSignalIdentity\(userId, trySetExternalIdOnBridge\);\s*if \(cancelled\) return;\s*[\s\S]*?for \(let attempt = 0; attempt < 15; attempt\+\+\)/,
);
assert.ok(
  appSource.indexOf('window.addEventListener("message", onMessage)') >
    appSource.indexOf("if (!identityReady)"),
  "bridge-message registration listener must only activate after prior identity release succeeds",
);
assert.match(authSource, /if \(response\.status === 401\) \{\s*await releaseOneSignalIdentity\("auth_401"\)/);
assert.match(authSource, /await endOneSignalSession\("logout_mutation"/);
assert.match(profileSource, /await endOneSignalSession\("manual_logout"[\s\S]*?fetch\("\/api\/auth\/logout"/);
assert.match(profileSource, /await releaseOneSignalIdentity\("immediate_account_deletion"\)[\s\S]*?\/api\/user\/account\/delete-immediately/);
assert.match(landingSource, /await prepareOneSignalIdentityForUser\(user\.id\)/);

console.log("OneSignal sign-out identity lifecycle tests passed.");