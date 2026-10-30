import { useState } from 'react'
import Reveal from '../components/Reveal.jsx'
import { membershipPlans, oneOffProducts } from '../content/plans.js'
import { site } from '../content/site.js'
import { getAttribution } from '../utils/attribution.js'

async function startCheckout({ priceId, mode, planName, customerEmail }) {
  const attr = getAttribution() || {}
  const res = await fetch('/api/payment/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      priceId, mode, planName,
      customerEmail: customerEmail || null,
      successUrl: window.location.origin + '/?payment_success=1',
      cancelUrl:  window.location.origin + '/?payment_cancelled=1',
      ...attr,
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Error ${res.status}`)
  }
  const { url } = await res.json()
  window.location.href = url
}

function PlanCard({ plan }) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const unavailable = !plan.stripePriceId

  const handleJoin = async () => {
    if (unavailable) return
    setLoading(true)
    setErr(null)
    try {
      await startCheckout({ priceId: plan.stripePriceId, mode: plan.mode, planName: plan.name })
    } catch (e) {
      setErr(e.message)
      setLoading(false)
    }
  }

  return (
    <div className={`plan-card${plan.highlight ? ' plan-card--highlight' : ''}`}>
      {plan.highlight && <span className="plan-card__badge">Most popular</span>}
      <h3 className="plan-card__name">{plan.name}</h3>
      <p className="plan-card__tagline">{plan.tagline}</p>
      <p className="plan-card__price">
        {plan.displayPrice
          ? <strong>{plan.displayPrice}</strong>
          : <span className="plan-card__price--todo">Pricing coming soon</span>}
      </p>
      <ul className="plan-card__features">
        {plan.features.map(f => <li key={f}>{f}</li>)}
      </ul>
      {err && <p className="plan-card__err">{err}</p>}
      {unavailable ? (
        <a href={site.phoneHref} className="btn btn--ghost plan-card__cta">
          Call to enroll →
        </a>
      ) : (
        <button
          className="btn btn--accent plan-card__cta"
          onClick={handleJoin}
          disabled={loading}
        >
          {loading ? 'Redirecting…' : 'Join now →'}
        </button>
      )}
    </div>
  )
}

export default function Pricing() {
  return (
    <section className="pricing" id="pricing">
      <div className="container">
        <Reveal>
          <p className="section-eyebrow">Membership</p>
          <h2 className="section-title">Simple, honest pricing</h2>
          <p className="section-sub">
            No enrollment fees. No long-term contracts. Just show up.{' '}
            <strong>Your first class is always free.</strong>
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="plan-cards">
            {membershipPlans.map(p => <PlanCard key={p.id} plan={p} />)}
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="one-off-products">
            <h3 className="one-off-products__heading">Single sessions</h3>
            <div className="one-off-products__grid">
              {oneOffProducts.map(p => (
                <div key={p.id} className="one-off-card">
                  <div>
                    <strong className="one-off-card__name">{p.name}</strong>
                    <p className="one-off-card__desc">{p.description}</p>
                  </div>
                  <p className="one-off-card__price">
                    {p.displayPrice || <span className="plan-card__price--todo">Call for price</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <p className="pricing__portal-note">
            Already a member?{' '}
            <a href="/api/payment/portal-redirect" className="pricing__portal-link">
              Manage your membership →
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  )
}
