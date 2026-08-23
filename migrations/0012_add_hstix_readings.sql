CREATE TABLE IF NOT EXISTS hstix_readings (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  meal_snap_id INTEGER,
  glucose_mmol REAL NOT NULL,
  note TEXT,
  minutes_since_last_meal INTEGER,
  meal_timing_confidence VARCHAR(16) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hstix_readings_user_recorded_idx
  ON hstix_readings (user_id, recorded_at);

CREATE INDEX IF NOT EXISTS hstix_readings_meal_idx
  ON hstix_readings (meal_snap_id);