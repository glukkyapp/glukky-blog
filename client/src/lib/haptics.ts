type ImpactIntensity = "LIGHT" | "MEDIUM" | "HEAVY";
type NotificationType = "SUCCESS" | "ERROR" | "WARNING";

interface NativelyHaptics {
  hapticImpactIOS(intensity: ImpactIntensity): void;
  hapticNotificationIOS(type: NotificationType): void;
  hapticPatternIOS(pattern: string, delay: number): void;
}

declare global {
  interface Window {
    natively?: NativelyHaptics;
  }
}

function getNatively(): NativelyHaptics | undefined {
  if (typeof window !== "undefined") {
    return window.natively;
  }
  return undefined;
}

export function hapticTap(intensity: ImpactIntensity = "LIGHT") {
  try {
    getNatively()?.hapticImpactIOS(intensity);
  } catch {}
}

export function hapticNotify(type: NotificationType = "SUCCESS") {
  try {
    getNatively()?.hapticNotificationIOS(type);
  } catch {}
}

export function hapticPattern(pattern: string = "..oO-Oo..", delay: number = 80) {
  try {
    getNatively()?.hapticPatternIOS(pattern, delay);
  } catch {}
}
