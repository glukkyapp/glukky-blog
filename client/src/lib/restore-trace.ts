// Lightweight client-side trace helper for the restore code path.
//
// Mirrors key restore-flow signals (button tap, login state, bridge
// result, server verify outcome) to a server-side log endpoint so the
// entire path is reconstructable from deployment logs alone — not
// just from a developer with the dev panel open. Console-logs the
// same payload locally with a `[restore]` tag for the dev panel /
// Safari Web Inspector view.
//
// Best-effort by design: a network failure here MUST NOT break the
// restore flow. The fetch is fire-and-forget with a short timeout.

const INSTALL_ID_KEY = "glukky.installId";

export function getInstallId(): string {
  try {
    let id = localStorage.getItem(INSTALL_ID_KEY);
    if (id && id.length > 0) return id;
    // Cheap UUID-ish — does not need to be cryptographically strong,
    // it's a per-install correlation id only.
    id =
      "i_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 10);
    localStorage.setItem(INSTALL_ID_KEY, id);
    return id;
  } catch {
    return "i_anon";
  }
}

export interface RestoreTracePayload {
  [key: string]: unknown;
}

export function recordRestoreTrace(
  event: string,
  data: RestoreTracePayload = {},
): void {
  const installId = getInstallId();
  // Mirror to the local console so dev-panel inspectors see the trail too.
  try {
    console.log(`[restore] event=${event} install=${installId}`, data);
  } catch {
    // ignore
  }
  try {
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    if (controller) {
      setTimeout(() => controller.abort(), 3_000);
    }
    void fetch("/api/diag/restore-trace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ event, installId, ...data }),
      signal: controller?.signal,
    }).catch(() => {
      // best-effort — never break restore on log shipping failures
    });
  } catch {
    // ignore
  }
}
