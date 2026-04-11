type ImpactIntensity = "light" | "medium" | "heavy" | "rigid" | "soft" | "LIGHT" | "MEDIUM" | "HEAVY" | "RIGID" | "SOFT";
type NotificationType = "success" | "error" | "warning" | "SUCCESS" | "ERROR" | "WARNING";

declare global {
  interface Window {
    natively?: {
      hapticImpact(type: string): void;
      hapticNotification(type: string): void;
      hapticPattern(pattern: string, delay: number): void;
    };
  }
}

export function hapticTap(intensity: ImpactIntensity = "light") {
  try {
    window.natively?.hapticImpact(intensity.toUpperCase());
  } catch {}
}

export function hapticNotify(type: NotificationType = "success") {
  try {
    window.natively?.hapticNotification(type.toUpperCase());
  } catch {}
}

export function hapticPattern(pattern: string = "..oO-Oo..", delay: number = 0.1) {
  try {
    window.natively?.hapticPattern(pattern, delay);
  } catch {}
}
