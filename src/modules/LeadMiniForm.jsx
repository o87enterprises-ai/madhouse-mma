import { useState, useRef } from 'react'
import { getAttribution } from '../utils/attribution.js'
import { site } from '../content/site.js'

export default function LeadMiniForm() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', _hp: '' })
  const [status, setStatus] = useState('idle') // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState('')
  const startTime = useRef(Date.now())

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) return
    setStatus('submitting')
    setErrorMsg('')

    const attr = getAttribution() || {}
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          _hp: form._hp,
          _t: startTime.current,
          ...attr,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `Error ${res.status}`)
      }
      setStatus('success')
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="mini-form mini-form--success" id="free-trial">
        <span className="mini-form__success-icon" aria-hidden="true">✓</span>
        <div>
          <strong>Got it! We'll be in touch soon.</strong>
          <p>Questions? Call us at <a href={site.phoneHref}>{site.phone}</a>.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mini-form" id="free-trial">
      <h3 className="mini-form__heading">Claim your free class</h3>
      <p className="mini-form__sub">3 fields. No pressure. We'll reach out to confirm.</p>

      <form onSubmit={handleSubmit} noValidate className="mini-form__form">
        {/* Honeypot */}
        <input
          type="text"
          name="website"
          aria-hidden="true"
          tabIndex={-1}
          style={{ position: 'absolute', left: '-9999px' }}
          value={form._hp}
          onChange={e => set('_hp', e.target.value)}
          autoComplete="off"
        />

        <input
          className="mini-form__input"
          type="text"
          placeholder="Your name *"
          autoComplete="name"
          required
          value={form.name}
          onChange={e => set('name', e.target.value)}
        />
        <input
          className="mini-form__input"
          type="tel"
          placeholder="Phone number *"
          autoComplete="tel"
          required
          value={form.phone}
          onChange={e => set('phone', e.target.value)}
        />
        <input
          className="mini-form__input"
          type="email"
          placeholder="Email (optional)"
          autoComplete="email"
          value={form.email}
          onChange={e => set('email', e.target.value)}
        />

        {status === 'error' && (
          <p className="mini-form__error" role="alert">{errorMsg}</p>
        )}

        <button
          type="submit"
          className="btn btn--accent"
          style={{ width: '100%' }}
          disabled={status === 'submitting'}
        >
          {status === 'submitting' ? 'Sending…' : 'Reserve my spot →'}
        </button>
      </form>
    </div>
  )
}
