# Exhaustive Drizzle SQL and XSS Evidence

Drizzle interpolation is parameterized unless explicitly marked `sql.raw`.

## `sql.raw`

| Location | Full occurrence | Origin / classification |
|---|---|---|
| `server/storage.ts:268-275` | `INSERT INTO ${sql.raw(tableName)} (original_record_id, user_id, field_name, old_value, new_value, changed_at, change_reason, changed_by) VALUES (${e.originalRecordId}, ${e.userId}, ${e.fieldName}, ${e.oldValue ?? null}, ${e.newValue ?? null}, NOW(), ${e.changeReason ?? null}, ${e.changedBy})` | `tableName` is `HISTORY_TABLE[kind]`; `kind` is constrained to `profile`, `meal_snap`, or `glucose_thresholds`. Allowlisted identifier; values bound. Safe. |
| `server/storage.ts:1767-1773` | `SELECT id, field_name, old_value, new_value, changed_at, change_reason, changed_by FROM ${sql.raw(tableName)} WHERE original_record_id = ${recordId} AND user_id = ${userId} ORDER BY changed_at DESC` | Same allowlisted identifier; record/user IDs bound. Safe. |

## Every tagged `sql` template

| Location(s) | Full statement | Classification |
|---|---|---|
| `shared/models/auth.ts:15,28` | `gen_random_uuid()` | Static; safe |
| `shared/models/chat.ts:9,17` | `CURRENT_TIMESTAMP` | Static; safe |
| `shared/schema.ts:142,152-153` | `'{}'::text[]` | Static; safe |
| `server/notifications.ts:113` | `(${userProfiles.onesignalPlayerId} IS NOT NULL OR ${userProfiles.onesignalExternalId} IS NOT NULL)` | Schema columns; safe |
| `server/notifications.ts:810` | `${scheduledNotifications.notificationType} IN ('daily_report','weekly_report','monthly_report','daily_checkin')` | Column plus static literals; safe |
| `server/onesignal.ts:562` | `count(*) > 1` | Static; safe |
| `server/routes.ts:310` | `${mealSnaps.postMealGlucoseMmol} IS NOT NULL` | Schema column; safe |
| `server/routes.ts:311` | `${mealSnaps.foodName} IS NOT NULL` | Schema column; safe |
| `server/routes.ts:809` | `INSERT INTO deletion_requests (user_id, requested_at, scheduled_deletion_at, immediate_delete) VALUES (${userId}, NOW(), NOW(), TRUE) ON CONFLICT (user_id) DO UPDATE SET immediate_delete = TRUE, requested_at = NOW()` | Bound user ID; safe |
| `server/routes.ts:1220` | `${userProfiles.userId} != ${userId}` | Column and bound user ID; safe |
| `server/storage.ts:328` | `NOW()` | Static; safe |
| `server/storage.ts:366` | `LEAST(piggy_bank_coins + ${coins}, 60)` | Bound numeric value; safe |
| `server/storage.ts:546` | `INSERT INTO meal_snap_health_history (original_record_id, user_id, field_name, old_value, new_value, changed_at, change_reason, changed_by) SELECT id, user_id, 'postMealGlucoseMmol', post_meal_glucose_mmol::text, 'DELETED', NOW(), 'account_deleted', user_id FROM meal_snaps WHERE user_id = ${userId} UNION ALL SELECT id, user_id, 'postMealSymptom', post_meal_symptom, 'DELETED', NOW(), 'account_deleted', user_id FROM meal_snaps WHERE user_id = ${userId} UNION ALL SELECT id, user_id, 'glucoseImpact', glucose_impact, 'DELETED', NOW(), 'account_deleted', user_id FROM meal_snaps WHERE user_id = ${userId} UNION ALL SELECT id, user_id, 'postMealSkipped', post_meal_skipped::text, 'DELETED', NOW(), 'account_deleted', user_id FROM meal_snaps WHERE user_id = ${userId} UNION ALL SELECT id, user_id, 'postMealRecordedAt', post_meal_recorded_at::text, 'DELETED', NOW(), 'account_deleted', user_id FROM meal_snaps WHERE user_id = ${userId}` | Bound user ID; safe |
| `server/storage.ts:561` | `UPDATE meal_snaps SET is_deleted = TRUE WHERE user_id = ${userId}` | Bound user ID; safe |
| `server/storage.ts:562` | `UPDATE user_glucose_thresholds SET is_deleted = TRUE WHERE user_id = ${userId}` | Bound user ID; safe |
| `server/storage.ts:568` | `DELETE FROM weekly_plan_days WHERE weekly_plan_id IN (SELECT id FROM weekly_plans WHERE user_id = ${userId})` | Bound user ID; safe |
| `server/storage.ts:569` | `DELETE FROM weekly_plans WHERE user_id = ${userId}` | Bound user ID; safe |
| `server/storage.ts:570` | `DELETE FROM daily_logs WHERE user_id = ${userId}` | Bound user ID; safe |
| `server/storage.ts:571` | `DELETE FROM weekly_reports WHERE user_id = ${userId}` | Bound user ID; safe |
| `server/storage.ts:572` | `DELETE FROM monthly_reports WHERE user_id = ${userId}` | Bound user ID; safe |
| `server/storage.ts:573` | `DELETE FROM cycle_history WHERE user_id = ${userId}` | Bound user ID; safe |
| `server/storage.ts:574` | `DELETE FROM piggy_bank_events WHERE user_id = ${userId}` | Bound user ID; safe |
| `server/storage.ts:610` | `${sessions.sess}::text LIKE ${'%' + userId + '%'}` | Concatenated pattern remains a bound value; safe |
| `server/storage.ts:627-629` | `lower(${foodLabels.foodNameEn}) = ${normalised}`; `lower(${foodLabels.foodNameZhHant}) = ${normalised}`; `lower(${foodLabels.foodNameYue}) = ${normalised}` | Columns and bound value; safe |
| `server/storage.ts:704-706` | `lower(${foodLabels.foodNameEn}) = ${normalised}`; `lower(${foodLabels.foodNameZhHant}) = ${normalised}`; `lower(${foodLabels.foodNameYue}) = ${normalised}` | Columns and bound value; safe |
| `server/storage.ts:726-728` | `lower(${foodLabels.foodNameEn}) = ${normalised}`; `lower(${foodLabels.foodNameZhHant}) = ${normalised}`; `lower(${foodLabels.foodNameYue}) = ${normalised}` | Columns and bound value; safe |
| `server/storage.ts:745` | `${foodLabels.useCount} + 1` | Schema column; safe |
| `server/storage.ts:1081` | `MIN(${mealSnaps.localDate})` | Schema column; safe |
| `server/storage.ts:1113` | `INSERT INTO snap_report_meal_facts (snap_id, user_id, local_date, meal_type, final_impact) VALUES (${snap.id}, ${userId}, ${snap.localDate}, ${snap.mealType}, ${finalImpact}) ON CONFLICT (snap_id) DO UPDATE SET local_date = EXCLUDED.local_date, meal_type = EXCLUDED.meal_type, final_impact = EXCLUDED.final_impact` | Bound values; safe |
| `server/storage.ts:1121` | `INSERT INTO snap_report_user_metadata (user_id, first_meal_local_date) VALUES (${userId}, ${snap.localDate}) ON CONFLICT (user_id) DO UPDATE SET first_meal_local_date = LEAST(snap_report_user_metadata.first_meal_local_date, EXCLUDED.first_meal_local_date)` | Bound values; safe |
| `server/storage.ts:1188` | `INSERT INTO food_gi_entries (normalized_food_name, status, reference_id, gi_value, source, resolved_at, claim_expires_at, claim_token) VALUES (${entry.normalizedFoodName}, 'pending', NULL, NULL, 'pending', ${entry.now}, ${entry.claimExpiresAt}, ${entry.claimToken}) ON CONFLICT (normalized_food_name) DO UPDATE SET status = 'pending', reference_id = NULL, gi_value = NULL, source = 'pending', resolved_at = ${entry.now}, claim_expires_at = ${entry.claimExpiresAt}, claim_token = ${entry.claimToken} WHERE (food_gi_entries.status = 'no_match' AND food_gi_entries.resolved_at <= ${entry.retryNoMatchBefore}) OR (food_gi_entries.status = 'pending' AND (food_gi_entries.claim_expires_at IS NULL OR food_gi_entries.claim_expires_at <= ${entry.now})) RETURNING normalized_food_name` | Bound fields; safe |
| `server/storage.ts:1227` | `UPDATE food_gi_entries SET status = ${entry.status}, reference_id = ${entry.referenceId}, gi_value = ${entry.giValue}, source = ${entry.source}, resolved_at = ${entry.resolvedAt}, claim_expires_at = NULL, claim_token = NULL WHERE normalized_food_name = ${entry.normalizedFoodName} AND status = 'pending' AND claim_token = ${entry.claimToken} RETURNING normalized_food_name` | Bound fields; safe |
| `server/storage.ts:1245` | `INSERT INTO snap_daily_glucose (user_id, local_date, low_count, medium_count, high_count, meal_count, has_late_meal) VALUES (${userId}, ${localDate}, ${counts.low}, ${counts.medium}, ${counts.high}, ${counts.mealCount}, ${counts.hasLateMeal}) ON CONFLICT (user_id, local_date) DO UPDATE SET low_count = snap_daily_glucose.low_count + EXCLUDED.low_count, medium_count = snap_daily_glucose.medium_count + EXCLUDED.medium_count, high_count = snap_daily_glucose.high_count + EXCLUDED.high_count, meal_count = snap_daily_glucose.meal_count + EXCLUDED.meal_count, has_late_meal = snap_daily_glucose.has_late_meal OR EXCLUDED.has_late_meal` | Bound values; safe |
| `server/storage.ts:1258` | `INSERT INTO snap_monthly_archive (user_id, month, score, signal_quality, timing_regularity, freq_consistency, missed_meal_days, irregular_meal_days, top_high_food, top_high_food_count, top_low_food, top_low_food_count, archived_at) VALUES (${record.userId}, ${record.month}, ${record.score ?? null}, ${record.signalQuality ?? null}, ${record.timingRegularity ?? null}, ${record.freqConsistency ?? null}, ${record.missedMealDays ?? null}, ${record.irregularMealDays ?? null}, ${record.topHighFood ?? null}, ${record.topHighFoodCount ?? null}, ${record.topLowFood ?? null}, ${record.topLowFoodCount ?? null}, NOW()) ON CONFLICT (user_id, month) DO UPDATE SET score = EXCLUDED.score, signal_quality = EXCLUDED.signal_quality, timing_regularity = EXCLUDED.timing_regularity, freq_consistency = EXCLUDED.freq_consistency, missed_meal_days = EXCLUDED.missed_meal_days, irregular_meal_days = EXCLUDED.irregular_meal_days, top_high_food = EXCLUDED.top_high_food, top_high_food_count = EXCLUDED.top_high_food_count, top_low_food = EXCLUDED.top_low_food, top_low_food_count = EXCLUDED.top_low_food_count, archived_at = NOW()` | Bound values; safe |
| `server/storage.ts:1292` | `WITH snap_months AS (SELECT DISTINCT user_id, TO_CHAR(local_date::date, 'YYYY-MM') AS month FROM meal_snaps) SELECT sm.user_id AS "userId", sm.month FROM snap_months sm WHERE NOT EXISTS (SELECT 1 FROM snap_monthly_archive sma WHERE sma.user_id = sm.user_id AND sma.month = sm.month) ORDER BY sm.user_id, sm.month ASC` | Static; safe |
| `server/storage.ts:1446` | `NOT EXISTS (SELECT 1 FROM hstix_readings hr WHERE hr.user_id = ${userId} AND hr.meal_snap_id = ${mealSnaps.id})` | Bound user ID and schema column; safe |
| `server/storage.ts:1483` | `SELECT AVG(COALESCE((SELECT hr.glucose_mmol FROM hstix_readings hr WHERE hr.user_id = ${userId} AND hr.meal_snap_id = ms.id ORDER BY hr.recorded_at DESC LIMIT 1), ms.post_meal_glucose_mmol)) AS avg_post_meal, COUNT(*)::int AS entry_count FROM meal_snaps ms WHERE ms.user_id = ${userId} AND ms.combo_key = ${comboKey} AND COALESCE((SELECT hr.glucose_mmol FROM hstix_readings hr WHERE hr.user_id = ${userId} AND hr.meal_snap_id = ms.id ORDER BY hr.recorded_at DESC LIMIT 1), ms.post_meal_glucose_mmol) IS NOT NULL` | Bound values; safe |
| `server/storage.ts:1508` | `SELECT COUNT(*)::int AS cnt FROM meal_snaps ms WHERE ms.user_id = ${userId} AND (EXISTS (SELECT 1 FROM hstix_readings hr WHERE hr.user_id = ${userId} AND hr.meal_snap_id = ms.id) OR ms.post_meal_glucose_mmol IS NOT NULL OR ms.post_meal_symptom IS NOT NULL)` | Bound user ID; safe |
| `server/storage.ts:1525` | `SELECT COUNT(*)::int AS cnt FROM meal_snaps WHERE user_id = ${userId}` | Bound user ID; safe |
| `server/storage.ts:1555,1569` | `NOT EXISTS (SELECT 1 FROM hstix_readings hr WHERE hr.user_id = ${mealSnaps.userId} AND hr.meal_snap_id = ${mealSnaps.id})` | Schema columns; safe |
| `server/storage.ts:1580` | `UPDATE user_profiles SET consecutive_skipped_meals = consecutive_skipped_meals + ${count} WHERE user_id = ${uid}` | Bound values; safe |
| `server/storage.ts:1590` | `SELECT COALESCE((SELECT hr.glucose_mmol FROM hstix_readings hr WHERE hr.user_id = ${userId} AND hr.meal_snap_id = ms.id ORDER BY hr.recorded_at DESC LIMIT 1), ms.post_meal_glucose_mmol) AS post_meal FROM meal_snaps ms WHERE ms.user_id = ${userId} AND ms.food_name = ${foodName} AND COALESCE((SELECT hr.glucose_mmol FROM hstix_readings hr WHERE hr.user_id = ${userId} AND hr.meal_snap_id = ms.id ORDER BY hr.recorded_at DESC LIMIT 1), ms.post_meal_glucose_mmol) IS NOT NULL AND ms.snap_time >= NOW() - INTERVAL '30 days' ORDER BY ms.snap_time ASC LIMIT ${limit}` | Bound values; safe |
| `server/storage.ts:1628` | `INSERT INTO user_glucose_thresholds (user_id, low_med_boundary, med_high_boundary, reading_count, is_personalised, first_activated_at, updated_at) VALUES (${data.userId}, ${data.lowMedBoundary}, ${data.medHighBoundary}, ${data.readingCount}, ${data.isPersonalised}, ${data.firstActivatedAt ?? null}, NOW()) ON CONFLICT (user_id) DO UPDATE SET low_med_boundary = EXCLUDED.low_med_boundary, med_high_boundary = EXCLUDED.med_high_boundary, reading_count = EXCLUDED.reading_count, is_personalised = EXCLUDED.is_personalised, first_activated_at = COALESCE(user_glucose_thresholds.first_activated_at, EXCLUDED.first_activated_at), updated_at = NOW()` | Bound values; safe |
| `server/storage.ts:1677` | `SELECT ((SELECT COUNT(*)::int FROM meal_snaps WHERE user_id = ${userId} AND post_meal_glucose_mmol IS NOT NULL AND NOT EXISTS (SELECT 1 FROM hstix_readings hr WHERE hr.user_id = ${userId} AND hr.meal_snap_id = meal_snaps.id) AND snap_time >= NOW() - INTERVAL '30 days') + (SELECT COUNT(*)::int FROM hstix_readings WHERE user_id = ${userId} AND recorded_at >= NOW() - INTERVAL '30 days'))::int AS cnt` | Bound user ID; safe |
| `server/storage.ts:1697` | `SELECT mmol FROM (SELECT post_meal_glucose_mmol AS mmol, COALESCE(post_meal_recorded_at, snap_time) AS recorded_at FROM meal_snaps ms WHERE ms.user_id = ${userId} AND ms.post_meal_glucose_mmol IS NOT NULL AND NOT EXISTS (SELECT 1 FROM hstix_readings hr WHERE hr.user_id = ${userId} AND hr.meal_snap_id = ms.id) AND ms.snap_time >= NOW() - INTERVAL '30 days' UNION ALL SELECT glucose_mmol AS mmol, recorded_at FROM hstix_readings WHERE user_id = ${userId} AND recorded_at >= NOW() - INTERVAL '30 days') all_readings ORDER BY recorded_at ASC` | Bound user ID; safe |
| `server/storage.ts:1760` | `SELECT id FROM user_profiles WHERE id = ${recordId} AND user_id = ${userId} LIMIT 1` | Bound owner check; safe |
| `server/storage.ts:1762` | `SELECT id FROM meal_snaps WHERE id = ${recordId} AND user_id = ${userId} LIMIT 1` | Bound owner check; safe |
| `server/storage.ts:1763` | `SELECT id FROM user_glucose_thresholds WHERE id = ${recordId} AND user_id = ${userId} LIMIT 1` | Bound owner check; safe |
| `server/storage.ts:1786` | `SELECT user_id, glucose_group FROM user_profiles WHERE glucose_group IS NOT NULL` | Static; safe |
| `server/storage.ts:1800` | `SELECT COUNT(*)::int AS meal_count, SUM(CASE WHEN effective_mmol <= ${thresholds.lowMedBoundary} THEN 1 ELSE 0 END)::int AS low_count, SUM(CASE WHEN effective_mmol > ${thresholds.lowMedBoundary} AND effective_mmol < ${thresholds.medHighBoundary} THEN 1 ELSE 0 END)::int AS medium_count, SUM(CASE WHEN effective_mmol >= ${thresholds.medHighBoundary} THEN 1 ELSE 0 END)::int AS high_count FROM (SELECT COALESCE((SELECT hr.glucose_mmol FROM hstix_readings hr WHERE hr.user_id = ${userId} AND hr.meal_snap_id = ms.id ORDER BY hr.recorded_at DESC LIMIT 1), ms.post_meal_glucose_mmol) AS effective_mmol FROM meal_snaps ms WHERE ms.user_id = ${userId} AND ms.local_date = ${localDate} AND ms.missed_meal_flag = false) effective WHERE effective_mmol IS NOT NULL` | Bound values; safe |
| `server/storage.ts:1822` | `SELECT has_late_meal FROM snap_daily_glucose WHERE user_id = ${userId} AND local_date = ${localDate}` | Bound values; safe |
| `server/storage.ts:1841` | `SELECT local_date, low_count, medium_count, high_count FROM snap_daily_glucose WHERE user_id = ${userId} AND local_date >= ${monthStart} AND local_date <= ${monthEnd} ORDER BY local_date` | Bound values; safe |
| `server/storage.ts:1863` | `SELECT post_meal_symptom, COUNT(*)::int AS cnt FROM meal_snaps WHERE user_id = ${userId} AND local_date >= ${monthStart} AND local_date <= ${monthEnd} AND post_meal_symptom IS NOT NULL GROUP BY post_meal_symptom` | Bound values; safe |
| `server/storage.ts:1872` | `SELECT COUNT(*)::int AS cnt FROM meal_snaps WHERE user_id = ${userId} AND local_date >= ${monthStart} AND local_date <= ${monthEnd} AND meal_type = 'snack'` | Bound values; safe |
| `server/storage.ts:1905` | `SELECT sid, expire FROM sessions WHERE sess::text LIKE ${'%' + userId + '%'}` | Bound pattern; safe |
| `server/storage.ts:1936` | `UPDATE users SET deletion_pending = TRUE WHERE id = ${userId}` | Bound user ID; safe |
| `server/storage.ts:1947` | `UPDATE users SET deletion_pending = FALSE WHERE id = ${userId}` | Bound user ID; safe |

No unsafe user-input interpolation was found.

## Exact XSS sink code

`client/src/components/ui/chart.tsx:70-101`:

```tsx
const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, config]) => config.theme || config.color
  )
  if (!colorConfig.length) return null
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color =
      itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ||
      itemConfig.color
    return color ? `  --color-${key}: ${color};` : null
  })
  .join("\n")}
}`,
          )
          .join("\n")
      }}
    />
  )
}
```

The equivalent sandbox sink is at `artifacts/mockup-sandbox/src/components/ui/chart.tsx:68-99` and has identical data flow. Search found no direct `.innerHTML =` assignment in tracked runtime source.