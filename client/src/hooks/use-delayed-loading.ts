import { useEffect, useState } from "react";

/**
 * Returns true only after `loading` has been continuously true for `delayMs`.
 * Resets immediately to false when `loading` becomes false.
 */
export function useDelayedLoading(loading: boolean, delayMs: number = 2000): boolean {
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    if (!loading) {
      setDelayed(false);
      return;
    }
    const timer = setTimeout(() => setDelayed(true), delayMs);
    return () => clearTimeout(timer);
  }, [loading, delayMs]);

  return delayed;
}
