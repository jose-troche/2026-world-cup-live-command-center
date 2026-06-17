CREATE TABLE IF NOT EXISTS polls (
  match_id TEXT NOT NULL,
  choice   TEXT NOT NULL CHECK(choice IN ('home','draw','away')),
  voted_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_polls_match ON polls(match_id);
