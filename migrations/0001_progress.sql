CREATE TABLE IF NOT EXISTS profiles (
  profile_key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
