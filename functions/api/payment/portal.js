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
      returnUrl: returnUrl || env.SITE_URL || 'https://grovemma.example',
    })
    return json({ url: result.url })
  } catch (err) {
    console.error('[portal]', err.message)
    return json({ error: err.message }, 500)
  }
}
