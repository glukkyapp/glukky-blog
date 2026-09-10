CREATE TABLE IF NOT EXISTS daily_task_completions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  local_date DATE NOT NULL,
  task_id VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_task_completions_user_date_uniq
  ON daily_task_completions (user_id, local_date);