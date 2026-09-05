# External Identity, Billing, and Email Data Flows

This appendix covers every RevenueCat and Apple network operation and the configured password-reset email provider. Secret values and personal literals are intentionally redacted.

## RevenueCat

All RevenueCat requests use `https://api.revenuecat.com/v1`. Server authentication is `Authorization: Bearer ${REVENUECAT_SECRET_API_KEY}`; the key remains server-side.

| Function/location | Endpoint/method | Request fields and identifiers | Response fields read | Callsite(s) | Retention and logging |
|---|---|---|---|---|---|
| `verifyEntitlement`, `server/revenuecat.ts:96-195` | `GET /subscribers/{encodeURIComponent(appUserId)}` | App user ID in URL; `Accept: application/json`; bearer key | `subscriber.entitlements[*].expires_date/product_identifier`; `subscriptions[*].expires_date/unsubscribe_detected_at/store/period_type`; `original_app_user_id`; response type also permits `management_url` and `subscriber_attributes` | `server/routes.ts:3910,3921,3988,4140` | Caches `hasPremium` and `originalAppUserId` in process memory for 30 seconds. Logs app user ID, entitlement/subscription names and expiry, premium boolean, original app user ID, HTTP/parse errors. It does not log the bearer key. |
| `deleteSubscriber`, `server/revenuecat.ts:213-244` | `DELETE /subscribers/{encodeURIComponent(appUserId)}` | App user ID in URL; `Accept`; bearer key | HTTP status; up to 200 response-body characters on failure | `server/storage.ts:487` through account deletion | Clears local cache. Logs raw app user ID, HTTP status, and short failure text. Failure text could contain provider/account metadata. |
| `fetchSubscriberRaw`, `server/revenuecat.ts:250-276` | `GET /subscribers/{encodeURIComponent(appUserId)}` | Bridge/customer app user ID in URL; `Accept`; bearer key | Full parsed subscriber response, including entitlements, subscriptions, original ID, management URL, and subscriber attributes such as `$email` | `server/routes.ts:3961` in delete/reinstall self-heal | No module-level persistence/cache. Caller extracts `$email`, lowercases it, and compares it with the authenticated user's email before aliasing. Errors log raw app user ID and status/message, not the parsed email. |
| `aliasSubscriber`, `server/revenuecat.ts:294-322` | `POST /subscribers/{encodeURIComponent(fromAppUserId)}/alias` | Source app user ID in URL; JSON `{new_app_user_id:toAppUserId}`; `Accept`; `Content-Type`; `X-Platform:"ios"`; bearer key | HTTP status; up to 200 response-body characters on failure | `server/routes.ts:3980` after entitlement and email equality checks | No local persistence in this function. Caller logs source/customer and target user identifiers and result. Returned failure text can propagate into internal outcome strings. |

### RevenueCat data conclusion

RevenueCat receives application user/customer identifiers and purchase-account linkage. Its subscriber response may contain an email attribute and entitlement/subscription metadata. The raw response remains in request memory; only premium state and trusted customer/original IDs are persisted or briefly cached. Raw identifiers and entitlement summaries are logged and should be pseudonymised.

## Apple

| Function/location | Endpoint/method | Request fields and identifiers | Response fields read | Callsite(s) | Retention and logging |
|---|---|---|---|---|---|
| `fetchAppleJwks`, `server/apple-auth.ts:23-35` | `GET https://appleid.apple.com/auth/keys` | No user data or credential | Public JWK fields `kty`, `kid`, `use`, `alg`, `n`, `e` | `verifyAppleIdentityToken`, called at `server/replit_integrations/auth/replitAuth.ts:234` | Public keys cached in memory for one hour. The user's identity token is verified locally and is not sent to Apple by this operation. |
| `exchangeAuthCodeForRefreshToken`, `server/apple-auth.ts:189-224` | `POST https://appleid.apple.com/auth/token` | Form: `client_id`, generated signed `client_secret`, one-time `code`, `grant_type:"authorization_code"` | `refresh_token` | `server/replit_integrations/auth/replitAuth.ts:334` | Returned refresh token is persisted on the user record for later revocation. On non-OK, up to the complete Apple error response is included in the thrown error and may reach logs at the caller; client secret and auth code are not intentionally logged. |
| `revokeAppleRefreshToken`, `server/apple-auth.ts:232-260` | `POST https://appleid.apple.com/auth/revoke` | Form: `client_id`, generated signed `client_secret`, stored `refreshToken`, `token_type_hint:"refresh_token"` | HTTP success/status only | `server/storage.ts:495` during account deletion | No new retention. Logs only thrown error message. Account-deletion summary logs `hadToken` as a boolean, not the token. |

### Apple data conclusion

Apple receives its one-time authorization code and later its refresh token, plus the app's client identity and signed client secret. Identity JWT verification is local apart from downloading public signing keys. The stored Apple subject, email/name fields, and request IP are logged elsewhere in the sign-in route; the critical unverified-subject fallback remains the primary authentication finding.

## Password-reset email provider

The provider is configured through the installed Replit Resend connector. No direct API key is handled by application code.

| Function/location | Provider operation | Exact outbound fields | Callsite | Retention and logging |
|---|---|---|---|---|
| `sendPasswordResetEmail`, `server/replit_integrations/auth/password-reset.ts:75-101` | `new ReplitConnectors().proxy("resend", "/emails", {method:"POST", body})` | `from:PASSWORD_RESET_FROM_EMAIL`; `to:[recipient]`; subject; plaintext body; HTML body. Both bodies contain an HTTPS reset URL with the raw one-time reset token and state it expires in 30 minutes. | `server/replit_integrations/auth/replitAuth.ts:81`, only after a token is committed for an eligible account | Resend necessarily receives recipient email and raw reset URL/token. Application stores only the token digest and expiry; provider retention is governed by Resend/Replit connector policy, not this code. Provider response body is deliberately not logged. Route logs only a generic delivery failure and always returns the same generic message. |

## Tracked personal-data literals

Repository search found literal personal or account-specific identifiers in tracked source. Exact values are redacted here, but remain visible in the repository:

| Location | Literal category | Use/risk |
|---|---|---|
| `server/routes.ts:1324` | Three personal email addresses | Development-user allowlist |
| `server/routes.ts:1488-1492` | Five production/test UUIDs with email comments | Unlimited FoodSnap quota allowlist; bypasses normal cost/abuse limits for listed accounts |
| `server/posthog.ts:9-12` | Production UUIDs with personal-email comments | Internal analytics suppression |
| `server/comp-emails.ts:3-7` | Personal/staff emails | Complimentary-account entitlement logic |
| `server/glucose-pattern-swipe-tutorial.ts:1` | Test email | Development-only tutorial reset |
| `client/src/App.tsx:1763` | Personal emails | Client text-selection allowlist; shipped to clients |
| `client/src/lib/posthog.ts:7` | Personal email | Client analytics suppression; shipped to clients |
| `scripts/seed-glucose-pattern-test-data.ts`, `scripts/wipe-glukkysugarapp.mjs`, `scripts/reset-premium-yellowwmeowwww.mjs` | Test/production email literals | Account-specific operational scripts; tracked PII and accidental-targeting risk |

These are not authentication secrets, but they are repository PII and brittle authorization/configuration. Move privileged/staff identities to role data or protected configuration, remove email comments from UUID lists, and require explicit target confirmation in account-specific scripts.