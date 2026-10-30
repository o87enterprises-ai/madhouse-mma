import { StripeProvider } from './StripeProvider.js'
import { SquareProvider } from './SquareProvider.js'

export function getProvider(env) {
  const name = (env.PAYMENT_PROVIDER || 'stripe').toLowerCase()
  if (name === 'square') return new SquareProvider(env)
  return new StripeProvider(env)
}
