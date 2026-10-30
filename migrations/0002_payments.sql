-- payments: one row per charge (Stripe or manual)
CREATE TABLE IF NOT EXISTS payments (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  lead_id           TEXT,
  customer_email    TEXT,
  customer_name     TEXT,
  amount_cents      INTEGER,
  currency          TEXT NOT NULL DEFAULT 'usd',
  type              TEXT NOT NULL, -- 'subscription_invoice' | 'one_off' | 'manual'
  status            TEXT NOT NULL DEFAULT 'pending',
                    -- 'pending' | 'completed' | 'failed' | 'refunded'
  provider          TEXT NOT NULL DEFAULT 'stripe',
  provider_id       TEXT UNIQUE,   -- PaymentIntent ID / invoice ID / etc.
  product_name      TEXT,
  reference_code    TEXT UNIQUE,   -- manual payments: e.g. MH-4A3B
  manual_method     TEXT,          -- 'zelle' | 'cashapp' | 'venmo' | 'cash' | 'other'
  marked_paid_at    TEXT,
  marked_paid_by    TEXT,          -- admin note
  is_first_payment  INTEGER NOT NULL DEFAULT 0,
  is_second_payment INTEGER NOT NULL DEFAULT 0,
  -- attribution mirrors leads table
  utm_source        TEXT,
  utm_medium        TEXT,
  utm_campaign      TEXT,
  utm_term          TEXT,
  utm_content       TEXT,
  gclid             TEXT,
  fbclid            TEXT,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- subscriptions: one row per Stripe subscription
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  lead_id                TEXT,
  customer_email         TEXT,
  customer_name          TEXT,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id     TEXT NOT NULL,
  stripe_price_id        TEXT,
  plan_name              TEXT,
  status                 TEXT NOT NULL DEFAULT 'active',
                         -- 'active' | 'cancelled' | 'past_due' | 'trialing' | 'incomplete'
  current_period_start   TEXT,
  current_period_end     TEXT,
  cancelled_at           TEXT,
  payment_count          INTEGER NOT NULL DEFAULT 0,
  commission_eligible    INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX IF NOT EXISTS payments_lead    ON payments(lead_id);
CREATE INDEX IF NOT EXISTS payments_status  ON payments(status);
CREATE INDEX IF NOT EXISTS payments_created ON payments(created_at);
CREATE INDEX IF NOT EXISTS subs_lead        ON subscriptions(lead_id);
CREATE INDEX IF NOT EXISTS subs_status      ON subscriptions(status);
CREATE INDEX IF NOT EXISTS subs_commission  ON subscriptions(commission_eligible);
