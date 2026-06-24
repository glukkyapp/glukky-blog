import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcrypt";
import { authStorage } from "./storage";
import { exchangeAuthCodeForRefreshToken } from "../../apple-auth";
import { storage } from "../../storage";
import { pool } from "../../db";

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

  app.post("/api/auth/register", async (req, res) => {
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

  app.post("/api/auth/login", async (req, res) => {
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
  app.post("/api/auth/apple-signin", async (req, res) => {
    try {
      const { subject, email, authorizationCode, givenname, familyname } = req.body;
      if (!subject) {
        return res.status(400).json({ message: "Apple subject is required" });
      }

      let user = await authStorage.getUserByAppleId(subject);

      if (!user && email) {
        // Not found by Apple ID — check if an email-registered account already exists.
        // If so, link the Apple ID to it rather than creating a duplicate.
        const existingByEmail = await authStorage.getUserByEmail(email.toLowerCase());
        if (existingByEmail) {
          await authStorage.linkAppleIdToUser(existingByEmail.id, subject);
          user = existingByEmail;
          console.log(`[apple-signin] Linked apple_id to existing email account user=${existingByEmail.id}`);
        }
      }

      if (!user) {
        // Genuinely new Apple user — create account silently, no error shown to UI
        user = await authStorage.createAppleUser(subject, email || undefined);
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
      try {
        if (displayName) {
          // Upsert into cache whenever Apple does provide the name
          await pool.query(
            `INSERT INTO apple_name_cache (subject, display_name, cached_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (subject) DO UPDATE SET display_name = EXCLUDED.display_name, cached_at = NOW()`,
            [subject, displayName]
          );
        } else {
          // Apple didn't send a name (re-registration path) — try the cache
          const cacheRow = await pool.query<{ display_name: string }>(
            `SELECT display_name FROM apple_name_cache WHERE subject = $1`,
            [subject]
          );
          if (cacheRow.rows.length > 0) {
            displayName = cacheRow.rows[0].display_name;
            console.log(`[apple-signin] Restored name from cache for subject=${subject}: "${displayName}"`);
          }
        }
      } catch (e: any) {
        console.warn(`[apple-signin] apple_name_cache operation failed: ${e?.message ?? e}`);
      }
      if (displayName) {
        try {
          const existing = await storage.getProfile(user.id);
          if (existing) {
            if (!existing.name?.trim()) {
              await storage.updateProfile(user.id, { name: displayName });
            }
          } else {
            await storage.createProfile({ userId: user.id, name: displayName });
          }
        } catch (e: any) {
          // Best-effort: never block sign-in due to profile name write failure
          console.warn(`[apple-signin] Profile name write failed for user=${user.id}: ${e?.message ?? e}`);
        }
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
