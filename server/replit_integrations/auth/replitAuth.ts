import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcrypt";
import { authStorage } from "./storage";
import { exchangeAuthCodeForRefreshToken, verifyAppleIdentityToken } from "../../apple-auth";
import { storage } from "../../storage";
import { pool } from "../../db";
import {
  authLimiter,
  passwordResetConfirmIpLimiter,
  passwordResetConfirmTokenLimiter,
  passwordResetRequestAccountLimiter,
  passwordResetRequestIpLimiter,
} from "../../rate-limiters";
import {
  doResetTimingWork,
  hashPasswordForReset,
  isValidEmail,
  issuePasswordResetToken,
  normalizeEmail,
  PASSWORD_RESET_GENERIC_MESSAGE,
  PASSWORD_RESET_INVALID_MESSAGE,
  PASSWORD_RESET_MIN_PASSWORD_LENGTH,
  performPasswordReset,
  sendPasswordResetEmail,
  waitForMinimumResetResponse,
} from "./password-reset";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  app.post(
    "/api/auth/password-reset/request",
    passwordResetRequestIpLimiter,
    passwordResetRequestAccountLimiter,
    async (req, res) => {
      const startedAt = Date.now();
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Referrer-Policy", "no-referrer");

      try {
        const email = normalizeEmail(req.body?.email);
        const eligible = isValidEmail(email);
        const issued = eligible ? await issuePasswordResetToken(email) : null;

        if (issued) {
          // TODO(password-reset-email): Keep this provider call after the
          // committed token write and before the generic response. Delivery
          // failures intentionally leave the token available until expiry.
          try {
            await sendPasswordResetEmail(email, issued.rawToken);
          } catch {
            // Never reveal delivery/configuration failures or log the address,
            // token, reset URL, or provider response.
            console.error("[password-reset] email delivery failed");
          }
        } else {
          // Equalise the obvious unknown/malformed-account timing path without
          // storing any token for an ineligible account.
          await doResetTimingWork();
        }

        await waitForMinimumResetResponse(startedAt);
        return res.json({ message: PASSWORD_RESET_GENERIC_MESSAGE });
      } catch {
        await doResetTimingWork().catch(() => {});
        await waitForMinimumResetResponse(startedAt);
        return res.json({ message: PASSWORD_RESET_GENERIC_MESSAGE });
      }
    },
  );

  app.post(
    "/api/auth/password-reset/confirm",
    passwordResetConfirmIpLimiter,
    passwordResetConfirmTokenLimiter,
    async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Referrer-Policy", "no-referrer");

      const token = typeof req.body?.token === "string" ? req.body.token : "";
      const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
      const confirmPassword =
        typeof req.body?.confirmPassword === "string" ? req.body.confirmPassword : "";

      if (!token || !newPassword || !confirmPassword) {
        return res.status(400).json({ message: "Token, new password, and confirmation are required" });
      }
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: "Passwords do not match" });
      }
      if (newPassword.length < PASSWORD_RESET_MIN_PASSWORD_LENGTH) {
        return res.status(400).json({
          message: `Password must be at least ${PASSWORD_RESET_MIN_PASSWORD_LENGTH} characters`,
        });
      }

      try {
        // Hashing happens before the DB transaction; all three database
        // mutations remain inside performPasswordReset's transaction.
        const newPasswordHash = await hashPasswordForReset(newPassword);
        const reset = await performPasswordReset(token, newPasswordHash);
        if (!reset) {
          return res.status(400).json({ message: PASSWORD_RESET_INVALID_MESSAGE });
        }

        // The transaction removes every session row. Clearing this browser's
        // cookie also handles a reset link opened in an already-signed-in tab.
        res.clearCookie("connect.sid");
        return res.json({ message: "Password reset successfully" });
      } catch {
        return res.status(500).json({ message: "Password reset failed" });
      }
    },
  );

  app.post("/api/auth/register", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      const existing = await authStorage.getUserByEmail(email.toLowerCase());
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await authStorage.createUser(email.toLowerCase(), hashedPassword);

      req.session.userId = user.id;
      return res.json({ id: user.id, email: user.email });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await authStorage.getUserByEmail(email.toLowerCase());
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Apple-only accounts have no password hash — reject email login attempts for them
      if (!user.password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      req.session.userId = user.id;
      return res.json({ id: user.id, email: user.email });
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Login failed" });
    }
  });

  // Apple Sign In — unified login + silent register
  app.post("/api/auth/apple-signin", authLimiter, async (req, res) => {
    try {
      const { identityToken, email, authorizationCode, givenname, familyname } = req.body;

      // SECURITY NOTE — TEMPORARY FALLBACK (tracked, not permanent):
      // The correct flow is to verify the RS256-signed identityToken Apple
      // issues on every sign-in against Apple's public JWKS, and derive `sub`
      // from the verified payload — never from the client-supplied `subject`
      // field, which cannot be authenticated and would allow impersonation.
      //
      // The current iOS bridge does NOT yet send identityToken. Until the iOS
      // app is updated and that version is live, we fall back to the
      // client-supplied `subject`. Every such unauthenticated login emits a
      // [TEMP-SECURITY] warning so the state is visible in production logs.
      //
      // Stage 3: once the new iOS build is live, remove the fallback block
      // below and restore the hard requirement + 400 on missing token.

      let subject: string;
      let resolvedEmail: string | undefined;

      if (identityToken && typeof identityToken === "string") {
        // Preferred path — verify token cryptographically.
        let verifiedSub: string;
        let verifiedEmail: string | undefined;
        try {
          const verified = await verifyAppleIdentityToken(identityToken);
          verifiedSub = verified.sub;
          verifiedEmail = verified.email;
        } catch (verifyErr: any) {
          console.warn(`[apple-signin] identity token verification failed: ${verifyErr?.message ?? verifyErr}`);
          return res.status(401).json({ message: "Apple identity token verification failed" });
        }
        subject = verifiedSub;
        // Use the email Apple provides in the token (first sign-in only); fall
        // back to the body email only when the token itself carries none.
        resolvedEmail = verifiedEmail || (typeof email === "string" ? email : undefined);
      } else {
        // [TEMP-SECURITY] Fallback: no identityToken supplied by iOS bridge.
        // Trusting client-supplied subject without cryptographic verification.
        // Remove this block once iOS app sends identityToken on every sign-in.
        const clientSubject = req.body.subject;
        if (!clientSubject || typeof clientSubject !== "string") {
          return res.status(400).json({ message: "Apple sign-in requires either identityToken or subject" });
        }
        console.warn(`[TEMP-SECURITY] apple-signin without identityToken — subject=${clientSubject} ip=${req.ip}. iOS bridge must be updated to send identityToken.`);
        subject = clientSubject;
        resolvedEmail = typeof email === "string" ? email : undefined;
      }
      let user = await authStorage.getUserByAppleId(subject);

      if (!user && resolvedEmail) {
        // Not found by Apple ID — check if an email-registered account already exists.
        // If so, link the Apple ID to it rather than creating a duplicate.
        const existingByEmail = await authStorage.getUserByEmail(resolvedEmail.toLowerCase());
        if (existingByEmail) {
          await authStorage.linkAppleIdToUser(existingByEmail.id, subject);
          user = existingByEmail;
          console.log(`[apple-signin] Linked apple_id to existing email account user=${existingByEmail.id}`);
        }
      }

      if (!user) {
        // Genuinely new Apple user — create account silently, no error shown to UI
        user = await authStorage.createAppleUser(subject, resolvedEmail);
      }

      // Write Apple name to the profile for all resolution paths (found by apple_id,
      // linked to email account, or newly created), but only if the profile has no
      // name yet — never overwrite a name the user already set.
      //
      // Apple only sends givenname/familyname on the VERY FIRST authorization.
      // After account deletion + re-registration, Apple sends no name.
      // We persist the name in apple_name_cache (keyed by subject, never deleted)
      // so re-registered users still get the greeting.
      let displayName = [givenname, familyname].filter(Boolean).join(" ").trim();
      console.log(`[apple-signin] name fields from bridge: givenname=${JSON.stringify(givenname)} familyname=${JSON.stringify(familyname)} → displayName=${JSON.stringify(displayName)} subject=${subject}`);
      try {
        if (displayName) {
          // Upsert into cache whenever Apple does provide the name
          await pool.query(
            `INSERT INTO apple_name_cache (subject, display_name, cached_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (subject) DO UPDATE SET display_name = EXCLUDED.display_name, cached_at = NOW()`,
            [subject, displayName]
          );
          console.log(`[apple-signin] cached name="${displayName}" for subject=${subject}`);
        } else {
          // Apple didn't send a name (re-registration path) — try the cache
          const cacheRow = await pool.query<{ display_name: string }>(
            `SELECT display_name FROM apple_name_cache WHERE subject = $1`,
            [subject]
          );
          if (cacheRow.rows.length > 0) {
            displayName = cacheRow.rows[0].display_name;
            console.log(`[apple-signin] Restored name from cache for subject=${subject}: "${displayName}"`);
          } else {
            console.log(`[apple-signin] cache miss — no name for subject=${subject}`);
          }
        }
      } catch (e: any) {
        console.warn(`[apple-signin] apple_name_cache operation failed: ${e?.message ?? e}`);
      }
      try {
        const existing = await storage.getProfile(user.id);
        if (existing) {
          console.log(`[apple-signin] profile exists for user=${user.id} existing.name=${JSON.stringify(existing.name)}`);
          if (displayName && !existing.name?.trim()) {
            await storage.updateProfile(user.id, { name: displayName });
            console.log(`[apple-signin] wrote name="${displayName}" to existing profile user=${user.id}`);
          } else {
            console.log(`[apple-signin] skipped name write: displayName=${JSON.stringify(displayName)} existing.name=${JSON.stringify(existing.name)}`);
          }
        } else {
          console.log(`[apple-signin] no profile yet for user=${user.id} — creating with name=${JSON.stringify(displayName || undefined)}`);
          await storage.createProfile({ userId: user.id, name: displayName || undefined });
        }
      } catch (e: any) {
        // Best-effort: never block sign-in due to profile ensure failure
        console.warn(`[apple-signin] Profile ensure failed for user=${user.id}: ${e?.message ?? e}`);
      }

      // Exchange the one-time authorizationCode for a refresh token so we can
      // revoke it if the user later deletes their account (Apple §5.1.1).
      // Best-effort: failure must never prevent sign-in.
      if (authorizationCode) {
        exchangeAuthCodeForRefreshToken(authorizationCode)
          .then((refreshToken) => {
            if (refreshToken) {
              return authStorage.storeAppleRefreshToken(user!.id, refreshToken);
            }
          })
          .catch((e: any) => {
            console.warn(
              `[apple-signin] Token exchange failed for user=${user!.id}: ${e?.message ?? e}`,
            );
          });
      }

      // req.session.userId matches exactly what /api/auth/login writes
      req.session.userId = user.id;
      return res.json({ id: user.id, email: user.email ?? null });
    } catch (error) {
      console.error("Apple sign-in error:", error);
      return res.status(500).json({ message: "Apple sign-in failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      return res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const user = await authStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      return res.json({ id: user.id, email: user.email });
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  (req as any).user = { claims: { sub: req.session.userId } };
  next();
};
