import { rateLimit } from "express-rate-limit";
import { createHash } from "node:crypto";

/**
 * Auth endpoints: login, register, apple-signin.
 * 10 attempts per 15-minute window per IP.
 * Covers credential-stuffing and account-enumeration attacks.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7", // sets RateLimit-* and Retry-After headers
  legacyHeaders: false,
  message: { message: "Too many requests — please try again later." },
});

const resetGenericMessage = {
  message: "If the account exists, please check your email for a reset link.",
};

export const passwordResetRequestIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: resetGenericMessage,
});

export const passwordResetRequestAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: (req: any) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    return createHash("sha256").update(email).digest("hex");
  },
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: resetGenericMessage,
});

export const passwordResetConfirmIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many reset attempts. Please request a new link later." },
});

export const passwordResetConfirmTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req: any) => {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    return createHash("sha256").update(token).digest("hex");
  },
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many reset attempts. Please request a new link later." },
});

/**
 * Admin endpoints: wipe-user, enroll-pilot.
 * 5 attempts per 15-minute window per IP.
 * Adds a second layer of friction on top of the timing-safe secret check.
 */
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many admin requests — please try again later." },
});

/**
 * AI snap endpoints: label, advice, disambiguate.
 * 30 requests per hour, keyed by authenticated user ID (not IP) so
 * proxies or shared networks don't penalise other users.
 * 30/hour comfortably covers a user photographing every meal across a
 * full day with retries.
 */
export const aiSnapLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  // All three AI routes are behind isAuthenticated, so sub is always present.
  // "unauthenticated" is a safe fallback that avoids IPv6 handling complexity.
  keyGenerator: (req: any) => req.user?.claims?.sub ?? "unauthenticated",
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "AI request limit reached — please try again in an hour." },
});
