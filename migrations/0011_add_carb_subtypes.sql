ALTER TABLE meal_snaps
  ADD COLUMN IF NOT EXISTS food_items jsonb;

CREATE TABLE IF NOT EXISTS user_carb_subtype_preferences (
  id serial PRIMARY KEY,
  user_id varchar NOT NULL,
  food_key text NOT NULL,
  carb_category varchar NOT NULL,
  carb_subtype varchar NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_carb_subtype_preferences_unique_idx
  ON user_carb_subtype_preferences (user_id, food_key, carb_category);