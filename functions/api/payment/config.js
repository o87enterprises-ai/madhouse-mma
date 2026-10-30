import { handleOptions, json } from '../../_lib/cors.js'

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
      stripePriceId: env[`STRIPE_PRICE_${p.id.toUpperCase()}`] || null,
      displayPrice:  env[`DISPLAY_PRICE_${p.id.toUpperCase()}`] || null,
    })),
    oneOff: [
      {
        id: 'dropin',
        name: 'Drop-in Class',
        mode: 'payment',
        stripePriceId: env.STRIPE_PRICE_DROPIN || null,
        displayPrice:  env.DISPLAY_PRICE_DROPIN || null,
      },
      {
        id: 'private',
        name: 'Private Lesson',
        mode: 'payment',
        stripePriceId: env.STRIPE_PRICE_PRIVATE || null,
        displayPrice:  env.DISPLAY_PRICE_PRIVATE || null,
      },
    ],
  })
}
