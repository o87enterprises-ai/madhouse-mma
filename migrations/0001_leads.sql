CREATE TABLE IF NOT EXISTS leads (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  name             TEXT NOT NULL,
  phone            TEXT NOT NULL,
  email            TEXT,
  who              TEXT,          -- 'me' | 'child' | 'both'
  goal             TEXT,          -- 'fitness' | 'self-defense' | 'compete' | 'confidence'
  experience       TEXT,          -- 'none' | 'some' | 'experienced'
  program_interest TEXT,          -- 'bjj' | 'muaythai' | 'mma' | 'kravmaga' | 'kids' | null
  preferred_times  TEXT,          -- free text / JSON array
  note             TEXT,
  -- attribution
  utm_source       TEXT,
  utm_medium       TEXT,
  utm_campaign     TEXT,
  utm_term         TEXT,
  utm_content      TEXT,
  gclid            TEXT,
  fbclid           TEXT,
  referrer         TEXT,
  landing_path     TEXT,
  -- lifecycle (feeds commission report in Batch 2)
  status           TEXT NOT NULL DEFAULT 'new',
                   -- 'new' | 'contacted' | 'booked' | 'attended' | 'joined' | 'lost'
  member_since     TEXT,          -- ISO date when they joined as paying member
  second_payment_at TEXT          -- ISO date of second payment (commission eligible)
);

CREATE INDEX IF NOT EXISTS leads_created  ON leads(created_at);
CREATE INDEX IF NOT EXISTS leads_status   ON leads(status);
CREATE INDEX IF NOT EXISTS leads_utm      ON leads(utm_source, utm_campaign);
