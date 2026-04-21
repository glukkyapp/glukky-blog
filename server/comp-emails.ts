import { authStorage } from "./replit_integrations/auth/storage";
import { storage } from "./storage";
import type { UserProfile } from "@shared/schema";

export const COMP_EMAILS = new Set<string>([
  "cynthiayuyu@hotmail.com",
  "glukkyreviewer@glukky.app",
]);

export function isCompEmail(email?: string | null): boolean {
  if (!email) return false;
  return COMP_EMAILS.has(email.toLowerCase().trim());
}

export async function isCompUserId(userId: string): Promise<boolean> {
  try {
    const user = await authStorage.getUser(userId);
    return isCompEmail(user?.email);
  } catch {
    return false;
  }
}

export async function ensureCompPremium(
  userId: string,
  profile: UserProfile | undefined,
): Promise<UserProfile | undefined> {
  if (!profile || profile.isPremium) return profile;
  if (!(await isCompUserId(userId))) return profile;
  const updated = await storage.updateProfile(userId, { isPremium: true });
  return updated || profile;
}
