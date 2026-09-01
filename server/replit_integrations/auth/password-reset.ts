import { createHash, randomBytes } from "node:crypto";
import { ReplitConnectors } from "@replit/connectors-sdk";
import bcrypt from "bcrypt";
import type { PoolClient } from "pg";
import { pool } from "../../db";

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
export const PASSWORD_RESET_MIN_PASSWORD_LENGTH = 6;
export const PASSWORD_RESET_GENERIC_MESSAGE =
  "If an account exists for that email, a password reset link will be sent.";
export const PASSWORD_RESET_INVALID_MESSAGE =
  "This reset link is invalid or has expired. Please request a new one.";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_PASSWORD = "password-reset-timing-dummy";

export interface GeneratedResetToken {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface IssuedResetToken extends GeneratedResetToken {
  userId: string;
}

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}

export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export function generateResetToken(now = new Date()): GeneratedResetToken {
  const rawToken = randomBytes(32).toString("base64url");
  return {
    rawToken,
    tokenHash: hashResetToken(rawToken),
    expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
  };
}

export function buildResetUrl(origin: string, rawToken: string): string {
  const normalizedOrigin = origin.replace(/\/+$/, "");
  return `${normalizedOrigin}/#reset_token=${encodeURIComponent(rawToken)}`;
}

function getConfiguredOrigin(): string {
  const configured = process.env.PUBLIC_APP_ORIGIN?.trim();
  if (!configured) {
    throw new Error("PUBLIC_APP_ORIGIN is not configured");
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error("PUBLIC_APP_ORIGIN is invalid");
  }

  if (parsed.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && parsed.protocol === "http:")) {
    throw new Error("PUBLIC_APP_ORIGIN must use HTTPS in production");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("PUBLIC_APP_ORIGIN must not contain credentials, query parameters, or a fragment");
  }
  return configured;
}

export async function sendPasswordResetEmail(
  recipient: string,
  rawToken: string,
): Promise<void> {
  const from = process.env.PASSWORD_RESET_FROM_EMAIL?.trim();
  if (!from) {
    throw new Error("PASSWORD_RESET_FROM_EMAIL is not configured");
  }

  const resetUrl = buildResetUrl(getConfiguredOrigin(), rawToken);
  const response = await new ReplitConnectors().proxy("resend", "/emails", {
    method: "POST",
    body: {
      from,
      to: [recipient],
      subject: "Reset your Glukky password",
      text: `Reset your Glukky password by opening this link:\n\n${resetUrl}\n\nThis link expires in 30 minutes and can only be used once.`,
      html: `<p>Reset your Glukky password by opening this link:</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 30 minutes and can only be used once.</p>`,
    },
  });

  if (!response.ok) {
    // Do not include the provider response body: it can contain recipient,
    // URL, or provider-account details that must not enter application logs.
    throw new Error(`Password reset email provider returned ${response.status}`);
  }
}

export async function issuePasswordResetToken(
  normalizedEmail: string,
): Promise<IssuedResetToken | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userResult = await client.query<{ id: string; email: string }>(
      `SELECT id, email
       FROM users
       WHERE email = $1 AND password IS NOT NULL
       LIMIT 1`,
      [normalizedEmail],
    );

    if (userResult.rows.length === 0) {
      await client.query("COMMIT");
      return null;
    }

    const generated = generateResetToken();
    await client.query(
      `DELETE FROM password_reset_tokens
       WHERE user_id = $1 AND used_at IS NULL`,
      [userResult.rows[0].id],
    );
    await client.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userResult.rows[0].id, generated.tokenHash, generated.expiresAt],
    );
    await client.query("COMMIT");

    return { ...generated, userId: userResult.rows[0].id };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function performPasswordReset(
  rawToken: string,
  newPasswordHash: string,
): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await performPasswordResetWithClient(client, rawToken, newPasswordHash);
    return result;
  } finally {
    client.release();
  }
}

export async function performPasswordResetWithClient(
  client: Pick<PoolClient, "query">,
  rawToken: string,
  newPasswordHash: string,
): Promise<boolean> {
  const tokenHash = hashResetToken(rawToken);
  await client.query("BEGIN");
  try {
    const tokenResult = await client.query<{ id: string; user_id: string }>(
      `SELECT id, user_id
       FROM password_reset_tokens
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       FOR UPDATE`,
      [tokenHash],
    );

    if (tokenResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    const token = tokenResult.rows[0];
    const consumed = await client.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE id = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [token.id],
    );
    if (consumed.rowCount !== 1) {
      await client.query("ROLLBACK");
      return false;
    }

    const updatedUser = await client.query(
      `UPDATE users
       SET password = $1, updated_at = NOW()
       WHERE id = $2 AND password IS NOT NULL`,
      [newPasswordHash, token.user_id],
    );
    if (updatedUser.rowCount !== 1) {
      throw new Error("Password reset user update failed");
    }

    await client.query(
      `DELETE FROM sessions
       WHERE sess ->> 'userId' = $1`,
      [token.user_id],
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

export async function hashPasswordForReset(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function doResetTimingWork(): Promise<void> {
  await bcrypt.hash(DUMMY_PASSWORD, 10);
}

export async function waitForMinimumResetResponse(
  startedAt: number,
  minimumMs = 250,
): Promise<void> {
  const remaining = minimumMs - (Date.now() - startedAt);
  if (remaining > 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, remaining));
  }
}