import { createSign } from "crypto";

/**
 * Generates an Apple client_secret JWT (ES256) for server-to-server API calls.
 *
 * Requires env vars: APPLE_TEAM_ID, APPLE_CLIENT_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY.
 * The private key should be the full PEM content of the .p8 file, with literal
 * newlines OR with \n escape sequences (both forms are handled).
 *
 * Apple client secrets are short-lived JWTs; generate a fresh one per API call.
 */
function generateClientSecret(): string {
  const teamId = process.env.APPLE_TEAM_ID;
  const clientId = process.env.APPLE_CLIENT_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY;

  if (!teamId || !clientId || !keyId || !privateKey) {
    throw new Error(
      "Apple developer credentials not fully configured. " +
        "Set APPLE_TEAM_ID, APPLE_CLIENT_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY.",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: teamId,
      iat: now,
      exp: now + 15_777_000, // Apple max: ~6 months
      aud: "https://appleid.apple.com",
      sub: clientId,
    }),
  ).toString("base64url");

  const signingInput = `${header}.${payload}`;
  const sign = createSign("SHA256");
  sign.update(signingInput);
  // Support both literal newlines and \n-escaped keys stored in env vars
  const pem = privateKey.replace(/\\n/g, "\n");
  const signature = sign.sign(pem, "base64url");

  return `${signingInput}.${signature}`;
}

/** Returns true if all four Apple developer env vars are set. */
export function appleCredentialsConfigured(): boolean {
  return !!(
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_CLIENT_ID &&
    process.env.APPLE_KEY_ID &&
    process.env.APPLE_PRIVATE_KEY
  );
}

/**
 * Exchanges a one-time `authorizationCode` (obtained from Apple Sign-In on the
 * iOS device) for a long-lived refresh token.
 *
 * Returns the refresh token string, or null if the exchange is not possible
 * (credentials missing, code absent, or Apple returns no refresh token).
 * Throws on a non-OK HTTP response so the caller can decide how to handle it.
 */
export async function exchangeAuthCodeForRefreshToken(
  authorizationCode: string,
): Promise<string | null> {
  if (!appleCredentialsConfigured()) {
    console.warn(
      "[apple-auth] Skipping token exchange — Apple developer credentials not configured.",
    );
    return null;
  }

  const clientId = process.env.APPLE_CLIENT_ID!;
  const clientSecret = generateClientSecret();

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: authorizationCode,
    grant_type: "authorization_code",
  });

  const resp = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "(unreadable)");
    throw new Error(
      `Apple token exchange failed: HTTP ${resp.status} — ${body}`,
    );
  }

  const data = (await resp.json()) as { refresh_token?: string };
  return data.refresh_token ?? null;
}

/**
 * Revokes a previously-issued Apple refresh token.
 * Called at account deletion time so Apple can clean up on their side.
 *
 * Always returns without throwing — deletion must never block on this.
 */
export async function revokeAppleRefreshToken(
  refreshToken: string,
): Promise<{ ok: boolean; status: number | null }> {
  if (!appleCredentialsConfigured()) {
    return { ok: false, status: null };
  }

  try {
    const clientId = process.env.APPLE_CLIENT_ID!;
    const clientSecret = generateClientSecret();

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      token: refreshToken,
      token_type_hint: "refresh_token",
    });

    const resp = await fetch("https://appleid.apple.com/auth/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    return { ok: resp.ok, status: resp.status };
  } catch (e: any) {
    console.warn(`[apple-auth] revokeAppleRefreshToken threw: ${e?.message ?? e}`);
    return { ok: false, status: null };
  }
}
