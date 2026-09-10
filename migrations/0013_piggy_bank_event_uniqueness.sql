CREATE UNIQUE INDEX IF NOT EXISTS piggy_bank_events_user_achievement_uniq
  ON piggy_bank_events (user_id, achievement_type)
  WHERE achievement_type ~ '^(snap_|hstix_|daily_win_)';