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
    lead_id:      body.lead_id      || '',
    utm_source:   body.utm_source   || '',
    utm_medium:   body.utm_medium   || '',
    utm_campaign: body.utm_campaign || '',
    gclid:        body.gclid        || '',
    fbclid:       body.fbclid       || '',
    plan_name:    planName          || '',
  }

  try {
    const provider = getProvider(env)
    const result = await provider.createCheckoutSession({
      priceId, mode, leadId: body.lead_id || null,
      successUrl, cancelUrl, customerEmail, metadata,
    })
    return json({ url: result.url, sessionId: result.sessionId })
  } catch (err) {
    console.error('[checkout]', err.message)
    return json({ error: err.message || 'Checkout failed' }, 500)
  }
}
