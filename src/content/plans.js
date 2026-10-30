// TODO(client): create products + prices in Stripe Dashboard → Products
// then fill in the stripePriceId and displayPrice values below.
// Stripe Dashboard → Products → Add product → Add price (recurring, monthly)
// Copy the "Price ID" (starts with price_...) into stripePriceId.

export const membershipPlans = [
  {
    id: 'unlimited',
    name: 'Unlimited',
    tagline: 'Every class. Every discipline.',
    stripePriceId: null,  // TODO(client): e.g. 'price_1ABC...'
    displayPrice: null,   // TODO(client): e.g. '$120/mo'
    interval: 'month',
    mode: 'subscription',
    features: [
      'Unlimited classes — all disciplines',
      'Jiu-Jitsu (Gi & No-Gi), Cardio Kickboxing, MMA',
      'Access to open mat sessions',
      'No contracts',
    ],
    highlight: true,
  },
  {
    id: 'single',
    name: 'Single Discipline',
    tagline: 'Go deep on one art.',
    stripePriceId: null,  // TODO(client)
    displayPrice: null,   // TODO(client)
    interval: 'month',
    mode: 'subscription',
    features: [
      'Unlimited classes in one discipline',
      'Choose: Jiu-Jitsu, Cardio Kickboxing, or MMA',
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
    stripePriceId: null,  // TODO(client)
    displayPrice: null,   // TODO(client)
    mode: 'payment',
    description: 'Try any single class. No membership required.',
  },
  {
    id: 'private',
    name: 'Private Lesson',
    stripePriceId: null,  // TODO(client)
    displayPrice: null,   // TODO(client)
    mode: 'payment',
    description: '1-hour one-on-one coaching with a Grove instructor.',
  },
]

// TODO(client): fill in your actual Zelle email/phone, CashApp $tag, Venmo @handle.
export const manualMethods = [
  { id: 'zelle',   label: 'Zelle',    handle: null }, // e.g. 'hello@grovemma.example'
  { id: 'cashapp', label: 'Cash App', handle: null }, // e.g. '$GroveMMA'
  { id: 'venmo',   label: 'Venmo',    handle: null }, // e.g. '@GroveMMA'
  { id: 'cash',    label: 'Cash',     handle: 'Drop it off at the gym — 172 Gateway Blvd, Cottage Grove' },
]
