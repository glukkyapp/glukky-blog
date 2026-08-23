export const HSTIX_CORRECTION_WINDOW_MS = 5 * 60 * 1000;

export function hstixCorrectionExpiresAt(recordedAt: Date): Date {
  return new Date(recordedAt.getTime() + HSTIX_CORRECTION_WINDOW_MS);
}

export function isHstixCorrectionOpen(recordedAt: Date, now: Date): boolean {
  return now.getTime() < hstixCorrectionExpiresAt(recordedAt).getTime();
}