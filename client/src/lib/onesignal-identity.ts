export const ONESIGNAL_ACTIVE_USER_KEY = "glukky_onesignal_active_user";
export const ONESIGNAL_PENDING_USER_KEY = "glukky_onesignal_pending_user";

const PLAYER_CACHE_PREFIX = "glukky_onesignal_pid_";
const EXTERNAL_ID_CACHE_PREFIX = "glukky_onesignal_external_id_";
const UNRESOLVED_RUNTIME_KEY = "glukky_onesignal_identity_unresolved";
const DEFAULT_TIMEOUT_MS = 6000;

export type OneSignalReleaseResult =
  | { ok: true; status: "released" | "nothing_to_release" | "bridge_not_present"; via: string }
  | { ok: false; status: "timeout" | "bridge_error"; via: string; error?: string };

type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

export interface OneSignalIdentityRuntime {
  globals: any;
  storage: BrowserStorage;
  sessionStorage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

let identityQueue: Promise<unknown> = Promise.resolve();
const blockedRuntimes = new WeakSet<object>();

function isRuntimeBlocked(runtime: OneSignalIdentityRuntime): boolean {
  return (runtime.globals && typeof runtime.globals === "object" && blockedRuntimes.has(runtime.globals))
    || runtime.sessionStorage?.getItem(UNRESOLVED_RUNTIME_KEY) === "1";
}

function blockRuntime(runtime: OneSignalIdentityRuntime): void {
  if (runtime.globals && typeof runtime.globals === "object") blockedRuntimes.add(runtime.globals);
  runtime.sessionStorage?.setItem(UNRESOLVED_RUNTIME_KEY, "1");
}

function clearRuntimeBlock(runtime: OneSignalIdentityRuntime): void {
  if (runtime.globals && typeof runtime.globals === "object") blockedRuntimes.delete(runtime.globals);
  runtime.sessionStorage?.removeItem(UNRESOLVED_RUNTIME_KEY);
}

function defaultRuntime(): OneSignalIdentityRuntime | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return {
    globals: window as any,
    storage: window.localStorage,
    sessionStorage: window.sessionStorage,
  };
}

function enqueueIdentityOperation<T>(operation: () => Promise<T>): Promise<T> {
  const next = identityQueue.then(operation, operation);
  identityQueue = next.then(() => undefined, () => undefined);
  return next;
}

function cachedAssociationUsers(storage: BrowserStorage): string[] {
  const users = new Set<string>();
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) continue;
    if (key.startsWith(PLAYER_CACHE_PREFIX)) users.add(key.slice(PLAYER_CACHE_PREFIX.length));
    if (key.startsWith(EXTERNAL_ID_CACHE_PREFIX)) users.add(key.slice(EXTERNAL_ID_CACHE_PREFIX.length));
  }
  return Array.from(users).filter(Boolean);
}

function hasKnownAssociation(storage: BrowserStorage): boolean {
  return !!storage.getItem(ONESIGNAL_ACTIVE_USER_KEY)
    || !!storage.getItem(ONESIGNAL_PENDING_USER_KEY)
    || cachedAssociationUsers(storage).length > 0;
}

function clearAssociationCaches(storage: BrowserStorage): void {
  const activeUser = storage.getItem(ONESIGNAL_ACTIVE_USER_KEY);
  const users = new Set(cachedAssociationUsers(storage));
  if (activeUser) users.add(activeUser);
  users.forEach((userId) => {
    storage.removeItem(`${PLAYER_CACHE_PREFIX}${userId}`);
    storage.removeItem(`${EXTERNAL_ID_CACHE_PREFIX}${userId}`);
  });
  storage.removeItem(ONESIGNAL_ACTIVE_USER_KEY);
  storage.removeItem(ONESIGNAL_PENDING_USER_KEY);
}

function callbackReportedError(value: any): string | null {
  if (!value || typeof value !== "object") return null;
  if (value.error) return String(value.error);
  if (value.status === false || value.success === false) return JSON.stringify(value);
  return null;
}

async function waitForReleaseBridge(runtime: OneSignalIdentityRuntime): Promise<
  | { via: string; invoke: (done: (value?: any) => void) => any }
  | null
> {
  const timeoutMs = runtime.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = runtime.pollIntervalMs ?? 100;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const w = runtime.globals;
    if (w?.NativelyNotifications) {
      const notifications = new w.NativelyNotifications();
      if (typeof notifications.removeExternalId === "function") {
        return {
          via: "NativelyNotifications.removeExternalId",
          invoke: (done) => notifications.removeExternalId(done),
        };
      }
    }
    if (w?.NativelyPush) {
      const push = new w.NativelyPush();
      if (typeof push.removeExternalId === "function") {
        return {
          via: "NativelyPush.removeExternalId",
          invoke: (done) => push.removeExternalId(done),
        };
      }
    }
    if (typeof w?.OneSignal?.logout === "function") {
      return { via: "OneSignal.logout", invoke: () => w.OneSignal.logout() };
    }
    if (typeof w?.median?.onesignal?.logout === "function") {
      return { via: "median.onesignal.logout", invoke: () => w.median.onesignal.logout() };
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  return null;
}

async function releaseKnownIdentity(
  runtime: OneSignalIdentityRuntime,
  reason: string,
  forceNativeRelease = false,
): Promise<OneSignalReleaseResult> {
  // OneSignal persists identity operations in invocation order. Even when an
  // earlier set/remove callback timed out, enqueueing a compensating remove is
  // safe and necessary; association remains blocked until this remove confirms.
  if (!forceNativeRelease && !hasKnownAssociation(runtime.storage)) {
    return { ok: true, status: "nothing_to_release", via: "local_state" };
  }

  const timeoutMs = runtime.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const bridge = await waitForReleaseBridge(runtime);
  if (!bridge) {
    console.warn(`[onesignal] identity release timed out waiting for bridge reason=${reason}`);
    return { ok: false, status: "timeout", via: "bridge_discovery" };
  }

  return new Promise<OneSignalReleaseResult>((resolve) => {
    let settled = false;
    const finish = (result: OneSignalReleaseResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (result.ok) {
        clearAssociationCaches(runtime.storage);
        clearRuntimeBlock(runtime);
      }
      resolve(result);
    };
    const timer = setTimeout(() => {
      console.warn(`[onesignal] identity release timed out via=${bridge.via} reason=${reason}`);
      blockRuntime(runtime);
      finish({ ok: false, status: "timeout", via: bridge.via });
    }, timeoutMs);

    try {
      const directReturn = bridge.invoke((value) => {
        const error = callbackReportedError(value);
        if (error) {
          finish({ ok: false, status: "bridge_error", via: bridge.via, error });
        } else {
          finish({ ok: true, status: "released", via: bridge.via });
        }
      });
      if (directReturn && typeof directReturn.then === "function") {
        directReturn
          .then((value: any) => {
            const error = callbackReportedError(value);
            finish(error
              ? { ok: false, status: "bridge_error", via: bridge.via, error }
              : { ok: true, status: "released", via: bridge.via });
          })
          .catch((error: any) => {
            finish({ ok: false, status: "bridge_error", via: bridge.via, error: error?.message ?? String(error) });
          });
      } else if (directReturn !== undefined) {
        const error = callbackReportedError(directReturn);
        finish(error
          ? { ok: false, status: "bridge_error", via: bridge.via, error }
          : { ok: true, status: "released", via: bridge.via });
      }
    } catch (error: any) {
      finish({ ok: false, status: "bridge_error", via: bridge.via, error: error?.message ?? String(error) });
    }
  });
}

export function releaseOneSignalIdentity(
  reason: string,
  runtime: OneSignalIdentityRuntime | null = defaultRuntime(),
): Promise<OneSignalReleaseResult> {
  if (!runtime) {
    return Promise.resolve({ ok: true, status: "bridge_not_present", via: "non_browser" });
  }
  return enqueueIdentityOperation(() => releaseKnownIdentity(runtime, reason, true));
}

export async function endOneSignalSession(
  reason: string,
  endSession: () => Promise<void>,
  runtime: OneSignalIdentityRuntime | null = defaultRuntime(),
): Promise<OneSignalReleaseResult> {
  const released = await releaseOneSignalIdentity(reason, runtime);
  await endSession();
  return released;
}

export function prepareOneSignalIdentityForUser(
  userId: string,
  runtime: OneSignalIdentityRuntime | null = defaultRuntime(),
): Promise<boolean> {
  if (!runtime) return Promise.resolve(true);
  return enqueueIdentityOperation(async () => {
    const activeUser = runtime.storage.getItem(ONESIGNAL_ACTIVE_USER_KEY);
    if (!isRuntimeBlocked(runtime) && activeUser === userId) return true;
    if (!hasKnownAssociation(runtime.storage)) return !isRuntimeBlocked(runtime);
    const released = await releaseKnownIdentity(runtime, "before_account_switch");
    return released.ok;
  });
}

export function associateOneSignalIdentity(
  userId: string,
  associate: () => Promise<boolean>,
  runtime: OneSignalIdentityRuntime | null = defaultRuntime(),
): Promise<boolean> {
  if (!runtime) return Promise.resolve(false);
  return enqueueIdentityOperation(async () => {
    const activeUser = runtime.storage.getItem(ONESIGNAL_ACTIVE_USER_KEY);
    const needsRelease = (isRuntimeBlocked(runtime) || activeUser !== userId)
      && hasKnownAssociation(runtime.storage);
    if (needsRelease) {
      const released = await releaseKnownIdentity(runtime, "before_account_association");
      if (!released.ok) {
        console.warn(`[onesignal] association blocked until prior identity releases user=${userId}`);
        return false;
      }
    }

    runtime.storage.setItem(ONESIGNAL_PENDING_USER_KEY, userId);
    const associated = await associate();
    if (associated) {
      runtime.storage.setItem(ONESIGNAL_ACTIVE_USER_KEY, userId);
      runtime.storage.removeItem(ONESIGNAL_PENDING_USER_KEY);
      return true;
    }

    blockRuntime(runtime);
    console.warn(`[onesignal] association unconfirmed; further identity commands blocked for this app session user=${userId}`);
    return false;
  });
}