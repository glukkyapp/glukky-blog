ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS piggy_bank_gardens_completed INTEGER NOT NULL DEFAULT 0;