import { getStripeClient } from '../stripe.js'

export class StripeProvider {
  constructor(env) {
    this.stripe = getStripeClient(env)
  }

  async createCheckoutSession({ priceId, mode, leadId, successUrl, cancelUrl, customerEmail, metadata = {} }) {
    const session = await this.stripe.checkout.sessions.create({
      mode,
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
      amount: amountCents || undefined,
    })
    return { refundId: refund.id }
  }
}
