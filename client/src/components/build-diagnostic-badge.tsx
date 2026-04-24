import { useEffect, useState } from "react";
import { isPurchaseInFlight } from "@/lib/purchase-in-flight";

const DEV_BADGE_KEY = "devBadge";
const VERSION_CHECK_THROTTLE_MS = 60_000;
const PAYWALL_OPEN_EVENT = "paywall-opened";

declare global {
  interface Window {
    __BUILD_SHA__?: string;
  }
}

function readDevBadgeFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEV_BADGE_KEY) !== "0";
  } catch {
    return true;
  }
}

// Apply ?debug=1 / ?debug=0 once at module load so the persistence
// happens before any rendering, regardless of which page mounts the
// badge first. The badge is on by default; ?debug=0 is the one-tap
// permanent off-switch and ?debug=1 re-enables it after that.
function applyDebugQueryFlag(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const debug = params.get("debug");
    if (debug === "0") {
      window.localStorage.setItem(DEV_BADGE_KEY, "0");
    } else if (debug === "1") {
      window.localStorage.removeItem(DEV_BADGE_KEY);
    }
  } catch {
    // localStorage unavailable; nothing to do.
  }
}

applyDebugQueryFlag();

interface BuildInfo {
  sha: string | null;
  startedAt?: string;
  nodeEnv?: string | null;
}

function shortSha(s: string | null | undefined): string {
  if (!s) return "?";
  return String(s).slice(0, 7);
}

export default function BuildDiagnosticBadge() {
  const [visible] = useState<boolean>(() => readDevBadgeFlag());
  const [serverSha, setServerSha] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [host, setHost] = useState<string>(() =>
    typeof window !== "undefined" ? window.location.host : "",
  );
  // Re-render once per second while a purchase/restore is in flight so the
  // Reload button on the staleness banner can swap to a disabled state
  // even if the banner was already on screen when the purchase began.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!stale) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [stale]);

  // Single shared check: fetches /api/build-info and updates serverSha
  // + stale flag. Throttled to once per minute (anywhere in the app)
  // and skipped while a purchase is mid-flight.
  useEffect(() => {
    let lastCheck = 0;
    let cancelled = false;

    const runCheck = async () => {
      if (cancelled) return;
      if (isPurchaseInFlight()) return;
      const now = Date.now();
      if (now - lastCheck < VERSION_CHECK_THROTTLE_MS) return;
      lastCheck = now;
      try {
        const r = await fetch("/api/build-info", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as BuildInfo;
        if (cancelled) return;
        const server = j?.sha ?? null;
        setServerSha(server);
        setHost(window.location.host);
        const loaded = window.__BUILD_SHA__ ?? null;
        if (loaded && server && loaded !== server) {
          setStale(true);
        }
      } catch {
        // ignore — transient network failure shouldn't bother the user
      }
    };

    runCheck();

    const onVisibility = () => {
      if (document.visibilityState === "visible") runCheck();
    };
    const onPaywall = () => runCheck();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(PAYWALL_OPEN_EVENT, onPaywall);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(PAYWALL_OPEN_EVENT, onPaywall);
    };
  }, []);

  const loadedSha =
    typeof window !== "undefined" ? window.__BUILD_SHA__ ?? null : null;
  const mismatch = !!loadedSha && !!serverSha && loadedSha !== serverSha;

  return (
    <>
      {visible && (
        <div
          data-testid="build-diagnostic-badge"
          style={{
            position: "fixed",
            top: "calc(env(safe-area-inset-top, 0px) + 4px)",
            right: 4,
            zIndex: 99999,
            padding: "3px 6px",
            fontSize: 9,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            lineHeight: 1.25,
            background: mismatch
              ? "rgba(220,38,38,0.85)"
              : "rgba(0,0,0,0.65)",
            color: "#fff",
            borderRadius: 4,
            pointerEvents: "none",
            userSelect: "none",
            maxWidth: "60vw",
            textAlign: "right",
            letterSpacing: 0.2,
          }}
        >
          <div data-testid="badge-loaded-sha">L:{shortSha(loadedSha)}</div>
          <div data-testid="badge-server-sha">S:{shortSha(serverSha)}</div>
          <div
            data-testid="badge-host"
            style={{ wordBreak: "break-all", opacity: 0.9 }}
          >
            {host}
          </div>
        </div>
      )}

      {stale && (() => {
        const purchaseBlocking = isPurchaseInFlight();
        return (
          <div
            data-testid="banner-build-stale"
            style={{
              position: "fixed",
              top: "calc(env(safe-area-inset-top, 0px) + 4px)",
              left: 8,
              right: 8,
              zIndex: 99998,
              background: "#fef3c7",
              color: "#78350f",
              border: "1px solid #f59e0b",
              borderRadius: 10,
              padding: "10px 12px",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
            }}
          >
            <span style={{ flex: 1, lineHeight: 1.3 }}>
              {purchaseBlocking
                ? "A new version is available — finish your purchase first."
                : "A new version of the app is available."}
            </span>
            <button
              data-testid="button-build-stale-reload"
              onClick={() => {
                if (isPurchaseInFlight()) return;
                window.location.reload();
              }}
              disabled={purchaseBlocking}
              style={{
                padding: "6px 12px",
                background: purchaseBlocking ? "#d6d3d1" : "#f59e0b",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: purchaseBlocking ? "not-allowed" : "pointer",
                flexShrink: 0,
                opacity: purchaseBlocking ? 0.7 : 1,
              }}
            >
              Reload
            </button>
          </div>
        );
      })()}
    </>
  );
}
