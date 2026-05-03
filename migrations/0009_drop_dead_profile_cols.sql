ALTER TABLE profiles
  DROP COLUMN IF EXISTS current_tip_index,
  DROP COLUMN IF EXISTS current_struggle,
  DROP COLUMN IF EXISTS dinner_success_weeks;
