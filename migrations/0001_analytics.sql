CREATE TABLE IF NOT EXISTS pageviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         TEXT    NOT NULL,
  path       TEXT    NOT NULL,
  referrer   TEXT,
  ip_anon    TEXT,
  country    TEXT,
  city       TEXT,
  region     TEXT,
  timezone   TEXT,
  asn        TEXT,
  user_agent TEXT,
  device     TEXT,
  bot        INTEGER NOT NULL DEFAULT 0,
  screen_w   INTEGER,
  client_tz  TEXT
);

CREATE INDEX IF NOT EXISTS idx_pv_ts      ON pageviews(ts);
CREATE INDEX IF NOT EXISTS idx_pv_country ON pageviews(country);
CREATE INDEX IF NOT EXISTS idx_pv_path    ON pageviews(path);
