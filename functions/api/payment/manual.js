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

  // Generate unique reference code, retry on UNIQUE collision (max 5 tries)
  for (let attempt = 0; attempt < 5; attempt++) {
    const refCode = genRefCode()
    try {
      await env.DB.prepare(`
        INSERT INTO payments (id, customer_name, type, status, provider, manual_method,
          reference_code, product_name, utm_source, utm_medium, utm_campaign, gclid, fbclid)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        crypto.randomUUID().replace(/-/g, '').slice(0, 16),
        name, 'manual', 'pending', 'manual', method, refCode,
        plan || null,
        body.utm_source   || null,
        body.utm_medium   || null,
        body.utm_campaign || null,
        body.gclid        || null,
        body.fbclid       || null,
      ).run()
      return json({ ok: true, referenceCode: refCode, name, method })
    } catch (err) {
      if (err.message?.includes('UNIQUE constraint failed') && attempt < 4) continue
      console.error('[manual] D1 error:', err.message)
      return json({ error: 'Server error. Please call us at 541-390-6334.' }, 500)
    }
  }
  return json({ error: 'Could not generate reference code. Please try again.' }, 500)
}

function genRefCode() {
  const bytes = new Uint8Array(2)
  crypto.getRandomValues(bytes)
  return 'MH-' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('')
}
