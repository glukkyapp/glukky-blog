import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";
import { LoadingScreen } from "@/components/loading-screen";

interface LoadingContextValue {
  register: () => () => void;
}

const LoadingContext = createContext<LoadingContextValue>({
  register: () => () => {},
});

export function LoadingOverlayProvider({ children }: { children: ReactNode }) {
  const [manualCount, setManualCount] = useState(0);
  const fetchingCount = useIsFetching();
  const mutatingCount = useIsMutating();

  const register = useCallback(() => {
    setManualCount((c) => c + 1);
    return () => setManualCount((c) => Math.max(0, c - 1));
  }, []);

  const isLoading = fetchingCount > 0 || mutatingCount > 0 || manualCount > 0;
  const showOverlay = useDelayedLoading(isLoading, 2000);

  return (
    <LoadingContext.Provider value={{ register }}>
      {children}
      <LoadingScreen visible={showOverlay} />
    </LoadingContext.Provider>
  );
}

/**
 * Register a manual loading source (e.g., raw fetch() calls not tracked by react-query).
 * Increments the global loading counter while `loading` is true.
 */
export function useGlobalLoading(loading: boolean) {
  const { register } = useContext(LoadingContext);

  useEffect(() => {
    if (!loading) return;
    return register();
  }, [loading, register]);
}

/**
 * Register the global loading overlay against an external promise (e.g. a
 * staged image preload). The cube overlay only appears if the promise stays
 * pending past the LoadingOverlayProvider's 2 s delay; if it resolves sooner,
 * nothing flashes.
 *
 * Mount-only contract: `promiseGetter` is called exactly once on mount.
 * Pass a stable, module-level function (e.g. `getStage2Promise`); do not
 * pass an inline arrow that closes over changing state.
 */
export function usePromiseLoading(promiseGetter: () => Promise<unknown>) {
  const [pending, setPending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    promiseGetter().finally(() => {
      if (!cancelled) setPending(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useGlobalLoading(pending);
}
