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
