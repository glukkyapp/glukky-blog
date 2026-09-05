# Exhaustive Third-Party Outbound Call Inventory

## PostHog wrappers

| Location | Outbound operation | Exact payload |
|---|---|---|
| `client/src/lib/posthog.ts:47-52` | queued `identify` | `identify(p.id, sanitise(p.properties))`, then `setPersonProperties(clean)` |
| `client/src/lib/posthog.ts:55-57` | queued `capture` | `capture(p.eventName, sanitise(p.properties))` |
| `client/src/lib/posthog.ts:58-74` | queued exception | native `captureException(err, cleanCtx)` or `$exception` with `$exception_message`, `$exception_type`, `$exception_stack_trace_raw`, and context |
| `client/src/lib/posthog.ts:104-117` | initialization and automatic events | `api_host:"https://us.i.posthog.com"`, `capture_pageview:"history_change"`, `capture_pageleave:true`, `autocapture:false`, `disable_session_recording:true`, `session_recording:{maskAllInputs:true}`, `persistence:"localStorage+cookie"`, `debug:import.meta.env.DEV`; `loaded` sets `initialized` and flushes pending events |
| `client/src/lib/posthog.ts:122-144` | `identifyUser` | `identify(id, clean)` and optional `setPersonProperties(clean)` |
| `client/src/lib/posthog.ts:146-159` | person properties | `setPersonProperties(clean)` |
| `client/src/lib/posthog.ts:161-171` | reset | `reset()` |
| `client/src/lib/posthog.ts:173-187` | event | `capture(eventName, clean)` |
| `client/src/lib/posthog.ts:189-216` | exception | native `captureException(err, clean)` or `$exception` message/type/raw stack/context |
| `server/posthog.ts:59-77` | server event | `{distinctId:sha256(userId) or "server",event,properties:sanitise(properties)}` |
| `server/posthog.ts:79-107` | server exception | native `captureException(err, hashedId, cleanCtx)` or `{distinctId,event:"$exception",properties:{$exception_message,$exception_type,$exception_stack_trace_raw,...cleanCtx}}` |

All property blocklists are shallow. The raw exception message and stack paths are sensitive-data risks.

Because `capture_pageview:"history_change"` and `capture_pageleave:true` are enabled, the PostHog SDK also emits automatic `$pageview` and `$pageleave` events on navigation/exit. SDK-generated page context can include the current URL, path, host, referrer, page title, and browser/screen metadata; these automatic fields do not pass through this application's `sanitise()` wrapper. URL query strings are security-sensitive: a password-reset page URL can contain the one-time reset token. PostHog identity/event state persists in browser `localStorage` and cookies rather than memory only. Autocapture and session recording remain disabled.

## Every PostHog application callsite

| Location | Event/operation | Properties supplied |
|---|---|---|
| `server/routes.ts:2233` | `snap_label_succeeded_server` | `source:"food_label"`, `isFirstSnap` |
| `server/routes.ts:2288` | `snap_label_succeeded_server` | `source:"combos"`, `isFirstSnap` |
| `server/routes.ts:2341` | `snap_label_succeeded_server` | `source:"claude"`, `isFirstSnap` |
| `server/routes.ts:2355` | exception | `route`, `method`, raw error |
| `server/routes.ts:2596` | `glucose_pattern_unlocked` | `totalSnaps` |
| `server/routes.ts:2625` | `glucose_pattern_unlocked` | `totalSnaps` |
| `server/routes.ts:2874` | `snap_advice_succeeded_server` | `adviceSource`, `isFirstSnap` |
| `server/routes.ts:2883` | `glucose_pattern_unlocked` | `totalSnaps` |
| `server/routes.ts:2898` | exception | `route`, `method`, raw error |
| `server/routes.ts:4068` | exception | `route`, `method`, raw error |
| `server/routes.ts:4151` | `revenuecat_webhook_processed` | `eventType`, `hasPremium`, `changed` |
| `server/routes.ts:4156` | `subscription_started` | none |
| `server/routes.ts:4162` | exception | `route`, `method`; consent forced false, therefore suppressed |
| `server/routes.ts:4304` | `glucose_pattern_personalized_unlocked` | `readingCount` |
| `server/index.ts:102` | exception | `path`, `method`, `status`, raw error |
| `client/src/components/PostMealCard.tsx:237` | `glucose_completed` | `recorded:true` |
| `client/src/App.tsx:549` | `snap_advice_resumed_via_background_poller` | resume state |
| `client/src/App.tsx:763,779,791` | `paywall_dismiss_route` | dismissal route/reason |
| `client/src/App.tsx:805` | `paywall_exit_warning_backdrop_shown` | none |
| `client/src/App.tsx:813` | `paywall_exit_warning_shown` | warning state |
| `client/src/App.tsx:823` | `paywall_exit_warning_post_failed` | failure state |
| `client/src/App.tsx:835` | `paywall_exit_warning_backdrop_hidden` | `reason:"post_failed"` |
| `client/src/App.tsx:846` | `paywall_shown` | none |
| `client/src/App.tsx:853` | `paywall_dismissed` | `reason:"bridge_missing"` |
| `client/src/App.tsx:887` | `paywall_dismissed` | `status`, `message` |
| `client/src/App.tsx:898` | `paywall_error` | error `message` |
| `client/src/App.tsx:911` | `paywall_exit_warning_stay` | none |
| `client/src/App.tsx:915` | `paywall_exit_warning_stay_error` | error `message` |
| `client/src/App.tsx:928` | `paywall_exit_warning_backdrop_hidden` | `reason:"stay"` |
| `client/src/App.tsx:937` | `paywall_exit_warning_leave` | none |
| `client/src/App.tsx:946` | `paywall_exit_warning_backdrop_hidden` | `reason:"leave"` |
| `client/src/App.tsx:961` | `paywall_exit_warning_backdrop_hidden` | `reason:"cleanup"` |
| `client/src/App.tsx:983` | identify | `currentId`; supplied profile properties are sanitised |
| `client/src/App.tsx:1058` | `paywall_lockapp_purchase_attempt` | `outcome` |
| `client/src/App.tsx:1060` | paywall lock event | purchase status/outcome |
| `client/src/App.tsx:1070` | `paywall_lockapp_not_presented` | none |
| `client/src/App.tsx:1072` | paywall lock event | presentation status |
| `client/src/App.tsx:1081` | `paywall_lockapp_error` | error message |
| `client/src/pages/onboarding.tsx:82` | `onboarding_step_viewed` | `step` |
| `client/src/pages/onboarding.tsx:173` | `onboarding_completed` | `onboardingProperties` |
| `client/src/pages/onboarding.tsx:174` | person properties | `onboardingProperties` |
| `client/src/pages/onboarding.tsx:183` | `onboarding_submit_failed` | none |
| `client/src/pages/onboarding.tsx:184` | exception | `phase:"onboarding_submit"`, raw error |
| `client/src/pages/snap.tsx:240` | `snap_label_failed` | `reason:"rate_limited"`, `limit` |
| `client/src/pages/snap.tsx:256` | `snap_label_failed` | `reason:code` |
| `client/src/pages/snap.tsx:269` | `snap_label_failed` | `reason:"consent_blocked"` |
| `client/src/pages/snap.tsx:277` | `snap_label_failed` | `reason:"http_error"`, `status` |
| `client/src/pages/snap.tsx:285` | `snap_label_blocked` | `feature` |
| `client/src/pages/snap.tsx:293` | `snap_label_succeeded` | source/result metadata |
| `client/src/pages/snap.tsx:297` | `onboarding_first_snap_completed` | none |
| `client/src/pages/snap.tsx:303` | `snap_label_failed` | `reason:"exception"` |
| `client/src/pages/snap.tsx:304` | exception | `phase:"snap_label"`, raw error |
| `client/src/pages/snap.tsx:389` | `snap_started` | `language` |
| `client/src/pages/snap.tsx:680` | `food_label_accepted` | none |
| `client/src/pages/snap.tsx:683` | `food_label_amended` | `field`, `method` |
| `client/src/pages/snap.tsx:694` | `snap_advice_started` | `foodName`; removed by blocked-key sanitizer |
| `client/src/pages/snap.tsx:725` | `snap_advice_failed` | `reason:"rate_limited"`, `limit` |
| `client/src/pages/snap.tsx:733` | `snap_advice_failed` | `reason:"http_error"`, `status` |
| `client/src/pages/snap.tsx:749` | `snap_advice_resume_still_blocked` | `feature` |
| `client/src/pages/snap.tsx:754` | `snap_advice_blocked` | `feature` |
| `client/src/pages/snap.tsx:769` | `snap_advice_succeeded` | `adviceSource` |
| `client/src/pages/snap.tsx:774` | `snap_advice_failed` | `reason:"exception"` |
| `client/src/pages/snap.tsx:775` | exception | `phase:"snap_advice"`, raw error |
| `client/src/pages/snap.tsx:793` | `snap_label_resume_failed` | `reason:"no_stashed_image"` |
| `client/src/pages/snap.tsx:799` | `snap_label_resume_started` | `language` |
| `client/src/pages/snap.tsx:818` | `snap_label_resume_failed` | failure reason/status |
| `client/src/pages/snap.tsx:834` | `snap_label_resume_still_blocked` | `feature` |
| `client/src/pages/snap.tsx:864` | `snap_label_resumed_after_unlock` | label source/result metadata |
| `client/src/pages/snap.tsx:885` | `snap_label_resume_failed` | `reason:"exception"` |
| `client/src/pages/snap.tsx:886` | exception | `phase:"snap_label_resume"`, raw error |
| `client/src/pages/health-info.tsx:242` | `diet_tip_viewed` | `tip_text`, `source:"health_info"`; tip text is not blocked |

## Every OneSignal outbound operation/callsite

| Location | Operation | Exact outbound fields |
|---|---|---|
| `server/onesignal.ts:95-104` | delivery report GET | notification ID in URL; `app_id`; Basic REST authorization |
| `server/onesignal.ts:151-156` | follow-up report GET | notification ID in URL; `app_id`; Basic REST authorization |
| `server/onesignal.ts:308-322` | notification POST | `app_id`, `headings`, `subtitle`, `contents`, `url`, `data.deepLink`, either `include_aliases.external_id` or `include_subscription_ids`, `target_channel`, optional `send_after`, `delivery_time_of_day`, `delayed_option` |
| `server/onesignal.ts:387-393` | notification DELETE | notification ID in URL, `app_id`, Basic REST authorization |
| `server/onesignal.ts:494-500` | user DELETE | external ID in URL, Basic REST authorization, `Accept` |
| `server/onesignal.ts:515-521` | player DELETE | player ID in URL, `app_id`, Basic REST authorization, `Accept` |
| `server/routes.ts:1576-1582` | dev test send | localized `title`, `subtitle`, `message`; `deepLink`; `playerIds` |
| `server/notifications.ts:356-365` | scheduled send | localized `title`, `subtitle`, `message`; `deepLink`; `redirectUrl`; `send_after`; external or player IDs |
| `server/onesignal.ts:432` | cancellation callsite | `notificationId` |
| `server/notifications.ts:738,825` | cancellation callsites | stored OneSignal notification ID |

Notification copy is fixed. Recipient/device identifiers are sent; no glucose, HbA1c, food, email, profile, or session token is included in notification JSON.

## Every Anthropic `messages.create`

| Location | Full request fields | Data sent / risk |
|---|---|---|
| `server/routes.ts:1342-1371` | `model:"claude-sonnet-4-20250514"`, `max_tokens:400`, `temperature:0`, GI-matching `system`, `messages:[{role:"user",content:JSON.stringify({inputs:[{inputIndex,names:{en,zhHant,yue},candidates:[{referenceId,canonicalName,aliases}]}]})}]` | Food names and GI candidates; no glucose/HbA1c/email/session |
| `server/routes.ts:2163-2175` | `model:"claude-sonnet-4-6"`, `max_tokens`, `temperature:0`, label `system`, user content array containing `{type:"image",source:{type:"base64",media_type:mimeType,data:imageBase64}}` and `{type:"text",text:userText}` | Raw food image and instruction text; prompt-injection surface |
| `server/routes.ts:2763-2770` | `model:"claude-sonnet-4-6"`, `max_tokens:400`, `system:advicePromptSystem(locale)` where `foodItemsInstruction` is appended to the system prompt, `messages:[{role:"user",content:foodDesc}]` | User content contains name, portion, sauces, extras; prompt-injection surface. The output-schema instruction is system content. No raw glucose/HbA1c/email/profile/session |
| `server/routes.ts:2820-2830` | translation model, max tokens, temperature, JSON-only translation `system`, `messages:[{role:"user",content:JSON.stringify({foodItems:structuredFoodItems,...})}]` | Model-derived food names; no raw glucose/HbA1c/email/session |