import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { registerOfflineNotifier } from "@/lib/queryClient";
import OfflineScreen from "@/components/offline-screen";

interface OfflineContextValue {
  isOffline: boolean;
  setOffline: (value: boolean) => void;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function useOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within OfflineProvider");
  return ctx;
}

const PING_DELAYS_MS = [0, 1000, 2000, 4000];
const PING_TIMEOUT_MS = 2000;
const HEALTH_URL = "/api/health";

interface OfflineProviderProps {
  children: ReactNode;
}

export function OfflineProvider({ children }: OfflineProviderProps) {
  const [isOffline, setIsOfflineState] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return false;
    return navigator.onLine === false;
  });

  // useRef so the listener-binding effect does NOT re-run when recovery starts.
  const recoveringRef = useRef<boolean>(false);
  const isOfflineRef = useRef<boolean>(isOffline);

  const setOffline = (value: boolean) => {
    setIsOfflineState((prev) => {
      if (prev === value) return prev;
      isOfflineRef.current = value;
      return value;
    });
  };

  // Register the offline notifier into the queryClient module-level singleton.
  useEffect(() => {
    registerOfflineNotifier(() => {
      if (!isOfflineRef.current) {
        isOfflineRef.current = true;
        setIsOfflineState(true);
      }
    });
    return () => {
      registerOfflineNotifier(null);
    };
  }, []);

  // Online/offline event listeners + recovery loop.
  useEffect(() => {
    const handleOffline = () => {
      if (!isOfflineRef.current) {
        isOfflineRef.current = true;
        setIsOfflineState(true);
      }
    };

    const pingHealth = async (): Promise<boolean> => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
      try {
        const res = await fetch(HEALTH_URL, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    const startRecovery = async () => {
      if (recoveringRef.current) return;
      recoveringRef.current = true;
      try {
        for (const delay of PING_DELAYS_MS) {
          if (delay > 0) {
            await new Promise<void>((resolve) => window.setTimeout(resolve, delay));
          }
          const ok = await pingHealth();
          if (ok) {
            window.location.reload();
            return;
          }
        }
        // Fallback: ~15s worst case — reload anyway.
        window.location.reload();
      } finally {
        recoveringRef.current = false;
      }
    };

    const handleOnline = () => {
      // Only attempt recovery if the overlay is currently shown.
      if (!isOfflineRef.current) return;
      void startRecovery();
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  // Foreground-return detection: when the WebView resumes (visibilitychange /
  // focus / pageshow incl. bfcache restore), if we're offline at resume time
  // flip the overlay immediately so users mid-upload don't wait for the full
  // 25s/45s AbortController timeout to fire. Mobile WebView lifecycles vary,
  // so we listen to all three and dedupe.
  useEffect(() => {
    if (typeof document === "undefined") return;

    let lastResumeAt = 0;
    const RESUME_DEDUPE_MS = 750;

    const handleResume = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastResumeAt < RESUME_DEDUPE_MS) return;
      lastResumeAt = now;
      if (isOfflineRef.current) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        isOfflineRef.current = true;
        setIsOfflineState(true);
      }
    };

    const handlePageShow = (e: PageTransitionEvent) => {
      // bfcache restore (e.persisted) is the most important case here, but we
      // also handle normal pageshow since iOS Safari can restore without
      // firing visibilitychange.
      void e;
      handleResume();
    };

    document.addEventListener("visibilitychange", handleResume);
    window.addEventListener("focus", handleResume);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      document.removeEventListener("visibilitychange", handleResume);
      window.removeEventListener("focus", handleResume);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  return (
    <OfflineContext.Provider value={{ isOffline, setOffline }}>
      {children}
      {isOffline && <OfflineScreen />}
    </OfflineContext.Provider>
  );
}
