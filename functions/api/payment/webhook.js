import { getStripeClient } from '../../_lib/stripe.js'

export async function onRequestPost({ request, env }) {
  // Raw body MUST be read before any parsing — Stripe verifies against original bytes
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
    console.error('[webhook] signature failed:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  try {
    await handleEvent(event, env)
  } catch (err) {
    // Log but return 200 — logic errors should not cause Stripe to retry forever
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
        await db.prepare(`
          INSERT OR IGNORE INTO payments
            (id, lead_id, customer_email, customer_name, amount_cents, type, status,
             provider_id, product_name, is_first_payment, utm_source, utm_medium,
             utm_campaign, gclid, fbclid)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `).bind(
          uid(),
          obj.metadata?.lead_id || null,
          obj.customer_details?.email || null,
          obj.customer_details?.name  || null,
          obj.amount_total,
          'one_off', 'completed',
          obj.payment_intent,
          obj.metadata?.plan_name || null,
          1,
          obj.metadata?.utm_source   || null,
          obj.metadata?.utm_medium   || null,
          obj.metadata?.utm_campaign || null,
          obj.metadata?.gclid        || null,
          obj.metadata?.fbclid       || null,
        ).run()

        if (obj.metadata?.lead_id) {
          await db.prepare(
            `UPDATE leads SET status='attended', member_since=datetime('now') WHERE id=?`
          ).bind(obj.metadata.lead_id).run()
        }
      }
      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      await db.prepare(`
        INSERT INTO subscriptions
          (id, lead_id, stripe_subscription_id, stripe_customer_id,
           stripe_price_id, plan_name, status, current_period_start, current_period_end)
        VALUES (?,?,?,?,?,?,?,?,?)
        ON CONFLICT(stripe_subscription_id) DO UPDATE SET
          status=excluded.status,
          current_period_start=excluded.current_period_start,
          current_period_end=excluded.current_period_end
      `).bind(
        uid(),
        obj.metadata?.lead_id || null,
        obj.id,
        obj.customer,
        obj.items?.data?.[0]?.price?.id || null,
        obj.metadata?.plan_name || null,
        mapSubStatus(obj.status),
        isoFromUnix(obj.current_period_start),
        isoFromUnix(obj.current_period_end),
      ).run()
      break
    }

    case 'customer.subscription.deleted': {
      // IMPORTANT: do NOT set commission_eligible here — member cancelled before qualifying
      await db.prepare(`
        UPDATE subscriptions
        SET status='cancelled', cancelled_at=datetime('now')
        WHERE stripe_subscription_id=?
      `).bind(obj.id).run()
      break
    }

    case 'invoice.payment_succeeded': {
      if (!obj.subscription) break

      const subRow = await db.prepare(
        `SELECT lead_id, payment_count FROM subscriptions WHERE stripe_subscription_id=?`
      ).bind(obj.subscription).first()

      const prevCount = subRow?.payment_count ?? 0
      const newCount  = prevCount + 1
      const isFirst   = newCount === 1
      const isSecond  = newCount === 2
      const eligible  = newCount >= 2 ? 1 : 0

      await db.prepare(`
        INSERT OR IGNORE INTO payments
          (id, lead_id, customer_email, customer_name, amount_cents, type, status,
           provider_id, is_first_payment, is_second_payment)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `).bind(
        uid(),
        subRow?.lead_id || null,
        obj.customer_email || null,
        obj.customer_name  || null,
        obj.amount_paid,
        'subscription_invoice', 'completed',
        obj.id,
        isFirst  ? 1 : 0,
        isSecond ? 1 : 0,
      ).run()

      await db.prepare(`
        UPDATE subscriptions SET payment_count=?, commission_eligible=?
        WHERE stripe_subscription_id=?
      `).bind(newCount, eligible, obj.subscription).run()

      if (subRow?.lead_id) {
        if (isFirst) {
          await db.prepare(
            `UPDATE leads SET status='joined', member_since=datetime('now') WHERE id=?`
          ).bind(subRow.lead_id).run()
        }
        if (isSecond) {
          await db.prepare(
            `UPDATE leads SET second_payment_at=datetime('now') WHERE id=?`
          ).bind(subRow.lead_id).run()
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
        uid(),
        obj.customer_email || null,
        obj.amount_due,
        'subscription_invoice', 'failed',
        obj.id,
      ).run()
      break
    }
  }
}

function uid() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16)
}

function isoFromUnix(ts) {
  if (!ts) return null
  return new Date(ts * 1000).toISOString().slice(0, 19).replace('T', ' ')
}

function mapSubStatus(s) {
  return { active: 'active', canceled: 'cancelled', past_due: 'past_due',
    trialing: 'trialing', incomplete: 'incomplete', incomplete_expired: 'cancelled' }[s] || s
}
