CREATE TABLE IF NOT EXISTS "ingredient_vocabulary" (
  "id" serial PRIMARY KEY,
  "internal_id" varchar NOT NULL UNIQUE,
  "category" varchar NOT NULL,
  "label_en" text NOT NULL,
  "label_zh" text NOT NULL,
  "label_yue" text NOT NULL,
  "aliases" text[] NOT NULL DEFAULT '{}'::text[]
);

CREATE TABLE IF NOT EXISTS "food_combos" (
  "id" serial PRIMARY KEY,
  "food_name" text NOT NULL,
  "food_name_en" text,
  "food_name_aliases" text[] NOT NULL DEFAULT '{}'::text[],
  "default_portion" varchar,
  "default_sauces" text[] NOT NULL DEFAULT '{}'::text[],
  "default_toppings" text[] NOT NULL DEFAULT '{}'::text[],
  "calories_estimate" integer
);

CREATE TABLE IF NOT EXISTS "food_advice_cache" (
  "id" serial PRIMARY KEY,
  "food_name" text NOT NULL,
  "combo_key" varchar NOT NULL,
  "locale" varchar NOT NULL,
  "advice_text" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "food_advice_cache_combo_locale_idx" ON "food_advice_cache" ("combo_key", "locale");
