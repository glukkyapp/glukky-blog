import { sign as cryptoSign, createPublicKey, createVerify } from "crypto";

// ─── Apple identity token verification ──────────────────────────────────────

interface AppleJwk {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

let _jwksCache: { keys: AppleJwk[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 60 * 60 * 1000; // 1 hour

function base64urlToBuffer(s: string): Buffer {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

async function fetchAppleJwks(): Promise<AppleJwk[]> {
  const now = Date.now();
  if (_jwksCache && now - _jwksCache.fetchedAt < JWKS_TTL_MS) {
    return _jwksCache.keys;
  }
  const resp = await fetch("https://appleid.apple.com/auth/keys");
  if (!resp.ok) {
    throw new Error(`Failed to fetch Apple JWKS: HTTP ${resp.status}`);
  }
  const data = (await resp.json()) as { keys: AppleJwk[] };
  _jwksCache = { keys: data.keys, fetchedAt: now };
  return data.keys;
}

function _verifyTokenWithKey(
  jwk: AppleJwk,
  headerB64: string,
  payloadB64: string,
  sigB64: string,
  payload: { sub: string; email?: string },
): { sub: string; email?: string } {
  const publicKey = createPublicKey({ key: jwk as any, format: "jwk" });
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  const sig = base64urlToBuffer(sigB64);
  const valid = verifier.verify(publicKey, sig);
  if (!valid) {
    throw new Error("Apple identity token: signature verification failed");
  }
  return { sub: payload.sub, email: payload.email };
}

/**
 * Verifies an Apple identity token (JWT, RS256) against Apple's public JWKS.
 * Returns the cryptographically confirmed { sub, email } on success.
 * Throws a descriptive error on any failure — callers should treat any throw
 * as an authentication failure and return 401.
 *
 * Why: Apple Sign-In sends both a one-time `authorizationCode` (used here for
 * the server-to-server token exchange) and an `identityToken` (signed JWT).
 * Only the identityToken carries Apple's cryptographic guarantee that the
 * `sub` value came from a real Apple authentication for this app. Trusting a
 * client-supplied `subject` field directly (without verifying this JWT) would
 * allow anyone who knows another user's Apple sub to impersonate that user.
 */
export async function verifyAppleIdentityToken(
  identityToken: string,
): Promise<{ sub: string; email?: string }> {
  const parts = identityToken.split(".");
  if (parts.length !== 3) {
    throw new Error("Apple identity token: invalid JWT format");
  }
  const [headerB64, payloadB64, sigB64] = parts;

  const header = JSON.parse(base64urlToBuffer(headerB64).toString("utf8")) as {
    alg: string;
    kid: string;
  };
  const payload = JSON.parse(base64urlToBuffer(payloadB64).toString("utf8")) as {
    iss: string;
    aud: string;
    exp: number;
    sub: string;
    email?: string;
  };

  // Validate standard JWT claims before touching the signature
  if (payload.iss !== "https://appleid.apple.com") {
    throw new Error(`Apple identity token: invalid issuer "${payload.iss}"`);
  }
  if (Math.floor(Date.now() / 1000) > payload.exp) {
    throw new Error("Apple identity token: token has expired");
  }
  const clientId = process.env.APPLE_CLIENT_ID;
  if (clientId && payload.aud !== clientId) {
    throw new Error(
      `Apple identity token: audience mismatch (got "${payload.aud}", expected "${clientId}")`,
    );
  }

  // Find the matching public key by kid; retry once after a cache bust in case
  // Apple has rotated keys since our last fetch.
  let keys = await fetchAppleJwks();
  let jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) {
    _jwksCache = null;
    keys = await fetchAppleJwks();
    jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) {
      throw new Error(
        `Apple identity token: no JWKS key found for kid="${header.kid}"`,
      );
    }
  }

  return _verifyTokenWithKey(jwk, headerB64, payloadB64, sigB64, payload);
}

// ─────────────────────────────────────────────────────────────────────────────

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
  // Support both literal newlines and \n-escaped keys stored in env vars
  const pem = privateKey.replace(/\\n/g, "\n");
  // ES256 requires JOSE/P1363 (raw r||s) signature encoding, not DER.
  // crypto.sign() with dsaEncoding:"ieee-p1363" produces the correct format.
  const sigBuf = cryptoSign("sha256", Buffer.from(signingInput), {
    key: pem,
    dsaEncoding: "ieee-p1363",
  });
  const signature = sigBuf.toString("base64url");

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
