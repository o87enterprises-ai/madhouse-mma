import { getStripeClient } from '../../_lib/stripe.js'

export async function onRequestGet({ request, env }) {
  const siteUrl = env.SITE_URL || 'https://grovemma.example'
  const url = new URL(request.url)
  const email = url.searchParams.get('email')

  if (!email) {
    return Response.redirect(siteUrl + '/?portal_error=no_email', 302)
  }

  try {
    const stripe = getStripeClient(env)
    const customers = await stripe.customers.list({ email, limit: 1 })
    const customer = customers.data[0]
    if (!customer) {
      return Response.redirect(siteUrl + '/?portal_error=not_found', 302)
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: siteUrl,
    })
    return Response.redirect(session.url, 302)
  } catch (err) {
    console.error('[portal-redirect]', err.message)
    return Response.redirect(siteUrl + '/?portal_error=server', 302)
  }
}
