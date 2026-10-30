import { useState, useRef } from 'react'
import Reveal from '../components/Reveal.jsx'
import { manualMethods, membershipPlans } from '../content/plans.js'
import { getAttribution } from '../utils/attribution.js'

export default function PayDirectly() {
  const [form, setForm] = useState({ name: '', phone: '', method: '', plan: '' })
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(null)
  const [errMsg, setErrMsg] = useState('')
  const startTime = useRef(Date.now())

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.phone || !form.method) return
    setStatus('submitting')
    setErrMsg('')
    const attr = getAttribution() || {}
    try {
      const res = await fetch('/api/payment/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, _t: startTime.current, ...attr }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Error ${res.status}`)
      }
      const data = await res.json()
      setResult(data)
      setStatus('success')
    } catch (err) {
      setErrMsg(err.message)
      setStatus('error')
    }
  }

  return (
    <section className="pay-directly" id="pay-directly">
      <div className="container">
        <Reveal>
          <p className="section-eyebrow">Other payment options</p>
          <h2 className="section-title">Pay directly</h2>
          <p className="section-sub">
            Prefer Zelle, Cash App, Venmo, or cash? No problem.
            Fill in your info and we'll give you a reference code to include with your payment
            so we can match it instantly.
          </p>
        </Reveal>

        <div className="pay-directly__inner">
          <Reveal>
            <div className="pay-directly__methods">
              {manualMethods.map(m => (
                <div key={m.id} className="pay-method">
                  <span className="pay-method__label">{m.label}</span>
                  {m.handle
                    ? <span className="pay-method__handle">{m.handle}</span>
                    : <span className="pay-method__todo">Coming soon — call us</span>}
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            {status === 'success' && result ? (
              <div className="pay-directly__form">
                <h3>Your reference code</h3>
                <p>Include this code in your payment note so we know it's from you.</p>
                <div className="pay-directly__ref">
                  <span className="pay-directly__ref-code">{result.referenceCode}</span>
                  <p>
                    Send your payment to the {result.method} handle above, then text us at{' '}
                    <a href="tel:+15415550100">541-555-0100</a> with this code.
                    We'll confirm within a few hours.
                  </p>
                </div>
              </div>
            ) : (
              <form className="pay-directly__form" onSubmit={handleSubmit} noValidate>
                <h3>Get a reference code</h3>
                <p>We'll give you a unique code to include in your payment note.</p>
                <div className="pay-directly__fields">
                  <input
                    className="pay-directly__input"
                    type="text"
                    placeholder="Your name *"
                    required
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                  />
                  <input
                    className="pay-directly__input"
                    type="tel"
                    placeholder="Your phone number *"
                    required
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                  />
                  <select
                    className="pay-directly__select"
                    required
                    value={form.method}
                    onChange={e => set('method', e.target.value)}
                  >
                    <option value="">Which method will you use? *</option>
                    {manualMethods.map(m => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                  <select
                    className="pay-directly__select"
                    value={form.plan}
                    onChange={e => set('plan', e.target.value)}
                  >
                    <option value="">Which membership? (optional)</option>
                    {membershipPlans.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                    <option value="Drop-in">Drop-in class</option>
                    <option value="Private Lesson">Private lesson</option>
                  </select>
                </div>
                {errMsg && <p className="pay-directly__err">{errMsg}</p>}
                <button
                  type="submit"
                  className="btn btn--accent"
                  style={{ width: '100%' }}
                  disabled={status === 'submitting'}
                >
                  {status === 'submitting' ? 'Generating code…' : 'Get my reference code →'}
                </button>
              </form>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  )
}
