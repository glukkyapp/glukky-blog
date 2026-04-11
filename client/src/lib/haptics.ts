type ImpactIntensity = "light" | "medium" | "heavy" | "LIGHT" | "MEDIUM" | "HEAVY";
type NotificationType = "success" | "error" | "warning" | "SUCCESS" | "ERROR" | "WARNING";

interface NativelyInstance {
  hapticImpact(type: string): void;
  hapticNotification(type: string): void;
  hapticPattern(pattern: string, delay: number): void;
}

declare global {
  interface Window {
    Natively?: new () => NativelyInstance;
  }
}

let nativelyInstance: NativelyInstance | undefined;

function getNatively(): NativelyInstance | undefined {
  if (nativelyInstance) return nativelyInstance;
  if (typeof window !== "undefined" && window.Natively) {
    nativelyInstance = new window.Natively();
  }
  return nativelyInstance;
}

export function hapticTap(intensity: ImpactIntensity = "light") {
  try {
    getNatively()?.hapticImpact(intensity.toLowerCase());
  } catch {}
}

export function hapticNotify(type: NotificationType = "success") {
  try {
    getNatively()?.hapticNotification(type.toLowerCase());
  } catch {}
}

export function hapticPattern(pattern: string = "..oO-Oo..", delay: number = 80) {
  try {
    getNatively()?.hapticPattern(pattern, delay);
  } catch {}
}
