/**
 * Focused password-reset security and regression checks.
 *
 * Run with: npx tsx tests/password-reset.test.mts
 */

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  buildResetUrl,
  generateResetToken,
  hashResetToken,
  PASSWORD_RESET_TTL_MS,
  performPasswordResetWithClient,
} from "../server/replit_integrations/auth/password-reset";

let passed = 0;
function check(label: string, condition: boolean): void {
  assert.equal(condition, true, label);
  console.log(`  ✓ ${label}`);
  passed += 1;
}

const authSource = readFileSync("server/replit_integrations/auth/replitAuth.ts", "utf8");
const serviceSource = readFileSync("server/replit_integrations/auth/password-reset.ts", "utf8");
const migrationSource = readFileSync("server/startup-migrations.ts", "utf8");
const resetPageSource = readFileSync("client/src/pages/password-reset.tsx", "utf8");
const appSource = readFileSync("client/src/App.tsx", "utf8");
const landingSource = readFileSync("client/src/pages/landing.tsx", "utf8");
const staticSource = readFileSync("server/static.ts", "utf8");
const viteSource = readFileSync("server/vite.ts", "utf8");

console.log("Password reset");

const first = generateResetToken(new Date("2026-01-01T00:00:00.000Z"));
const second = generateResetToken(new Date("2026-01-01T00:00:00.000Z"));
check("tokens contain exactly 32 random bytes", Buffer.from(first.rawToken, "base64url").length === 32);
check("tokens are independently random", first.rawToken !== second.rawToken);
check("only a 64-character SHA-256 digest is retained", first.tokenHash.length === 64 && first.tokenHash === hashResetToken(first.rawToken));
check("token expiry is exactly 30 minutes", first.expiresAt.getTime() === Date.parse("2026-01-01T00:30:00.000Z") && PASSWORD_RESET_TTL_MS === 1_800_000);
check(
  "reset links keep the raw token in a URL fragment",
  buildResetUrl("https://glukky.com/", "abc_123") === "https://glukky.com/#reset_token=abc_123",
);

check(
  "persistence includes expiry, use, creation, user, and hashed-token fields",
  /CREATE TABLE IF NOT EXISTS password_reset_tokens[\s\S]*user_id[\s\S]*token_hash[\s\S]*expires_at[\s\S]*used_at[\s\S]*created_at/.test(migrationSource),
);
check(
  "a newer request invalidates every older unused token",
  /DELETE FROM password_reset_tokens[\s\S]*user_id = \$1 AND used_at IS NULL/.test(serviceSource),
);
check(
  "Apple-only accounts cannot receive reset tokens",
  /WHERE email = \$1 AND password IS NOT NULL/.test(serviceSource),
);
check(
  "request responses stay generic across success and failure paths",
  (authSource.match(/PASSWORD_RESET_GENERIC_MESSAGE/g) || []).length >= 3
    && !/res\.(?:json|status)[^\n]*(?:unknown|registered|Apple-only)/i.test(authSource),
);
check(
  "email delivery is awaited after token persistence and does not delete a failed-delivery token",
  /issuePasswordResetToken\(email\)[\s\S]*await sendPasswordResetEmail\(email, issued\.rawToken\)/.test(authSource)
    && !/catch[\s\S]{0,300}DELETE FROM password_reset_tokens/.test(authSource),
);
check(
  "the request route has the required future email-send marker",
  authSource.includes("TODO(password-reset-email)"),
);
check(
  "request and confirmation use separate IP and account/token rate limiters",
  authSource.includes("passwordResetRequestIpLimiter")
    && authSource.includes("passwordResetRequestAccountLimiter")
    && authSource.includes("passwordResetConfirmIpLimiter")
    && authSource.includes("passwordResetConfirmTokenLimiter"),
);

type QueryResult = { rows: any[]; rowCount?: number | null };
type FakeStep = QueryResult | Error;

class FakeClient {
  readonly statements: string[] = [];
  private step = 0;

  constructor(private readonly steps: FakeStep[]) {}

  async query(text: string): Promise<QueryResult> {
    const compact = text.replace(/\s+/g, " ").trim();
    this.statements.push(compact);
    if (compact === "BEGIN" || compact === "COMMIT" || compact === "ROLLBACK") {
      return { rows: [], rowCount: null };
    }
    const next = this.steps[this.step++];
    if (next instanceof Error) throw next;
    return next ?? { rows: [], rowCount: 0 };
  }
}

const successClient = new FakeClient([
  { rows: [{ id: "token-id", user_id: "user-id" }], rowCount: 1 },
  { rows: [], rowCount: 1 },
  { rows: [], rowCount: 1 },
  { rows: [], rowCount: 2 },
]);
const success = await performPasswordResetWithClient(
  successClient as any,
  "raw-token",
  "new-password-hash",
);
check("a valid reset commits successfully", success && successClient.statements.at(-1) === "COMMIT");
check(
  "token consumption is conditional and locked against concurrent reuse",
  successClient.statements.some((sql) => sql.includes("FOR UPDATE"))
    && successClient.statements.some((sql) => sql.includes("used_at IS NULL") && sql.includes("expires_at > NOW()")),
);
check(
  "password replacement and exact-session deletion are in the same transaction",
  successClient.statements.some((sql) => sql.startsWith("UPDATE users SET password"))
    && successClient.statements.some((sql) => sql.includes("DELETE FROM sessions") && sql.includes("sess ->> 'userId' = $1")),
);

const replayClient = new FakeClient([{ rows: [], rowCount: 0 }]);
const replay = await performPasswordResetWithClient(replayClient as any, "used-or-expired", "hash");
check("expired or replayed tokens fail and roll back", replay === false && replayClient.statements.at(-1) === "ROLLBACK");

const rollbackClient = new FakeClient([
  { rows: [{ id: "token-id", user_id: "user-id" }], rowCount: 1 },
  { rows: [], rowCount: 1 },
  new Error("simulated user update failure"),
]);
await assert.rejects(
  performPasswordResetWithClient(rollbackClient as any, "raw-token", "hash"),
  /simulated user update failure/,
);
check(
  "a password-update failure rolls back token consumption",
  rollbackClient.statements.at(-1) === "ROLLBACK" && !rollbackClient.statements.includes("COMMIT"),
);

check(
  "the reset screen reads and immediately strips the fragment",
  resetPageSource.includes('new URLSearchParams(hash).get("reset_token")')
    && resetPageSource.includes("window.history.replaceState"),
);
check(
  "the reset screen submits secrets only in a POST JSON body",
  resetPageSource.includes('method: "POST"')
    && resetPageSource.includes("JSON.stringify({ token, newPassword, confirmPassword })")
    && !resetPageSource.includes("?reset_token="),
);
check(
  "the reset route bypasses normal routing and PostHog initialization",
  /function AppWithProviders\(\)[\s\S]*if \(passwordResetFlow\)[\s\S]*<PasswordReset \/>[\s\S]*<OfflineProvider>/.test(appSource)
    && /function App\(\)[\s\S]*initPostHog/.test(appSource)
    && !resetPageSource.includes("@/lib/posthog"),
);
check(
  "the login UI exposes the reset request flow",
  landingSource.includes('data-testid="button-forgot-password"')
    && landingSource.includes("/api/auth/password-reset/request"),
);
check(
  "HTML responses disable caching and referrer leakage in dev and production",
  staticSource.includes('res.setHeader("Cache-Control", "no-store")')
    && staticSource.includes('res.setHeader("Referrer-Policy", "no-referrer")')
    && viteSource.includes('"Referrer-Policy": "no-referrer"'),
);
check(
  "service logs never interpolate reset tokens, URLs, passwords, or recipients",
  !/console\.(?:log|warn|error)\([^)]*(?:rawToken|resetUrl|recipient|newPassword)/.test(serviceSource + authSource),
);

console.log(`\n${passed} passed`);