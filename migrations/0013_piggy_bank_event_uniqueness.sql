DELETE FROM piggy_bank_events a
USING piggy_bank_events b
WHERE a.user_id = b.user_id
  AND a.achievement_type = b.achievement_type
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS piggy_bank_events_user_achievement_uniq
  ON piggy_bank_events (user_id, achievement_type);