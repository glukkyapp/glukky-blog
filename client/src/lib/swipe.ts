/**
 * Swipe gesture rule for the snap-advice popup:
 * a LEFT swipe of at least 40 px completed within 600 ms advances.
 */
export const SWIPE_MIN_PX = 40;
export const SWIPE_MAX_MS = 600;

export function isLeftSwipe(
  deltaX: number,
  elapsedMs: number,
  minPx: number = SWIPE_MIN_PX,
  maxMs: number = SWIPE_MAX_MS,
): boolean {
  return deltaX <= -minPx && elapsedMs <= maxMs && elapsedMs >= 0;
}
