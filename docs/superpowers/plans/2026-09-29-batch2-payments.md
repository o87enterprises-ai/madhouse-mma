# Batch 2 — Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Stripe subscriptions, one-off payments, manual-method "pay directly" with reference codes, a Stripe Customer Portal link, webhook→D1 recording, lead→member linkage, and a standalone owner admin dashboard — all running on Cloudflare Pages Functions.

**Architecture:** Payment logic lives in `functions/api/payment/` (Pages Functions) backed by `functions/_lib/` shared utilities. Stripe runs with `createFetchHttpClient()` so it works in the Workers runtime. Frontend adds a `Pricing` section and a `PayDirectly` section to the existing scroll page; a standalone `public/admin/index.html` (vanilla JS, no build step) is the owner dashboard.

**Tech Stack:** Stripe SDK v17+ (`stripe` npm, Workers-compatible), Cloudflare Pages Functions, D1 SQLite, React 19 + Framer Motion (frontend additions), Vanilla JS (admin dashboard).

**Spec:** `MADHOUSE_HANDOFF.md` §7 (open-pay bugs + required changes) and §10 Batch 2.

---

## Global Constraints

- Never commit Stripe keys. All secrets via `wrangler secret put`. Template in `.dev.vars.example`.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` are BYOK — client supplies their own Stripe account keys.
- Keep the provider abstraction: `StripeProvider` and `SquareProvider` share a common interface so Square can plug in later.
- Every payment/subscription record in D1 stores `lead_id` + UTM attribution — this feeds the monthly commission report.
- The commission clears when `payment_count >= 2` on a subscription (second invoice paid).
- Stripe Price IDs are created in the client's Stripe Dashboard — `src/content/plans.js` stores them as `null` initially. The Pricing UI degrades gracefully when Price IDs are absent.
- No AI-generated imagery. No fabricated prices or hours.
- Git HTTPS remotes only: `https://github.com/o87enterprises-ai/...`

## Review Focus

1. **Webhook raw body:** Stripe signature verification requires the unmodified request body bytes. If any middleware or framework layer parses it first, `constructEventAsync` throws. Every Pages Function reads its own body — there is no shared middleware — but test that the webhook handler calls `request.text()` (not `request.json()`) before constructing the event.

2. **Duplicate webhook events:** Stripe can deliver the same event more than once. Inserting a payment row a second time must not duplicate it. The `provider_id` column has a UNIQUE constraint; a second insert for the same `provider_id` must be silently ignored (`INSERT OR IGNORE`).

3. **Manual payment reference code collision:** `MH-XXXX` codes are generated server-side from 2 random bytes — 65 536 possible values. At scale this collides. The `reference_code` column is UNIQUE; the insert must retry on conflict. Test the retry path by pre-inserting the code the server will generate.

4. **Subscription cancelled before second payment:** If a member cancels after one payment, `commission_eligible` must remain `0`. The webhook for `customer.subscription.deleted` must NOT set `commission_eligible = 1`. Test this path explicitly.

5. **Admin token absent in local dev:** `ADMIN_TOKEN` is unset locally (no `.dev.vars`). Every admin endpoint already returns 401 in this case. The admin dashboard HTML must show a clear "wrong token" message rather than a blank screen when the API returns 401.

---

## File Map

### New — backend
| Path | Responsibility |
|---|---|
| `functions/_lib/stripe.js` | Stripe client factory using `createFetchHttpClient()` |
| `functions/_lib/providers/StripeProvider.js` | Provider abstraction: createCheckoutSession, createOneOffIntent, createPortalSession, refund |
| `functions/_lib/providers/SquareProvider.js` | Square stub (fixed SDK surface per §7 bugs; not wired yet) |
| `functions/_lib/providers/getProvider.js` | Factory: reads `env.PAYMENT_PROVIDER` (`stripe`\|`square`), returns correct provider |
| `functions/_lib/cors.js` | Shared CORS headers + OPTIONS handler |
| `functions/_lib/auth.js` | Shared Bearer-token check for admin endpoints |
| `functions/api/payment/config.js` | GET — public plans list (reads `src/content/plans.js` equivalent, or a D1 config table) |
| `functions/api/payment/checkout.js` | POST — create Stripe Checkout Session (subscription or one-off) |
| `functions/api/payment/portal.js` | POST — create Stripe Customer Portal session |
| `functions/api/payment/webhook.js` | POST — Stripe webhook; raw body; writes to D1 |
| `functions/api/payment/manual.js` | POST — record manual payment (Zelle/CashApp/Venmo); generates reference code |
| `functions/api/admin/payments.js` | GET — list payments; Bearer ADMIN_TOKEN; JSON or CSV |
| `functions/api/admin/mark-paid.js` | POST — mark manual payment as paid; updates lead status |

### New — migrations
| Path | Responsibility |
|---|---|
| `migrations/0002_payments.sql` | `payments` + `subscriptions` tables + indexes |

### New — frontend
| Path | Responsibility |
|---|---|
| `src/content/plans.js` | Membership plans + one-off products (Stripe Price IDs are `null` until client fills them in) |
| `src/modules/Pricing.jsx` | Plan cards + "Join Now" → Stripe Checkout redirect; degrades when Price IDs absent |
| `src/modules/PayDirectly.jsx` | Manual-method instructions + reference-code form (name/phone/method/plan) |
| `public/admin/index.html` | Standalone owner dashboard — Leads tab, Payments tab, Manual Pending tab, CSV export; vanilla JS, no build step |

### Modified
| Path | Change |
|---|---|
| `src/App.jsx` | Add `<Pricing>` and `<PayDirectly>` between Schedule and FirstClass; handle `?payment_success=1` / `?payment_cancelled=1` query params to show toast |
| `src/styles/main.css` | Add pricing card, pay-directly, and toast styles |
| `.dev.vars.example` | Add Stripe env var entries |
| `wrangler.toml` | No change needed (DB binding already set) |
| `package.json` | Add `stripe` dependency |

---

## Task 1 — Install Stripe + D1 schema

**Files:**
- Modify: `package.json`
- Create: `migrations/0002_payments.sql`

**Interfaces:**
- Produces: `payments(id, lead_id, provider_id UNIQUE, reference_code UNIQUE, ...)` and `subscriptions(id, stripe_subscription_id UNIQUE, payment_count, commission_eligible, ...)` tables in local + remote D1.

- [ ] **Step 1.1 — Install stripe**

```powershell
cd "C:\Users\there\Desktop\AutomationStation\madhouse-mma"
npm install stripe
```

Expected: `stripe` appears in `package.json` dependencies, no errors.

- [ ] **Step 1.2 — Write the migration**

Create `migrations/0002_payments.sql`:

```sql
-- payments: one row per charge (Stripe or manual)
CREATE TABLE IF NOT EXISTS payments (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  lead_id          TEXT,
  customer_email   TEXT,
  customer_name    TEXT,
  amount_cents     INTEGER,
  currency         TEXT NOT NULL DEFAULT 'usd',
  type             TEXT NOT NULL, -- 'subscription_invoice' | 'one_off' | 'manual'
  status           TEXT NOT NULL DEFAULT 'pending',
                   -- 'pending' | 'completed' | 'failed' | 'refunded'
  provider         TEXT NOT NULL DEFAULT 'stripe',
  provider_id      TEXT UNIQUE,   -- PaymentIntent ID / invoice ID / etc.
  product_name     TEXT,
  reference_code   TEXT UNIQUE,   -- manual payments: e.g. MH-4A3B
  manual_method    TEXT,          -- 'zelle' | 'cashapp' | 'venmo' | 'cash' | 'other'
  marked_paid_at   TEXT,
  marked_paid_by   TEXT,          -- admin note
  is_first_payment INTEGER NOT NULL DEFAULT 0,
  is_second_payment INTEGER NOT NULL DEFAULT 0,
  -- attribution (mirrors leads table)
  utm_source       TEXT,
  utm_medium       TEXT,
  utm_campaign     TEXT,
  utm_term         TEXT,
  utm_content      TEXT,
  gclid            TEXT,
  fbclid           TEXT,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

-- subscriptions: one row per Stripe subscription
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  lead_id                 TEXT,
  customer_email          TEXT,
  customer_name           TEXT,
  stripe_subscription_id  TEXT UNIQUE NOT NULL,
  stripe_customer_id      TEXT NOT NULL,
  stripe_price_id         TEXT,
  plan_name               TEXT,
  status                  TEXT NOT NULL DEFAULT 'active',
                          -- 'active' | 'cancelled' | 'past_due' | 'trialing' | 'incomplete'
  current_period_start    TEXT,
  current_period_end      TEXT,
  cancelled_at            TEXT,
  payment_count           INTEGER NOT NULL DEFAULT 0,
  commission_eligible     INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX IF NOT EXISTS payments_lead       ON payments(lead_id);
CREATE INDEX IF NOT EXISTS payments_status     ON payments(status);
CREATE INDEX IF NOT EXISTS payments_created    ON payments(created_at);
CREATE INDEX IF NOT EXISTS subs_lead           ON subscriptions(lead_id);
CREATE INDEX IF NOT EXISTS subs_status         ON subscriptions(status);
CREATE INDEX IF NOT EXISTS subs_commission     ON subscriptions(commission_eligible);
```

- [ ] **Step 1.3 — Apply locally**

```powershell
cd "C:\Users\there\Desktop\AutomationStation\madhouse-mma"
npx wrangler d1 execute madhouse-leads --file=migrations/0002_payments.sql --local
```

Expected: "4 commands executed successfully" (or similar; tables + indexes).

- [ ] **Step 1.4 — Apply remotely**

```powershell
npx wrangler d1 execute madhouse-leads --file=migrations/0002_payments.sql --remote
```

Expected: success JSON with `"changed_db": true`.

- [ ] **Step 1.5 — Verify tables exist**

```powershell
npx wrangler d1 execute madhouse-leads --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

Expected output includes: `leads`, `payments`, `subscriptions`.

---

## Task 2 — Shared lib: Stripe client + CORS + auth

**Files:**
- Create: `functions/_lib/stripe.js`
- Create: `functions/_lib/cors.js`
- Create: `functions/_lib/auth.js`

**Interfaces:**
- Produces:
  - `getStripeClient(env) → Stripe` — used by all payment functions
  - `CORS_HEADERS` object + `handleOptions() → Response` — used by all payment functions
  - `requireAdmin(request, env) → null | Response` — returns `null` if authorized, `401 Response` if not

- [ ] **Step 2.1 — Write `functions/_lib/stripe.js`**

```js
import Stripe from 'stripe'

export function getStripeClient(env) {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    apiVersion: '2024-06-20',
  })
}
```

- [ ] **Step 2.2 — Write `functions/_lib/cors.js`**

```js
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function handleOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
```

- [ ] **Step 2.3 — Write `functions/_lib/auth.js`**

```js
// Returns null if authorized, or a 401 Response if not.
export function requireAdmin(request, env) {
  if (!env.ADMIN_TOKEN) {
    return new Response('ADMIN_TOKEN not configured', { status: 401 })
  }
  const header = request.headers.get('Authorization') || ''
  const token = header.replace(/^Bearer\s+/i, '')
  if (token !== env.ADMIN_TOKEN) {
    return new Response('Unauthorized', { status: 401 })
  }
  return null
}
```

- [ ] **Step 2.4 — Verify build picks them up**

```powershell
cd "C:\Users\there\Desktop\AutomationStation\madhouse-mma"
npm run build
```

Expected: build succeeds (these files aren't imported by the client bundle yet — no change expected).

---

## Task 3 — Provider abstraction

**Files:**
- Create: `functions/_lib/providers/StripeProvider.js`
- Create: `functions/_lib/providers/SquareProvider.js`
- Create: `functions/_lib/providers/getProvider.js`

**Interfaces:**
- Consumes: `getStripeClient(env)` from `../_lib/stripe.js`
- Produces: `getProvider(env)` factory returning an object with:
  - `createCheckoutSession({ priceId, mode, leadId, successUrl, cancelUrl, customerEmail, metadata }) → { url: string }`
  - `createOneOffIntent({ amountCents, currency, description, metadata }) → { clientSecret: string, paymentIntentId: string }`
  - `createPortalSession({ customerId, returnUrl }) → { url: string }`
  - `refund({ paymentIntentId, amountCents }) → { refundId: string }`

- [ ] **Step 3.1 — Write `functions/_lib/providers/StripeProvider.js`**

```js
import { getStripeClient } from '../stripe.js'

export class StripeProvider {
  constructor(env) {
    this.stripe = getStripeClient(env)
  }

  async createCheckoutSession({ priceId, mode, leadId, successUrl, cancelUrl, customerEmail, metadata = {} }) {
    const session = await this.stripe.checkout.sessions.create({
      mode, // 'subscription' | 'payment'
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail || undefined,
      metadata: { lead_id: leadId || '', ...metadata },
      subscription_data: mode === 'subscription'
        ? { metadata: { lead_id: leadId || '', ...metadata } }
        : undefined,
      allow_promotion_codes: true,
      automatic_tax: { enabled: false },
    })
    return { url: session.url, sessionId: session.id }
  }

  async createOneOffIntent({ amountCents, currency = 'usd', description, metadata = {} }) {
    const intent = await this.stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      description,
      metadata,
      automatic_payment_methods: { enabled: true },
    })
    return { clientSecret: intent.client_secret, paymentIntentId: intent.id }
  }

  async createPortalSession({ customerId, returnUrl }) {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })
    return { url: session.url }
  }

  async refund({ paymentIntentId, amountCents }) {
    const refund = await this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amountCents || undefined, // undefined = full refund
    })
    return { refundId: refund.id }
  }
}
```

- [ ] **Step 3.2 — Write `functions/_lib/providers/SquareProvider.js`**

Stub that implements the interface with the correct Square SDK surface (bugs fixed per §7).
This is not wired in production yet — `getProvider` only activates it if `env.PAYMENT_PROVIDER === 'square'`.

```js
// Square SDK v44+ uses SquareClient with client.payments.create(), not paymentsApi
// Webhook verification: base64 HMAC-SHA256 of (notificationUrl + rawBody),
// header: x-square-hmacsha256-signature
// This stub documents the fixed interfaces for when Square is activated.

export class SquareProvider {
  constructor(env) {
    // Import dynamically to avoid bundling issues when not in use
    this._env = env
  }

  async _getClient() {
    const { SquareClient, SquareEnvironment } = await import('square')
    return new SquareClient({
      token: this._env.SQUARE_ACCESS_TOKEN,
      environment: this._env.SQUARE_ENVIRONMENT === 'production'
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
    })
  }

  async createCheckoutSession() {
    throw new Error('Square checkout sessions not yet implemented. Use Stripe.')
  }

  async createOneOffIntent({ amountCents, currency = 'USD', description, metadata = {} }) {
    const client = await this._getClient()
    // Square SDK v44+: client.payments.create() (NOT client.paymentsApi.createPayment)
    const result = await client.payments.create({
      sourceId: 'EXTERNAL',
      idempotencyKey: crypto.randomUUID(),
      amountMoney: { amount: BigInt(amountCents), currency },
      note: description,
    })
    return {
      clientSecret: null,
      paymentIntentId: result.payment?.id || null,
    }
  }

  async createPortalSession() {
    throw new Error('Square does not have a Customer Portal equivalent.')
  }

  async refund({ paymentIntentId, amountCents }) {
    const client = await this._getClient()
    // Square SDK v44+: client.refunds.refundPayment() (NOT client.refundsApi.refundPayment)
    const result = await client.refunds.refundPayment({
      idempotencyKey: crypto.randomUUID(),
      paymentId: paymentIntentId,
      amountMoney: { amount: BigInt(amountCents), currency: 'USD' },
    })
    return { refundId: result.refund?.id || null }
  }
}

// Square webhook signature verification (for use in a Square webhook handler):
// import { createHmac } from 'node:crypto'  // NOT available in Workers
// In Workers, use SubtleCrypto:
export async function verifySquareWebhook({ rawBody, signature, notificationUrl, signatureKey }) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signatureKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const data = encoder.encode(notificationUrl + rawBody)
  const mac = await crypto.subtle.sign('HMAC', key, data)
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)))
  return expected === signature
}
```

- [ ] **Step 3.3 — Write `functions/_lib/providers/getProvider.js`**

```js
import { StripeProvider } from './StripeProvider.js'
import { SquareProvider } from './SquareProvider.js'

export function getProvider(env) {
  const name = (env.PAYMENT_PROVIDER || 'stripe').toLowerCase()
  if (name === 'square') return new SquareProvider(env)
  return new StripeProvider(env)
}
```

---

## Task 4 — plans content + Pricing section

**Files:**
- Create: `src/content/plans.js`
- Create: `src/modules/Pricing.jsx`
- Modify: `src/styles/main.css` (add pricing CSS)
- Modify: `src/App.jsx` (add `<Pricing>`, handle `?payment_success` param)

**Interfaces:**
- Consumes: `getProvider(env)` (via `POST /api/payment/checkout`)
- Produces: A `Pricing` section visible in the landing page; clicking "Join Now" on a plan with a real Price ID POSTs to `/api/payment/checkout` and follows the redirect URL.

- [ ] **Step 4.1 — Write `src/content/plans.js`**

```js
// TODO(client): create products + prices in Stripe Dashboard → Products
// then fill in the stripePriceId values below.
// Stripe Dashboard → Products → Add product → Add price (recurring, monthly)
// Copy the "Price ID" (starts with price_...) into stripePriceId.

export const membershipPlans = [
  {
    id: 'unlimited',
    name: 'Unlimited',
    tagline: 'Every class. Every discipline.',
    stripePriceId: null, // e.g. 'price_1ABC...' — TODO(client)
    displayPrice: null,  // e.g. '$120/mo'        — TODO(client)
    interval: 'month',
    mode: 'subscription',
    features: [
      'Unlimited classes — all disciplines',
      'BJJ (Gi & No-Gi), Muay Thai, MMA, Krav Maga',
      'Access to open mat sessions',
      'No contracts',
    ],
    highlight: true,
  },
  {
    id: 'single',
    name: 'Single Discipline',
    tagline: 'Go deep on one art.',
    stripePriceId: null,
    displayPrice: null,
    interval: 'month',
    mode: 'subscription',
    features: [
      'Unlimited classes in one discipline',
      'Choose: BJJ, Muay Thai, MMA, or Krav Maga',
      'Kids program available',
      'No contracts',
    ],
    highlight: false,
  },
]

export const oneOffProducts = [
  {
    id: 'dropin',
    name: 'Drop-in Class',
    stripePriceId: null,
    displayPrice: null,
    mode: 'payment',
    description: 'Try any single class. No membership required.',
  },
  {
    id: 'private',
    name: 'Private Lesson',
    stripePriceId: null,
    displayPrice: null,
    mode: 'payment',
    description: '1-hour one-on-one coaching with a Madhouse instructor.',
  },
]

// Pay-directly methods (manual, no Stripe).
// TODO(client): fill in your actual Zelle email/phone, CashApp $tag, Venmo @handle.
export const manualMethods = [
  { id: 'zelle',   label: 'Zelle',    handle: null }, // e.g. 'madhousemmaandfitness@gmail.com'
  { id: 'cashapp', label: 'Cash App', handle: null }, // e.g. '$MadhouseMMA'
  { id: 'venmo',   label: 'Venmo',    handle: null }, // e.g. '@MadhouseMMA'
  { id: 'cash',    label: 'Cash',     handle: 'Drop it off at the gym — 172 Gateway Blvd, Cottage Grove' },
]
```

- [ ] **Step 4.2 — Write `src/modules/Pricing.jsx`**

```jsx
import { useState } from 'react'
import Reveal from '../components/Reveal.jsx'
import { membershipPlans, oneOffProducts } from '../content/plans.js'
import { getAttribution } from '../utils/attribution.js'
import { site } from '../content/site.js'

async function startCheckout({ priceId, mode, planName, email }) {
  const attr = getAttribution() || {}
  const res = await fetch('/api/payment/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      priceId,
      mode,
      planName,
      customerEmail: email || null,
      successUrl: window.location.origin + '/?payment_success=1',
      cancelUrl: window.location.origin + '/?payment_cancelled=1',
      ...attr,
    }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Error ${res.status}`)
  const { url } = await res.json()
  window.location.href = url
}

function PlanCard({ plan }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const unavailable = !plan.stripePriceId

  const handleJoin = async () => {
    if (unavailable) return
    setLoading(true)
    setErr(null)
    try {
      await startCheckout({ priceId: plan.stripePriceId, mode: plan.mode, planName: plan.name })
    } catch (e) {
      setErr(e.message)
      setLoading(false)
    }
  }

  return (
    <div className={`plan-card ${plan.highlight ? 'plan-card--highlight' : ''}`}>
      {plan.highlight && <span className="plan-card__badge">Most popular</span>}
      <h3 className="plan-card__name">{plan.name}</h3>
      <p className="plan-card__tagline">{plan.tagline}</p>
      <p className="plan-card__price">
        {plan.displayPrice
          ? <><strong>{plan.displayPrice}</strong></>
          : <span className="plan-card__price--todo">Pricing coming soon</span>
        }
      </p>
      <ul className="plan-card__features">
        {plan.features.map(f => <li key={f}>{f}</li>)}
      </ul>
      {err && <p className="plan-card__err">{err}</p>}
      {unavailable ? (
        <a href={site.phoneHref} className="btn btn--ghost plan-card__cta">
          Call to enroll →
        </a>
      ) : (
        <button
          className="btn btn--accent plan-card__cta"
          onClick={handleJoin}
          disabled={loading}
        >
          {loading ? 'Redirecting…' : 'Join now →'}
        </button>
      )}
    </div>
  )
}

export default function Pricing() {
  return (
    <section className="pricing" id="pricing">
      <div className="container">
        <Reveal>
          <p className="section-eyebrow">Membership</p>
          <h2 className="section-title">Simple, honest pricing</h2>
          <p className="section-sub">
            No enrollment fees. No long-term contracts. Just show up.
            {' '}<strong>Your first class is always free.</strong>
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="plan-cards">
            {membershipPlans.map(p => <PlanCard key={p.id} plan={p} />)}
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="one-off-products">
            <h3 className="one-off-products__heading">Single sessions</h3>
            <div className="one-off-products__grid">
              {oneOffProducts.map(p => (
                <div key={p.id} className="one-off-card">
                  <div>
                    <strong className="one-off-card__name">{p.name}</strong>
                    <p className="one-off-card__desc">{p.description}</p>
                  </div>
                  <p className="one-off-card__price">
                    {p.displayPrice || <span className="plan-card__price--todo">Call for price</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="pricing__portal-note">
            Already a member?{' '}
            <a href="/api/payment/portal-redirect" className="pricing__portal-link">
              Manage your membership →
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  )
}
```

- [ ] **Step 4.3 — Add CSS to `src/styles/main.css`**

Append after the `/* ─── Reduced motion overrides ─── */` block:

```css
/* ─── Pricing ───────────────────────────────────────────────────────── */
.pricing {
  padding: var(--space-24) 0;
  background: var(--bg);
}
.plan-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-6);
  margin-bottom: var(--space-12);
}
.plan-card {
  position: relative;
  background: var(--surface);
  border: 1.5px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: var(--space-8);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  transition: border-color 0.2s, transform 0.2s;
}
.plan-card:hover { border-color: rgba(232,84,32,0.4); transform: translateY(-3px); }
.plan-card--highlight { border-color: var(--accent); }
.plan-card__badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--accent);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 4px 12px;
  border-radius: 100px;
  white-space: nowrap;
}
.plan-card__name {
  font-size: 1.6rem;
  text-transform: uppercase;
  color: var(--text);
  margin: 0;
}
.plan-card__tagline { color: var(--muted); font-size: 0.9rem; margin: 0; }
.plan-card__price { font-size: 1.4rem; color: var(--text); margin: 0; }
.plan-card__price--todo { font-size: 0.9rem; color: var(--muted); font-style: italic; }
.plan-card__features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex: 1;
}
.plan-card__features li {
  font-size: 0.9rem;
  color: var(--muted);
  padding-left: var(--space-4);
  position: relative;
}
.plan-card__features li::before { content: '✓'; position: absolute; left: 0; color: var(--accent); }
.plan-card__cta { width: 100%; text-align: center; margin-top: auto; }
.plan-card__err { font-size: 0.82rem; color: #f87171; margin: 0; }

.one-off-products { margin-bottom: var(--space-8); }
.one-off-products__heading {
  font-size: 1.1rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin: 0 0 var(--space-4);
  border-top: 1px solid rgba(255,255,255,0.08);
  padding-top: var(--space-6);
}
.one-off-products__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-4);
}
.one-off-card {
  background: var(--surface);
  border-radius: 8px;
  padding: var(--space-5);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
}
.one-off-card__name { display: block; color: var(--text); margin-bottom: var(--space-1); }
.one-off-card__desc { font-size: 0.85rem; color: var(--muted); margin: 0; }
.one-off-card__price { font-size: 1.1rem; color: var(--text); white-space: nowrap; }

.pricing__portal-note { text-align: center; color: var(--muted); font-size: 0.9rem; }
.pricing__portal-link { color: var(--accent); text-decoration: none; }
.pricing__portal-link:hover { text-decoration: underline; }

/* ─── Pay-directly section ──────────────────────────────────────────── */
.pay-directly {
  padding: var(--space-16) 0;
  background: var(--surface);
}
.pay-directly__inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-12);
  align-items: start;
}
.pay-directly__methods { display: flex; flex-direction: column; gap: var(--space-4); }
.pay-method {
  background: var(--bg);
  border-radius: 8px;
  padding: var(--space-5);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.pay-method__label { font-family: var(--font-display); font-size: 1rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text); }
.pay-method__handle { color: var(--accent); font-size: 0.9rem; }
.pay-method__todo { color: var(--muted); font-size: 0.85rem; font-style: italic; }

.pay-directly__form { background: var(--bg); border-radius: 12px; padding: var(--space-6); }
.pay-directly__form h3 { font-size: 1.3rem; text-transform: uppercase; color: var(--text); margin: 0 0 var(--space-2); }
.pay-directly__form p { color: var(--muted); font-size: 0.88rem; margin: 0 0 var(--space-5); line-height: 1.55; }
.pay-directly__fields { display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-4); }
.pay-directly__input {
  background: var(--surface);
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  padding: 0.7rem 0.9rem;
  color: var(--text);
  font-family: var(--font-body);
  font-size: 0.95rem;
  width: 100%;
  transition: border-color 0.15s;
}
.pay-directly__input:focus { outline: none; border-color: var(--accent); }
.pay-directly__select {
  background: var(--surface);
  border: 1.5px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  padding: 0.7rem 0.9rem;
  color: var(--text);
  font-family: var(--font-body);
  font-size: 0.95rem;
  width: 100%;
  cursor: pointer;
}
.pay-directly__ref {
  background: rgba(232,84,32,0.08);
  border: 1.5px solid var(--accent);
  border-radius: 10px;
  padding: var(--space-5);
  text-align: center;
  margin-top: var(--space-4);
}
.pay-directly__ref-code {
  font-family: var(--font-display);
  font-size: 2rem;
  letter-spacing: 0.1em;
  color: var(--accent);
  display: block;
  margin-bottom: var(--space-2);
}
.pay-directly__ref p { color: var(--muted); font-size: 0.85rem; margin: 0; }
.pay-directly__err { color: #f87171; font-size: 0.85rem; margin: var(--space-2) 0 0; }

@media (max-width: 768px) {
  .pay-directly__inner { grid-template-columns: 1fr; }
}

/* ─── Payment toast ─────────────────────────────────────────────────── */
.payment-toast {
  position: fixed;
  bottom: var(--space-6);
  left: 50%;
  transform: translateX(-50%);
  z-index: 300;
  background: var(--surface);
  border: 1.5px solid var(--accent);
  border-radius: 10px;
  padding: var(--space-4) var(--space-6);
  display: flex;
  align-items: center;
  gap: var(--space-4);
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  white-space: nowrap;
}
.payment-toast--success { border-color: #4ade80; }
.payment-toast__icon { font-size: 1.4rem; }
.payment-toast__msg { color: var(--text); font-size: 0.95rem; }
.payment-toast__close { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 1.1rem; padding: 0; }
```

- [ ] **Step 4.4 — Update `src/App.jsx`**

Add the following imports and the `<Pricing>` section after `<Schedule />`, plus a `?payment_success=1` toast handler. Replace the current `App.jsx` completely:

```jsx
import { useState, useEffect } from 'react'
import { captureAttribution } from './utils/attribution.js'
import Nav from './modules/Nav.jsx'
import Hero from './modules/Hero.jsx'
import Marquee from './modules/Marquee.jsx'
import Lineage from './modules/Lineage.jsx'
import Programs from './modules/Programs.jsx'
import Kids from './modules/Kids.jsx'
import Coaches from './modules/Coaches.jsx'
import Schedule from './modules/Schedule.jsx'
import Pricing from './modules/Pricing.jsx'
import PayDirectly from './modules/PayDirectly.jsx'
import FirstClass from './modules/FirstClass.jsx'
import FAQ from './modules/FAQ.jsx'
import Location from './modules/Location.jsx'
import LeadMiniForm from './modules/LeadMiniForm.jsx'
import Footer from './modules/Footer.jsx'
import StickyCTA from './components/StickyCTA.jsx'
import LeadQuiz from './modules/LeadQuiz.jsx'

function PaymentToast({ onClose }) {
  const params = new URLSearchParams(window.location.search)
  const success = params.has('payment_success')
  const cancelled = params.has('payment_cancelled')
  if (!success && !cancelled) return null
  return (
    <div className={`payment-toast ${success ? 'payment-toast--success' : ''}`} role="status">
      <span className="payment-toast__icon">{success ? '🎉' : '↩️'}</span>
      <span className="payment-toast__msg">
        {success
          ? 'Payment confirmed! Welcome to Madhouse. Check your email for a receipt.'
          : 'Payment cancelled — no charge was made. Questions? Call 541-390-6334.'}
      </span>
      <button className="payment-toast__close" onClick={onClose} aria-label="Dismiss">✕</button>
    </div>
  )
}

function App() {
  const [quiz, setQuiz] = useState({ open: false, program: null })
  const [showToast, setShowToast] = useState(true)

  useEffect(() => {
    captureAttribution()
    // Remove query params from URL after reading them
    const params = new URLSearchParams(window.location.search)
    if (params.has('payment_success') || params.has('payment_cancelled')) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const openQuiz = (program = null) => setQuiz({ open: true, program })
  const closeQuiz = () => setQuiz({ open: false, program: null })

  return (
    <>
      <Nav onCTA={openQuiz} />
      <Hero onCTA={openQuiz} />
      <Marquee />
      <Lineage />
      <Programs onCTA={openQuiz} />
      <Kids onCTA={openQuiz} />
      <Coaches />
      <Schedule />
      <Pricing />
      <PayDirectly />
      <FirstClass onCTA={openQuiz} />
      <FAQ />
      <Location onCTA={openQuiz} />
      <section className="mini-form-section">
        <div className="container">
          <LeadMiniForm />
        </div>
      </section>
      <Footer />
      <StickyCTA onCTA={openQuiz} />
      <LeadQuiz open={quiz.open} program={quiz.program} onClose={closeQuiz} />
      {showToast && <PaymentToast onClose={() => setShowToast(false)} />}
    </>
  )
}

export default App
```

- [ ] **Step 4.5 — Verify build**

```powershell
cd "C:\Users\there\Desktop\AutomationStation\madhouse-mma"
npm run build
```

Expected: clean build, no errors. `dist/index.html` must contain `id="pricing"`.

---

## Task 5 — Stripe Checkout + Portal + Config endpoints

**Files:**
- Create: `functions/api/payment/config.js`
- Create: `functions/api/payment/checkout.js`
- Create: `functions/api/payment/portal.js`
- Create: `functions/api/payment/portal-redirect.js`

**Interfaces:**
- Consumes: `getProvider(env)`, `json()`, `handleOptions()`, `CORS_HEADERS` from `_lib`
- Produces:
  - `GET /api/payment/config` → `{ plans: [...], manualMethods: [...] }`
  - `POST /api/payment/checkout` → `{ url: string }` (Stripe redirect URL)
  - `POST /api/payment/portal` → `{ url: string }` (Stripe portal URL)
  - `GET /api/payment/portal-redirect` → 302 redirect to portal (needs `?customer_id=...`)

- [ ] **Step 5.1 — Write `functions/api/payment/config.js`**

```js
import { handleOptions, json } from '../../_lib/cors.js'

// Static plan definitions mirrored here so the frontend can fetch
// and render without bundling the content file into the client.
const PLANS = [
  {
    id: 'unlimited',
    name: 'Unlimited',
    tagline: 'Every class. Every discipline.',
    interval: 'month',
    mode: 'subscription',
    features: [
      'Unlimited classes — all disciplines',
      'BJJ (Gi & No-Gi), Muay Thai, MMA, Krav Maga',
      'Access to open mat sessions',
      'No contracts',
    ],
    highlight: true,
  },
  {
    id: 'single',
    name: 'Single Discipline',
    tagline: 'Go deep on one art.',
    interval: 'month',
    mode: 'subscription',
    features: [
      'Unlimited classes in one discipline',
      'Choose: BJJ, Muay Thai, MMA, or Krav Maga',
      'Kids program available',
      'No contracts',
    ],
    highlight: false,
  },
]

export function onRequestOptions() { return handleOptions() }

export function onRequestGet({ env }) {
  return json({
    plans: PLANS.map(p => ({
      ...p,
      // Only expose Price IDs if STRIPE_PUBLISHABLE_KEY is set (i.e. Stripe is configured)
      stripePriceId: env[`STRIPE_PRICE_${p.id.toUpperCase()}`] || null,
      displayPrice: env[`DISPLAY_PRICE_${p.id.toUpperCase()}`] || null,
    })),
    oneOff: [
      {
        id: 'dropin',
        name: 'Drop-in Class',
        mode: 'payment',
        stripePriceId: env.STRIPE_PRICE_DROPIN || null,
        displayPrice: env.DISPLAY_PRICE_DROPIN || null,
      },
      {
        id: 'private',
        name: 'Private Lesson',
        mode: 'payment',
        stripePriceId: env.STRIPE_PRICE_PRIVATE || null,
        displayPrice: env.DISPLAY_PRICE_PRIVATE || null,
      },
    ],
  })
}
```

Add to `.dev.vars.example`:
```
# Stripe Price IDs (create in Stripe Dashboard → Products)
# STRIPE_PRICE_UNLIMITED=price_...
# STRIPE_PRICE_SINGLE=price_...
# STRIPE_PRICE_DROPIN=price_...
# STRIPE_PRICE_PRIVATE=price_...
# Human-readable prices shown in the UI
# DISPLAY_PRICE_UNLIMITED=$120/mo
# DISPLAY_PRICE_SINGLE=$80/mo
# DISPLAY_PRICE_DROPIN=$25
# DISPLAY_PRICE_PRIVATE=$60
```

- [ ] **Step 5.2 — Write `functions/api/payment/checkout.js`**

```js
import { handleOptions, json } from '../../_lib/cors.js'
import { getProvider } from '../../_lib/providers/getProvider.js'

export function onRequestOptions() { return handleOptions() }

export async function onRequestPost({ request, env }) {
  let body
  try { body = await request.json() }
  catch { return json({ error: 'Invalid JSON' }, 400) }

  const { priceId, mode, planName, customerEmail, successUrl, cancelUrl } = body

  if (!priceId) return json({ error: 'priceId is required' }, 400)
  if (!mode || !['subscription', 'payment'].includes(mode)) {
    return json({ error: 'mode must be "subscription" or "payment"' }, 400)
  }
  if (!successUrl || !cancelUrl) return json({ error: 'successUrl and cancelUrl are required' }, 400)

  const metadata = {
    lead_id:    body.lead_id    || '',
    utm_source: body.utm_source || '',
    utm_medium: body.utm_medium || '',
    utm_campaign: body.utm_campaign || '',
    gclid:      body.gclid      || '',
    fbclid:     body.fbclid     || '',
    plan_name:  planName        || '',
  }

  try {
    const provider = getProvider(env)
    const result = await provider.createCheckoutSession({
      priceId,
      mode,
      leadId: body.lead_id || null,
      successUrl,
      cancelUrl,
      customerEmail,
      metadata,
    })
    return json({ url: result.url, sessionId: result.sessionId })
  } catch (err) {
    console.error('[checkout] error:', err.message)
    return json({ error: err.message || 'Checkout failed' }, 500)
  }
}
```

- [ ] **Step 5.3 — Write `functions/api/payment/portal.js`**

```js
import { handleOptions, json } from '../../_lib/cors.js'
import { getProvider } from '../../_lib/providers/getProvider.js'

export function onRequestOptions() { return handleOptions() }

export async function onRequestPost({ request, env }) {
  let body
  try { body = await request.json() }
  catch { return json({ error: 'Invalid JSON' }, 400) }

  const { customerId, returnUrl } = body
  if (!customerId) return json({ error: 'customerId is required' }, 400)

  try {
    const provider = getProvider(env)
    const result = await provider.createPortalSession({
      customerId,
      returnUrl: returnUrl || env.SITE_URL || 'https://madhousemmafit.com',
    })
    return json({ url: result.url })
  } catch (err) {
    console.error('[portal] error:', err.message)
    return json({ error: err.message }, 500)
  }
}
```

- [ ] **Step 5.4 — Write `functions/api/payment/portal-redirect.js`**

The "Manage membership" link in Pricing.jsx points here. It looks up the customer by email from D1.

```js
import { getStripeClient } from '../../_lib/stripe.js'

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const email = url.searchParams.get('email')

  if (!email) {
    return Response.redirect(
      (env.SITE_URL || 'https://madhousemmafit.com') + '/?portal_error=no_email',
      302,
    )
  }

  try {
    const stripe = getStripeClient(env)
    const customers = await stripe.customers.list({ email, limit: 1 })
    const customer = customers.data[0]
    if (!customer) {
      return Response.redirect(
        (env.SITE_URL || 'https://madhousemmafit.com') + '/?portal_error=not_found',
        302,
      )
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: env.SITE_URL || 'https://madhousemmafit.com',
    })
    return Response.redirect(session.url, 302)
  } catch (err) {
    console.error('[portal-redirect] error:', err.message)
    return Response.redirect(
      (env.SITE_URL || 'https://madhousemmafit.com') + '/?portal_error=server',
      302,
    )
  }
}
```

Update `Pricing.jsx` portal link to:
```jsx
<a href="/api/payment/portal-redirect?email=MEMBER_EMAIL" className="pricing__portal-link">
  Manage your membership →
</a>
```
(The email parameter is filled in by future member account logic. For now it links to the endpoint.)

- [ ] **Step 5.5 — Smoke test (requires `STRIPE_SECRET_KEY` in `.dev.vars`)**

If Stripe keys are available:
```powershell
# Start server
# (run in separate terminal): npx wrangler pages dev dist --port 8789

# Test config endpoint
Invoke-RestMethod -Uri "http://localhost:8789/api/payment/config"

# Test checkout with a real Price ID
$body = @{
  priceId    = "price_TEST_ID_HERE"
  mode       = "subscription"
  planName   = "Unlimited"
  successUrl = "http://localhost:8789/?payment_success=1"
  cancelUrl  = "http://localhost:8789/?payment_cancelled=1"
} | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8789/api/payment/checkout" -Method POST -ContentType "application/json" -Body $body
# Expected: { url: "https://checkout.stripe.com/..." }
```

If keys are not yet available: verify the endpoint returns a proper error:
```powershell
$body = @{ priceId = "price_fake"; mode = "subscription"; successUrl = "http://x/s"; cancelUrl = "http://x/c" } | ConvertTo-Json
try {
  Invoke-RestMethod -Uri "http://localhost:8789/api/payment/checkout" -Method POST -ContentType "application/json" -Body $body
} catch { Write-Output "Status: $($_.Exception.Response.StatusCode)" }
# Expected: 500 with error message about STRIPE_SECRET_KEY not set
```

---

## Task 6 — Stripe webhook handler → D1

**Files:**
- Create: `functions/api/payment/webhook.js`

**Interfaces:**
- Consumes: `getStripeClient(env)`, D1 `env.DB`
- Produces: D1 rows in `payments` and `subscriptions` tables updated on Stripe events

**Events handled:**
| Stripe event | Action |
|---|---|
| `checkout.session.completed` | Insert payment row (one-off) or subscription row stub |
| `invoice.payment_succeeded` | Insert payment row; increment `subscriptions.payment_count`; set `commission_eligible=1` when count reaches 2; update `leads.second_payment_at` |
| `invoice.payment_failed` | Insert payment row with `status='failed'` |
| `customer.subscription.created` | Upsert subscription row with `status='active'` |
| `customer.subscription.updated` | Update subscription status |
| `customer.subscription.deleted` | Set `status='cancelled'`, `cancelled_at` — do NOT set `commission_eligible=1` |

- [ ] **Step 6.1 — Write `functions/api/payment/webhook.js`**

```js
import { getStripeClient } from '../../_lib/stripe.js'

export async function onRequestPost({ request, env }) {
  // Must read raw body BEFORE any parsing — Stripe verifies signature against original bytes
  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET not set')
    return new Response('Webhook secret not configured', { status: 500 })
  }

  const stripe = getStripeClient(env)
  let event
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[webhook] signature verification failed:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  try {
    await handleEvent(event, env)
  } catch (err) {
    // Log but return 200 so Stripe doesn't retry indefinitely for logic errors
    console.error(`[webhook] handler error for ${event.type}:`, err.message)
  }

  return new Response('ok', { status: 200 })
}

async function handleEvent(event, env) {
  const db = env.DB
  const obj = event.data.object

  switch (event.type) {

    case 'checkout.session.completed': {
      if (obj.mode === 'payment') {
        // One-off payment completed
        await db.prepare(`
          INSERT OR IGNORE INTO payments
            (id, lead_id, customer_email, customer_name, amount_cents, type, status,
             provider_id, product_name, is_first_payment, utm_source, utm_medium,
             utm_campaign, gclid, fbclid)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).bind(
          lower8(),
          obj.metadata?.lead_id || null,
          obj.customer_details?.email || null,
          obj.customer_details?.name || null,
          obj.amount_total,
          'one_off',
          'completed',
          obj.payment_intent,
          obj.metadata?.plan_name || null,
          1, // first payment
          obj.metadata?.utm_source || null,
          obj.metadata?.utm_medium || null,
          obj.metadata?.utm_campaign || null,
          obj.metadata?.gclid || null,
          obj.metadata?.fbclid || null,
        ).run()

        // Update lead status to 'attended' if lead_id present
        if (obj.metadata?.lead_id) {
          await db.prepare(
            `UPDATE leads SET status='attended', member_since=datetime('now') WHERE id=?`
          ).bind(obj.metadata.lead_id).run()
        }
      }
      // subscription mode: subscription events handle the actual payment rows
      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const status = mapSubStatus(obj.status)
      await db.prepare(`
        INSERT INTO subscriptions
          (id, lead_id, customer_email, stripe_subscription_id, stripe_customer_id,
           stripe_price_id, plan_name, status, current_period_start, current_period_end)
        VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(stripe_subscription_id) DO UPDATE SET
          status=excluded.status,
          current_period_start=excluded.current_period_start,
          current_period_end=excluded.current_period_end
      `).bind(
        lower8(),
        obj.metadata?.lead_id || null,
        null, // email comes from invoice events
        obj.id,
        obj.customer,
        obj.items?.data?.[0]?.price?.id || null,
        obj.metadata?.plan_name || null,
        status,
        isoFromUnix(obj.current_period_start),
        isoFromUnix(obj.current_period_end),
      ).run()
      break
    }

    case 'customer.subscription.deleted': {
      // IMPORTANT: do NOT set commission_eligible here
      await db.prepare(`
        UPDATE subscriptions
        SET status='cancelled', cancelled_at=datetime('now')
        WHERE stripe_subscription_id=?
      `).bind(obj.id).run()
      break
    }

    case 'invoice.payment_succeeded': {
      if (!obj.subscription) break // skip standalone invoices

      const subId = obj.subscription
      const leadResult = await db.prepare(
        `SELECT lead_id, payment_count FROM subscriptions WHERE stripe_subscription_id=?`
      ).bind(subId).first()

      const prevCount = leadResult?.payment_count ?? 0
      const newCount = prevCount + 1
      const isFirst  = newCount === 1
      const isSecond = newCount === 2
      const nowEligible = newCount >= 2 ? 1 : 0

      // Insert payment row
      await db.prepare(`
        INSERT OR IGNORE INTO payments
          (id, lead_id, customer_email, customer_name, amount_cents, type, status,
           provider_id, product_name, is_first_payment, is_second_payment,
           utm_source, utm_medium, utm_campaign, gclid, fbclid)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        lower8(),
        leadResult?.lead_id || null,
        obj.customer_email || null,
        obj.customer_name  || null,
        obj.amount_paid,
        'subscription_invoice',
        'completed',
        obj.id, // invoice ID as provider_id
        null,
        isFirst  ? 1 : 0,
        isSecond ? 1 : 0,
        null, null, null, null, null, // attribution already on subscription row
      ).run()

      // Update subscription payment count + commission eligibility
      await db.prepare(`
        UPDATE subscriptions
        SET payment_count=?, commission_eligible=?
        WHERE stripe_subscription_id=?
      `).bind(newCount, nowEligible, subId).run()

      // Update lead: mark joined on first payment, second_payment_at on second
      if (leadResult?.lead_id) {
        if (isFirst) {
          await db.prepare(
            `UPDATE leads SET status='joined', member_since=datetime('now') WHERE id=?`
          ).bind(leadResult.lead_id).run()
        }
        if (isSecond) {
          await db.prepare(
            `UPDATE leads SET second_payment_at=datetime('now') WHERE id=?`
          ).bind(leadResult.lead_id).run()
        }
      }
      break
    }

    case 'invoice.payment_failed': {
      await db.prepare(`
        INSERT OR IGNORE INTO payments
          (id, customer_email, amount_cents, type, status, provider_id)
        VALUES (?,?,?,?,?,?)
      `).bind(
        lower8(),
        obj.customer_email || null,
        obj.amount_due,
        'subscription_invoice',
        'failed',
        obj.id,
      ).run()
      break
    }
  }
}

function lower8() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

function isoFromUnix(ts) {
  if (!ts) return null
  return new Date(ts * 1000).toISOString().slice(0, 19).replace('T', ' ')
}

function mapSubStatus(stripeStatus) {
  const map = { active: 'active', canceled: 'cancelled', past_due: 'past_due',
    trialing: 'trialing', incomplete: 'incomplete', incomplete_expired: 'cancelled' }
  return map[stripeStatus] || stripeStatus
}
```

- [ ] **Step 6.2 — Add webhook secret to `.dev.vars.example`**

```
# Stripe webhook signing secret (Stripe Dashboard → Webhooks → Reveal)
# STRIPE_WEBHOOK_SECRET=whsec_...
```

- [ ] **Step 6.3 — Verify webhook rejects tampered signatures**

```powershell
# Start server first (separate terminal):
# npx wrangler pages dev dist --port 8789

# Send a webhook with wrong signature — must get 400
try {
  Invoke-RestMethod `
    -Uri "http://localhost:8789/api/payment/webhook" `
    -Method POST `
    -ContentType "application/json" `
    -Headers @{ "stripe-signature" = "t=123,v1=badsig" } `
    -Body '{"type":"test","data":{"object":{}}}'
} catch {
  Write-Output "Status: $($_.Exception.Response.StatusCode)"
  # Expected: BadRequest (400)
}
```

---

## Task 7 — Manual payment endpoint

**Files:**
- Create: `functions/api/payment/manual.js`

**Interfaces:**
- Consumes: D1 `env.DB`
- Produces: `POST /api/payment/manual` → `{ ok: true, referenceCode: "MH-4A3B" }` and a row in `payments` with `status='pending'` and `type='manual'`

- [ ] **Step 7.1 — Write `functions/api/payment/manual.js`**

```js
import { handleOptions, json } from '../../_lib/cors.js'

export function onRequestOptions() { return handleOptions() }

export async function onRequestPost({ request, env }) {
  let body
  try { body = await request.json() }
  catch { return json({ error: 'Invalid JSON' }, 400) }

  const name   = (body.name   || '').trim()
  const phone  = (body.phone  || '').trim()
  const method = (body.method || '').trim()
  const plan   = (body.plan   || '').trim()

  if (!name)   return json({ error: 'Name is required'   }, 400)
  if (!phone)  return json({ error: 'Phone is required'  }, 400)
  if (!method) return json({ error: 'Method is required' }, 400)

  // Generate unique reference code, retry on collision (max 5 tries)
  let refCode = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateRefCode()
    try {
      await env.DB.prepare(`
        INSERT INTO payments (id, customer_name, type, status, provider, manual_method,
          reference_code, product_name, utm_source, utm_medium, utm_campaign, gclid, fbclid)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        crypto.randomUUID().replace(/-/g, '').slice(0, 16),
        name,
        'manual',
        'pending',
        'manual',
        method,
        candidate,
        plan || null,
        body.utm_source   || null,
        body.utm_medium   || null,
        body.utm_campaign || null,
        body.gclid        || null,
        body.fbclid       || null,
      ).run()
      refCode = candidate
      break
    } catch (err) {
      if (err.message?.includes('UNIQUE constraint failed') && attempt < 4) continue
      console.error('[manual] D1 insert error:', err.message)
      return json({ error: 'Server error. Please call us at 541-390-6334.' }, 500)
    }
  }

  if (!refCode) return json({ error: 'Could not generate reference code. Please try again.' }, 500)

  return json({ ok: true, referenceCode: refCode, name, method })
}

function generateRefCode() {
  const bytes = new Uint8Array(2)
  crypto.getRandomValues(bytes)
  return 'MH-' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('')
}
```

- [ ] **Step 7.2 — Smoke test the manual payment endpoint**

```powershell
$body = @{
  name = "Jane Smith"; phone = "5413906334"
  method = "zelle"; plan = "Unlimited"
  _t = ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - 5000)
} | ConvertTo-Json
$r = Invoke-RestMethod -Uri "http://localhost:8789/api/payment/manual" -Method POST -ContentType "application/json" -Body $body
Write-Output "Reference code: $($r.referenceCode)"
# Expected: MH-XXXX (4 hex chars)
```

- [ ] **Step 7.3 — Verify row in D1**

```powershell
npx wrangler d1 execute madhouse-leads --local --command "SELECT reference_code, customer_name, manual_method, product_name, status FROM payments ORDER BY created_at DESC LIMIT 3"
```

Expected: row with `status='pending'` and the `MH-XXXX` code you received.

---

## Task 8 — Admin payments endpoints

**Files:**
- Create: `functions/api/admin/payments.js`
- Create: `functions/api/admin/mark-paid.js`
- Modify: `functions/api/admin/leads.js` (add commission report query)

**Interfaces:**
- Consumes: `requireAdmin(request, env)` from `_lib/auth.js`
- Produces:
  - `GET /api/admin/payments` → JSON or CSV of all payment rows
  - `POST /api/admin/mark-paid` → marks manual payment as paid, updates lead status
  - `GET /api/admin/leads?report=commission` → leads with `second_payment_at IS NOT NULL`

- [ ] **Step 8.1 — Write `functions/api/admin/payments.js`**

```js
import { requireAdmin } from '../../_lib/auth.js'
import { json } from '../../_lib/cors.js'

export async function onRequestGet({ request, env }) {
  const deny = requireAdmin(request, env)
  if (deny) return deny

  const url = new URL(request.url)
  const format = url.searchParams.get('format') || 'json'
  const status = url.searchParams.get('status') || null
  const type   = url.searchParams.get('type')   || null
  const limit  = Math.min(parseInt(url.searchParams.get('limit')  || '200', 10), 1000)
  const offset = parseInt(url.searchParams.get('offset') || '0', 10)

  let query = 'SELECT * FROM payments'
  const binds = []
  const where = []
  if (status) { where.push('status=?'); binds.push(status) }
  if (type)   { where.push('type=?');   binds.push(type)   }
  if (where.length) query += ' WHERE ' + where.join(' AND ')
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  binds.push(limit, offset)

  const { results } = await env.DB.prepare(query).bind(...binds).all()

  // Commission summary
  const { results: [commission] } = await env.DB.prepare(`
    SELECT
      COUNT(*) as total_members,
      SUM(CASE WHEN commission_eligible=1 THEN 1 ELSE 0 END) as eligible_for_commission
    FROM subscriptions WHERE status='active'
  `).all()

  if (format === 'csv') {
    const COLS = ['id','created_at','customer_name','customer_email','amount_cents','type',
      'status','provider','provider_id','product_name','reference_code','manual_method',
      'marked_paid_at','is_first_payment','is_second_payment','lead_id']
    const esc = v => v == null ? '' : String(v).includes(',') ? `"${String(v).replace(/"/g,'""')}"` : String(v)
    const csv = [COLS.join(','), ...results.map(r => COLS.map(c => esc(r[c])).join(','))].join('\n')
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="madhouse-payments-${new Date().toISOString().slice(0,10)}.csv"`,
      },
    })
  }

  return json({ payments: results, count: results.length, commission })
}
```

- [ ] **Step 8.2 — Write `functions/api/admin/mark-paid.js`**

```js
import { requireAdmin } from '../../_lib/auth.js'
import { json } from '../../_lib/cors.js'

export async function onRequestPost({ request, env }) {
  const deny = requireAdmin(request, env)
  if (deny) return deny

  let body
  try { body = await request.json() }
  catch { return json({ error: 'Invalid JSON' }, 400) }

  const { referenceCode, note, leadId } = body
  if (!referenceCode) return json({ error: 'referenceCode is required' }, 400)

  const existing = await env.DB.prepare(
    `SELECT id, status, type FROM payments WHERE reference_code=?`
  ).bind(referenceCode).first()

  if (!existing) return json({ error: 'Payment not found' }, 404)
  if (existing.status === 'completed') return json({ error: 'Already marked as paid' }, 409)

  await env.DB.prepare(`
    UPDATE payments
    SET status='completed', marked_paid_at=datetime('now'), marked_paid_by=?,
        lead_id=COALESCE(lead_id, ?), is_first_payment=1
    WHERE reference_code=?
  `).bind(note || null, leadId || null, referenceCode).run()

  // If lead_id provided, update lead status
  if (leadId) {
    await env.DB.prepare(
      `UPDATE leads SET status='joined', member_since=datetime('now') WHERE id=?`
    ).bind(leadId).run()
  }

  return json({ ok: true, referenceCode })
}
```

- [ ] **Step 8.3 — Add commission report query to `functions/api/admin/leads.js`**

Add a branch for `?report=commission` that returns only commission-eligible leads. Find the `onRequestGet` function in `functions/api/admin/leads.js` and add before the main query block:

```js
// Commission report — leads whose second payment has cleared
if (url.searchParams.get('report') === 'commission') {
  const { results } = await env.DB.prepare(`
    SELECT l.id, l.name, l.phone, l.email, l.member_since, l.second_payment_at,
           l.utm_source, l.utm_campaign, l.gclid, l.fbclid,
           s.plan_name, s.payment_count, s.stripe_subscription_id
    FROM leads l
    LEFT JOIN subscriptions s ON s.lead_id = l.id
    WHERE l.second_payment_at IS NOT NULL
    ORDER BY l.second_payment_at DESC
  `).all()
  return new Response(JSON.stringify({ commission_leads: results, count: results.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
```

---

## Task 9 — PayDirectly frontend section

**Files:**
- Create: `src/modules/PayDirectly.jsx`

**Interfaces:**
- Consumes: `POST /api/payment/manual`, `getAttribution()`, `src/content/plans.js`
- Produces: A section showing manual payment handles + a form that generates a reference code

- [ ] **Step 9.1 — Write `src/modules/PayDirectly.jsx`**

```jsx
import { useState, useRef } from 'react'
import Reveal from '../components/Reveal.jsx'
import { manualMethods, membershipPlans } from '../content/plans.js'
import { getAttribution } from '../utils/attribution.js'

const ALL_METHODS = manualMethods.filter(m => m.handle !== null)
const HAS_METHODS = ALL_METHODS.length > 0

export default function PayDirectly() {
  const [form, setForm] = useState({ name: '', phone: '', method: '', plan: '' })
  const [status, setStatus] = useState('idle') // idle | submitting | success | error
  const [result, setResult] = useState(null)
  const [errMsg, setErrMsg] = useState('')
  const startTime = useRef(Date.now())

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.phone || !form.method) return
    setStatus('submitting')
    setErrMsg('')
    const attr = getAttribution() || {}
    try {
      const res = await fetch('/api/payment/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, _t: startTime.current, ...attr }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Error ${res.status}`)
      const data = await res.json()
      setResult(data)
      setStatus('success')
    } catch (err) {
      setErrMsg(err.message)
      setStatus('error')
    }
  }

  return (
    <section className="pay-directly" id="pay-directly">
      <div className="container">
        <Reveal>
          <p className="section-eyebrow">Other payment options</p>
          <h2 className="section-title">Pay directly</h2>
          <p className="section-sub">
            Prefer Zelle, Cash App, Venmo, or cash? No problem.
            Fill in your name below and we'll give you a reference code to include with your payment
            so we can match it instantly.
          </p>
        </Reveal>

        <div className="pay-directly__inner">
          <Reveal>
            <div className="pay-directly__methods">
              {manualMethods.map(m => (
                <div key={m.id} className="pay-method">
                  <span className="pay-method__label">{m.label}</span>
                  {m.handle
                    ? <span className="pay-method__handle">{m.handle}</span>
                    : <span className="pay-method__todo">Coming soon — call us</span>
                  }
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            {status === 'success' && result ? (
              <div className="pay-directly__form">
                <h3>Your reference code</h3>
                <p>Include this code in your payment note so we know it's from you.</p>
                <div className="pay-directly__ref">
                  <span className="pay-directly__ref-code">{result.referenceCode}</span>
                  <p>Send your payment to the {result.method} handle above, then text us at{' '}
                    <a href="tel:+15413906334">541-390-6334</a> with this code.
                    We'll confirm within a few hours.
                  </p>
                </div>
              </div>
            ) : (
              <form className="pay-directly__form" onSubmit={handleSubmit} noValidate>
                <h3>Get a reference code</h3>
                <p>We'll give you a unique code to include in your payment note.</p>
                <div className="pay-directly__fields">
                  <input
                    className="pay-directly__input"
                    type="text"
                    placeholder="Your name *"
                    required
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                  />
                  <input
                    className="pay-directly__input"
                    type="tel"
                    placeholder="Your phone number *"
                    required
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                  />
                  <select
                    className="pay-directly__select"
                    required
                    value={form.method}
                    onChange={e => set('method', e.target.value)}
                  >
                    <option value="">Which method will you use? *</option>
                    {manualMethods.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                  <select
                    className="pay-directly__select"
                    value={form.plan}
                    onChange={e => set('plan', e.target.value)}
                  >
                    <option value="">Which membership? (optional)</option>
                    {membershipPlans.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                    <option value="Drop-in">Drop-in class</option>
                    <option value="Private Lesson">Private lesson</option>
                  </select>
                </div>
                {errMsg && <p className="pay-directly__err">{errMsg}</p>}
                <button
                  type="submit"
                  className="btn btn--accent"
                  style={{ width: '100%' }}
                  disabled={status === 'submitting'}
                >
                  {status === 'submitting' ? 'Generating code…' : 'Get my reference code →'}
                </button>
              </form>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  )
}
```

---

## Task 10 — Standalone admin dashboard

**Files:**
- Create: `public/admin/index.html`

**Interfaces:**
- Consumes: `GET /api/admin/leads`, `GET /api/admin/payments`, `POST /api/admin/mark-paid`, `GET /api/admin/leads?report=commission`
- Produces: A password-protected, no-build-step HTML dashboard at `/admin/`

- [ ] **Step 10.1 — Write `public/admin/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Madhouse MMA — Admin</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: #0b0b0c; color: #f2efe9; font-family: system-ui, sans-serif; font-size: 14px; }
  .login { max-width: 400px; margin: 80px auto; padding: 32px; background: #151517; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); }
  .login h1 { font-size: 1.4rem; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 24px; }
  input { width: 100%; background: #0b0b0c; border: 1.5px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 10px 12px; color: #f2efe9; font-size: 14px; margin-bottom: 12px; }
  input:focus { outline: none; border-color: #e85420; }
  button { cursor: pointer; }
  .btn { background: #e85420; color: #fff; border: none; border-radius: 6px; padding: 10px 20px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; }
  .btn:hover { background: #c94718; }
  .btn-sm { background: rgba(232,84,32,0.15); color: #e85420; border: 1px solid #e85420; border-radius: 4px; padding: 4px 10px; font-size: 12px; }
  .btn-sm:hover { background: #e85420; color: #fff; }
  .btn-ghost { background: transparent; color: #a39f97; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; padding: 4px 10px; font-size: 12px; }
  .btn-ghost:hover { color: #f2efe9; border-color: rgba(255,255,255,0.4); }
  .app { display: none; flex-direction: column; min-height: 100vh; }
  header { background: #151517; border-bottom: 1px solid rgba(255,255,255,0.06); padding: 12px 24px; display: flex; align-items: center; gap: 24px; }
  header h1 { margin: 0; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.06em; }
  .tabs { display: flex; gap: 8px; margin-left: auto; }
  .tab { background: none; border: none; color: #a39f97; padding: 6px 14px; border-radius: 6px; font-size: 13px; cursor: pointer; transition: background 0.15s, color 0.15s; }
  .tab.active, .tab:hover { background: rgba(232,84,32,0.15); color: #e85420; }
  .logout { margin-left: 24px; background: none; border: none; color: #a39f97; font-size: 13px; cursor: pointer; }
  .logout:hover { color: #f2efe9; }
  main { padding: 24px; flex: 1; }
  .panel { display: none; }
  .panel.active { display: block; }
  .stat-row { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
  .stat { background: #151517; border-radius: 8px; padding: 16px 20px; flex: 1; min-width: 140px; }
  .stat-val { font-size: 2rem; font-weight: 700; color: #e85420; line-height: 1; margin-bottom: 4px; }
  .stat-lbl { font-size: 12px; color: #a39f97; text-transform: uppercase; letter-spacing: 0.08em; }
  .tbl-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.08); color: #a39f97; font-weight: 600; white-space: nowrap; }
  td { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
  tr:hover td { background: rgba(255,255,255,0.02); }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 100px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .badge-new { background: rgba(96,165,250,0.15); color: #60a5fa; }
  .badge-joined { background: rgba(74,222,128,0.15); color: #4ade80; }
  .badge-completed { background: rgba(74,222,128,0.15); color: #4ade80; }
  .badge-pending { background: rgba(251,191,36,0.15); color: #fbbf24; }
  .badge-lost { background: rgba(248,113,113,0.15); color: #f87171; }
  .badge-cancelled { background: rgba(248,113,113,0.15); color: #f87171; }
  .badge-contacted,.badge-booked,.badge-attended { background: rgba(232,84,32,0.15); color: #e85420; }
  select.status-sel { background: #0b0b0c; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #f2efe9; padding: 3px 6px; font-size: 12px; cursor: pointer; }
  .err { color: #f87171; padding: 12px; background: rgba(248,113,113,0.1); border-radius: 6px; margin-bottom: 16px; }
  .export-row { display: flex; gap: 8px; margin-bottom: 16px; align-items: center; }
  .export-row span { font-size: 12px; color: #a39f97; }
  .search { background: #151517; border: 1.5px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 12px; color: #f2efe9; font-size: 13px; width: 280px; margin-bottom: 16px; }
  .search:focus { outline: none; border-color: #e85420; }
  .empty { color: #a39f97; text-align: center; padding: 40px; }
</style>
</head>
<body>

<div class="login" id="login-panel">
  <h1>🥊 Madhouse Admin</h1>
  <p style="color:#a39f97;margin:0 0 20px;font-size:13px;">Enter your admin token to continue.</p>
  <input type="password" id="token-input" placeholder="Admin token" autocomplete="current-password">
  <p id="login-err" style="color:#f87171;font-size:13px;margin:0 0 12px;display:none"></p>
  <button class="btn" onclick="doLogin()">Sign in</button>
</div>

<div class="app" id="app">
  <header>
    <h1>🥊 Madhouse Admin</h1>
    <nav class="tabs">
      <button class="tab active" onclick="showTab('leads', this)">Leads</button>
      <button class="tab" onclick="showTab('payments', this)">Payments</button>
      <button class="tab" onclick="showTab('manual', this)">Manual Pending</button>
      <button class="tab" onclick="showTab('commission', this)">Commission</button>
    </nav>
    <button class="logout" onclick="doLogout()">Sign out</button>
  </header>

  <main>
    <div id="err-banner" class="err" style="display:none"></div>

    <!-- Leads panel -->
    <div class="panel active" id="panel-leads">
      <div class="stat-row" id="lead-stats"></div>
      <div class="export-row">
        <button class="btn-ghost" onclick="exportCSV('leads')">Export CSV</button>
        <input class="search" type="search" placeholder="Search name / phone / email…" oninput="filterTable('leads-tbl', this.value)">
      </div>
      <div class="tbl-wrap"><table id="leads-tbl">
        <thead><tr><th>Date</th><th>Name</th><th>Phone</th><th>Program</th><th>Source</th><th>Status</th><th></th></tr></thead>
        <tbody id="leads-body"><tr><td colspan="7" class="empty">Loading…</td></tr></tbody>
      </table></div>
    </div>

    <!-- Payments panel -->
    <div class="panel" id="panel-payments">
      <div class="export-row">
        <button class="btn-ghost" onclick="exportCSV('payments')">Export CSV</button>
        <span id="commission-summary"></span>
      </div>
      <div class="tbl-wrap"><table id="payments-tbl">
        <thead><tr><th>Date</th><th>Name</th><th>Type</th><th>Amount</th><th>Plan</th><th>Status</th><th>1st</th><th>2nd</th></tr></thead>
        <tbody id="payments-body"><tr><td colspan="8" class="empty">Loading…</td></tr></tbody>
      </table></div>
    </div>

    <!-- Manual pending panel -->
    <div class="panel" id="panel-manual">
      <p style="color:#a39f97;margin:0 0 16px;font-size:13px;">Mark payments as paid once you confirm receipt.</p>
      <div class="tbl-wrap"><table id="manual-tbl">
        <thead><tr><th>Date</th><th>Name</th><th>Method</th><th>Plan</th><th>Ref Code</th><th>Status</th><th></th></tr></thead>
        <tbody id="manual-body"><tr><td colspan="7" class="empty">Loading…</td></tr></tbody>
      </table></div>
    </div>

    <!-- Commission panel -->
    <div class="panel" id="panel-commission">
      <p style="color:#a39f97;margin:0 0 16px;font-size:13px;">Members whose second payment has cleared — commission is owed for these.</p>
      <div class="export-row">
        <button class="btn-ghost" onclick="exportCSV('commission')">Export CSV</button>
      </div>
      <div class="tbl-wrap"><table id="commission-tbl">
        <thead><tr><th>Name</th><th>Phone</th><th>Joined</th><th>2nd Payment</th><th>Plan</th><th>Source</th></tr></thead>
        <tbody id="commission-body"><tr><td colspan="6" class="empty">Loading…</td></tr></tbody>
      </table></div>
    </div>
  </main>
</div>

<script>
let TOKEN = sessionStorage.getItem('mh_admin_token') || ''
const STATUSES = ['new','contacted','booked','attended','joined','lost']

function doLogin() {
  TOKEN = document.getElementById('token-input').value.trim()
  if (!TOKEN) return
  sessionStorage.setItem('mh_admin_token', TOKEN)
  loadAll()
}
document.getElementById('token-input').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin() })

function doLogout() {
  TOKEN = ''; sessionStorage.removeItem('mh_admin_token')
  document.getElementById('app').style.display = 'none'
  document.getElementById('login-panel').style.display = 'block'
}

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(opts.headers||{}) }, ...opts })
  if (res.status === 401) { doLogout(); throw new Error('Unauthorized — check your token.') }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function showErr(msg) {
  const el = document.getElementById('err-banner')
  el.textContent = msg; el.style.display = 'block'
  setTimeout(() => { el.style.display = 'none' }, 6000)
}

function showTab(name, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
  document.getElementById('panel-' + name).classList.add('active')
  btn.classList.add('active')
}

function badge(status) {
  return `<span class="badge badge-${status}">${status}</span>`
}

function fmt(isoDate) {
  if (!isoDate) return '—'
  return isoDate.slice(0,10)
}

function cents(n) {
  if (!n) return '—'
  return '$' + (n/100).toFixed(2)
}

function filterTable(tableId, query) {
  const q = query.toLowerCase()
  document.querySelectorAll(`#${tableId} tbody tr`).forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none'
  })
}

async function loadAll() {
  document.getElementById('login-panel').style.display = 'none'
  document.getElementById('app').style.display = 'flex'
  await Promise.allSettled([loadLeads(), loadPayments(), loadManual(), loadCommission()])
}

async function loadLeads() {
  try {
    const data = await api('/api/admin/leads?limit=500')
    const leads = data.leads || []
    // Stats
    const byStatus = {}
    leads.forEach(l => { byStatus[l.status] = (byStatus[l.status]||0)+1 })
    document.getElementById('lead-stats').innerHTML = [
      ['Total', leads.length], ['New', byStatus.new||0], ['Joined', byStatus.joined||0], ['Lost', byStatus.lost||0]
    ].map(([l,v]) => `<div class="stat"><div class="stat-val">${v}</div><div class="stat-lbl">${l}</div></div>`).join('')
    // Table
    document.getElementById('leads-body').innerHTML = leads.length === 0
      ? '<tr><td colspan="7" class="empty">No leads yet.</td></tr>'
      : leads.map(l => `<tr>
          <td>${fmt(l.created_at)}</td>
          <td>${esc(l.name)}</td>
          <td><a href="tel:${l.phone}" style="color:#e85420">${esc(l.phone)}</a></td>
          <td>${esc(l.program_interest||'—')}</td>
          <td>${esc(l.utm_source||l.referrer||'direct')}</td>
          <td>${badge(l.status)}</td>
          <td>
            <select class="status-sel" onchange="updateLeadStatus('${l.id}', this.value)">
              ${STATUSES.map(s => `<option ${s===l.status?'selected':''}>${s}</option>`).join('')}
            </select>
          </td>
        </tr>`).join('')
  } catch (err) { showErr('Leads: ' + err.message) }
}

async function updateLeadStatus(id, status) {
  try {
    await api(`/api/admin/leads`, { method: 'PATCH', body: JSON.stringify({ id, status }) })
  } catch (err) { showErr(err.message) }
}

async function loadPayments() {
  try {
    const data = await api('/api/admin/payments?limit=500')
    const pmts = data.payments || []
    if (data.commission) {
      document.getElementById('commission-summary').textContent =
        `Active members: ${data.commission.total_members} | Commission-eligible: ${data.commission.eligible_for_commission}`
    }
    document.getElementById('payments-body').innerHTML = pmts.length === 0
      ? '<tr><td colspan="8" class="empty">No payments yet.</td></tr>'
      : pmts.filter(p => p.type !== 'manual').map(p => `<tr>
          <td>${fmt(p.created_at)}</td>
          <td>${esc(p.customer_name||'—')}</td>
          <td>${esc(p.type)}</td>
          <td>${cents(p.amount_cents)}</td>
          <td>${esc(p.product_name||'—')}</td>
          <td>${badge(p.status)}</td>
          <td>${p.is_first_payment ? '✓' : ''}</td>
          <td>${p.is_second_payment ? '✓' : ''}</td>
        </tr>`).join('')
  } catch (err) { showErr('Payments: ' + err.message) }
}

async function loadManual() {
  try {
    const data = await api('/api/admin/payments?type=manual&limit=200')
    const pmts = data.payments || []
    const pending = pmts.filter(p => p.status === 'pending')
    document.getElementById('manual-body').innerHTML = pending.length === 0
      ? '<tr><td colspan="7" class="empty">No pending manual payments.</td></tr>'
      : pending.map(p => `<tr>
          <td>${fmt(p.created_at)}</td>
          <td>${esc(p.customer_name||'—')}</td>
          <td>${esc(p.manual_method||'—')}</td>
          <td>${esc(p.product_name||'—')}</td>
          <td style="font-family:monospace;color:#e85420">${esc(p.reference_code)}</td>
          <td>${badge(p.status)}</td>
          <td><button class="btn-sm" onclick="markPaid('${p.reference_code}', this)">Mark paid</button></td>
        </tr>`).join('')
  } catch (err) { showErr('Manual: ' + err.message) }
}

async function markPaid(refCode, btn) {
  btn.disabled = true; btn.textContent = '…'
  try {
    await api('/api/admin/mark-paid', { method: 'POST', body: JSON.stringify({ referenceCode: refCode }) })
    await loadManual()
    await loadPayments()
  } catch (err) { showErr(err.message); btn.disabled = false; btn.textContent = 'Mark paid' }
}

async function loadCommission() {
  try {
    const data = await api('/api/admin/leads?report=commission')
    const leads = data.commission_leads || []
    document.getElementById('commission-body').innerHTML = leads.length === 0
      ? '<tr><td colspan="6" class="empty">No commission-eligible members yet.</td></tr>'
      : leads.map(l => `<tr>
          <td>${esc(l.name)}</td>
          <td>${esc(l.phone)}</td>
          <td>${fmt(l.member_since)}</td>
          <td>${fmt(l.second_payment_at)}</td>
          <td>${esc(l.plan_name||'—')}</td>
          <td>${esc(l.utm_source||'direct')}</td>
        </tr>`).join('')
  } catch (err) { showErr('Commission: ' + err.message) }
}

async function exportCSV(type) {
  const paths = { leads: '/api/admin/leads?format=csv', payments: '/api/admin/payments?format=csv', commission: '/api/admin/leads?report=commission' }
  const path = paths[type]
  if (!path) return
  const url = path + (path.includes('?') ? '&' : '?') + `t=${Date.now()}`
  const a = document.createElement('a')
  a.href = url; a.download = `madhouse-${type}.csv`
  // Add auth header via fetch → blob
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })
  if (!res.ok) { showErr('Export failed'); return }
  const blob = type === 'commission' ? new Blob([JSON.stringify(await res.json(), null, 2)], {type:'application/json'}) : await res.blob()
  a.href = URL.createObjectURL(blob)
  a.click()
}

function esc(s) {
  if (!s) return '—'
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

// Auto-login if token stored
if (TOKEN) loadAll()
</script>
</body>
</html>
```

---

## Task 11 — Admin PATCH lead status

**Files:**
- Modify: `functions/api/admin/leads.js` (add PATCH handler for status updates)

**Interfaces:**
- Consumes: `requireAdmin(request, env)`, D1
- Produces: `PATCH /api/admin/leads` body `{ id, status }` → updates `leads.status`

- [ ] **Step 11.1 — Add `onRequestPatch` to `functions/api/admin/leads.js`**

```js
export async function onRequestPatch({ request, env }) {
  const deny = requireAdmin(request, env)
  if (deny) return deny

  let body
  try { body = await request.json() }
  catch { return new Response('Invalid JSON', { status: 400 }) }

  const { id, status } = body
  const VALID = ['new','contacted','booked','attended','joined','lost']
  if (!id) return new Response('id required', { status: 400 })
  if (!VALID.includes(status)) return new Response(`status must be one of: ${VALID.join(', ')}`, { status: 400 })

  await env.DB.prepare(`UPDATE leads SET status=? WHERE id=?`).bind(status, id).run()
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
}
```

Also add the `requireAdmin` import to leads.js:
```js
import { requireAdmin } from '../../_lib/auth.js'
```

---

## Task 12 — Full build + end-to-end verification

**Files:** No new files — validation step.

- [ ] **Step 12.1 — Install stripe (verify)**

```powershell
cd "C:\Users\there\Desktop\AutomationStation\madhouse-mma"
npm list stripe
# Expected: stripe@17.x.x or similar
```

- [ ] **Step 12.2 — Production build**

```powershell
npm run build
```

Expected: clean build. `dist/index.html` must contain `id="pricing"` and `id="pay-directly"`.

Verify:
```powershell
$html = Get-Content dist/index.html -Raw
@('id="pricing"','id="pay-directly"','Simple, honest pricing','Pay directly') | ForEach-Object {
  Write-Output "$(if($html -match [regex]::Escape($_)){'[OK]'}else{'[MISS]'}) $_"
}
```

- [ ] **Step 12.3 — Apply migrations**

```powershell
npx wrangler d1 execute madhouse-leads --file=migrations/0002_payments.sql --local
npx wrangler d1 execute madhouse-leads --file=migrations/0002_payments.sql --remote
```

- [ ] **Step 12.4 — Start Pages dev server**

```powershell
# In a separate terminal — leave running for the remaining steps:
npx wrangler pages dev dist --port 8789
```

- [ ] **Step 12.5 — Test manual payment end-to-end**

```powershell
$body = @{ name="Real Member"; phone="5413906334"; method="zelle"; plan="Unlimited"; _t=([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-5000) } | ConvertTo-Json
$r = Invoke-RestMethod -Uri "http://localhost:8789/api/payment/manual" -Method POST -ContentType "application/json" -Body $body
Write-Output "Ref code: $($r.referenceCode)"

# Verify in D1
npx wrangler d1 execute madhouse-leads --local --command "SELECT reference_code, customer_name, status FROM payments ORDER BY created_at DESC LIMIT 1"
# Expected: pending row with MH-XXXX code
```

- [ ] **Step 12.6 — Test admin endpoints (requires `.dev.vars` with ADMIN_TOKEN)**

Create `.dev.vars` from `.dev.vars.example`:
```
ADMIN_TOKEN=test-admin-token-local
```

```powershell
# List payments
$r = Invoke-RestMethod -Uri "http://localhost:8789/api/admin/payments" -Headers @{ Authorization = "Bearer test-admin-token-local" }
Write-Output "Total payments: $($r.count)"

# Mark the manual payment as paid
$body = @{ referenceCode = "REPLACE-WITH-CODE-FROM-STEP-12.5" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8789/api/admin/mark-paid" -Method POST -ContentType "application/json" -Headers @{ Authorization = "Bearer test-admin-token-local" } -Body $body

# Verify status updated
npx wrangler d1 execute madhouse-leads --local --command "SELECT reference_code, status, marked_paid_at FROM payments ORDER BY created_at DESC LIMIT 1"
# Expected: status='completed', marked_paid_at set
```

- [ ] **Step 12.7 — Test admin dashboard loads**

Open `http://localhost:8789/admin/` in a browser. Enter `test-admin-token-local`. Verify:
- Leads tab shows existing test leads
- Payments tab shows the manual payment row
- Manual Pending tab shows nothing (we just marked it paid)
- Commission tab shows empty (no second payments yet)

- [ ] **Step 12.8 — Clean test data**

```powershell
npx wrangler d1 execute madhouse-leads --local --command "DELETE FROM payments WHERE customer_name='Real Member'"
```

- [ ] **Step 12.9 — Commit**

```powershell
cd "C:\Users\there\Desktop\AutomationStation\madhouse-mma"
git init
git remote add origin https://github.com/o87enterprises-ai/madhouse-mma.git
git add -A
git commit -m "feat: Batch 2 — Stripe subscriptions, manual payments, webhook→D1, admin dashboard"
```

---

## Post-batch checklist (share with client)

Before the payments system can go live, the client must:

1. **Create a Stripe account** at stripe.com
2. **Create Products + Prices** in Stripe Dashboard → Products (monthly recurring for membership plans, one-time for drop-in/private)
3. **Run `wrangler secret put`** for each secret:
   - `STRIPE_SECRET_KEY` (from Stripe Dashboard → API Keys)
   - `STRIPE_PUBLISHABLE_KEY` (same page)
   - `STRIPE_WEBHOOK_SECRET` (from Stripe Dashboard → Webhooks → Add endpoint → reveal secret)
   - `STRIPE_PRICE_UNLIMITED`, `STRIPE_PRICE_SINGLE`, `STRIPE_PRICE_DROPIN`, `STRIPE_PRICE_PRIVATE`
   - `DISPLAY_PRICE_UNLIMITED` etc. (human-readable strings shown in UI)
   - `ADMIN_TOKEN` (a strong random string — the owner's dashboard password)
4. **Register the Stripe webhook endpoint** pointing to `https://yourdomain.com/api/payment/webhook`, selecting events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_succeeded`, `invoice.payment_failed`
5. **Fill in Zelle/CashApp/Venmo handles** in `src/content/plans.js → manualMethods`
6. **Add `SITE_URL`** secret pointing to the live domain (for portal redirect return URL)
