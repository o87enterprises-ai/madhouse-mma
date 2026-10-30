// Square SDK v44+ surface — fixed from open-pay bugs (§7):
// - Uses SquareClient, not client.paymentsApi
// - Webhook: base64 HMAC-SHA256 of (notificationUrl + rawBody), header x-square-hmacsha256-signature
// Not wired in production yet; activate via env.PAYMENT_PROVIDER='square'

export class SquareProvider {
  constructor(env) {
    this._env = env
  }

  async _getClient() {
    // Square SDK is not bundled — install separately if activating Square support
    // eslint-disable-next-line no-eval
    const { SquareClient, SquareEnvironment } = await eval("import('square')")
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

  async createOneOffIntent({ amountCents, currency = 'USD', description }) {
    const client = await this._getClient()
    const result = await client.payments.create({
      sourceId: 'EXTERNAL',
      idempotencyKey: crypto.randomUUID(),
      amountMoney: { amount: BigInt(amountCents), currency },
      note: description,
    })
    return { clientSecret: null, paymentIntentId: result.payment?.id || null }
  }

  async createPortalSession() {
    throw new Error('Square does not have a Customer Portal equivalent.')
  }

  async refund({ paymentIntentId, amountCents }) {
    const client = await this._getClient()
    const result = await client.refunds.refundPayment({
      idempotencyKey: crypto.randomUUID(),
      paymentId: paymentIntentId,
      amountMoney: { amount: BigInt(amountCents), currency: 'USD' },
    })
    return { refundId: result.refund?.id || null }
  }
}

export async function verifySquareWebhook({ rawBody, signature, notificationUrl, signatureKey }) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(signatureKey),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(notificationUrl + rawBody))
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)))
  return expected === signature
}
