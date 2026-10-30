import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getAttribution } from '../utils/attribution.js'
import { site } from '../content/site.js'

// Step definitions
const STEP_WHO = 'who'
const STEP_GOAL = 'goal'
const STEP_EXPERIENCE = 'experience'
const STEP_TIMES = 'times'
const STEP_CONTACT = 'contact'
const STEP_SUCCESS = 'success'

const GOALS = {
  me: [
    { id: 'fitness',   label: 'Get fit & lose weight' },
    { id: 'defense',   label: 'Learn self-defense' },
    { id: 'compete',   label: 'Compete in martial arts' },
    { id: 'try',       label: 'Just want to try it' },
  ],
  child: [
    { id: 'confidence', label: 'Build confidence & focus' },
    { id: 'social',     label: 'Make friends & social skills' },
    { id: 'defense',    label: 'Learn self-defense' },
    { id: 'compete',    label: 'Compete' },
  ],
  both: [
    { id: 'fitness',    label: 'Fitness for me, skills for my kid' },
    { id: 'family',     label: 'Train together as a family' },
    { id: 'defense',    label: 'Self-defense for everyone' },
    { id: 'try',        label: 'Just curious — see what fits' },
  ],
}

const TIMES_OPTIONS = [
  'Weekday mornings',
  'Weekday afternoons',
  'Weekday evenings',
  'Weekends',
  "I'm flexible",
]

const slide = {
  initial: (dir) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
  animate: { opacity: 1, x: 0 },
  exit:    (dir) => ({ opacity: 0, x: dir > 0 ? -40 : 40 }),
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
}

function OptionButton({ label, selected, onClick }) {
  return (
    <button
      type="button"
      className={`quiz-option ${selected ? 'quiz-option--selected' : ''}`}
      onClick={onClick}
    >
      {selected && <span className="quiz-option__check" aria-hidden="true">✓</span>}
      {label}
    </button>
  )
}

function Progress({ current, total }) {
  return (
    <div className="quiz-progress" role="progressbar" aria-valuenow={current} aria-valuemax={total}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`quiz-progress__dot ${i < current ? 'quiz-progress__dot--done' : i === current ? 'quiz-progress__dot--active' : ''}`} />
      ))}
    </div>
  )
}

export default function LeadQuiz({ open, program, onClose }) {
  const STEPS = [STEP_WHO, STEP_GOAL, STEP_EXPERIENCE, STEP_TIMES, STEP_CONTACT, STEP_SUCCESS]
  const [stepIdx, setStepIdx] = useState(0)
  const [dir, setDir] = useState(1)
  const [form, setForm] = useState({
    who: null,
    goal: null,
    experience: null,
    preferred_times: [],
    name: '',
    phone: '',
    email: '',
    note: '',
    program_interest: null,
    _t: null,
    _hp: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const panelRef = useRef(null)
  const firstInputRef = useRef(null)

  // Reset when opened / program changes
  useEffect(() => {
    if (open) {
      setStepIdx(0)
      setDir(1)
      setError(null)
      setSubmitting(false)
      setForm(f => ({
        ...f,
        who: null, goal: null, experience: null, preferred_times: [],
        name: '', phone: '', email: '', note: '',
        program_interest: program || null,
        _t: Date.now(),
      }))
    }
  }, [open, program])

  // Focus trap & ESC close
  useEffect(() => {
    if (!open) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    // Prevent body scroll
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  const step = STEPS[stepIdx]
  const totalSteps = STEPS.length - 1 // success isn't a "progress" step

  const go = useCallback((delta = 1) => {
    setDir(delta)
    setStepIdx(i => i + delta)
  }, [])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const toggleTime = (t) => {
    setForm(f => ({
      ...f,
      preferred_times: f.preferred_times.includes(t)
        ? f.preferred_times.filter(x => x !== t)
        : [...f.preferred_times, t],
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Name and phone number are required.')
      return
    }
    setSubmitting(true)
    setError(null)

    const attr = getAttribution() || {}
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      note: form.note.trim() || null,
      who: form.who,
      goal: form.goal,
      experience: form.experience,
      preferred_times: form.preferred_times,
      program_interest: form.program_interest,
      _t: form._t,
      _hp: form._hp,
      ...attr,
    }

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Server error ${res.status}`)
      }
      setDir(1)
      setStepIdx(STEPS.indexOf(STEP_SUCCESS))
    } catch (err) {
      setError(err.message || 'Something went wrong. Please call us at ' + site.phone)
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="quiz-overlay" role="dialog" aria-modal="true" aria-label="Find your class">
      {/* Backdrop */}
      <div className="quiz-backdrop" onClick={onClose} aria-hidden="true" />

      <div className="quiz-panel" ref={panelRef}>
        {/* Header */}
        <div className="quiz-header">
          {step !== STEP_SUCCESS && (
            <Progress current={stepIdx} total={totalSteps} />
          )}
          <button className="quiz-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Steps */}
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={slide}
            initial="initial"
            animate="animate"
            exit="exit"
            className="quiz-step"
          >
            {/* ── Step: Who ── */}
            {step === STEP_WHO && (
              <div>
                <h2 className="quiz-q">Who's training?</h2>
                <div className="quiz-options">
                  {[
                    { id: 'me',    label: 'Me (adult)' },
                    { id: 'child', label: 'My child' },
                    { id: 'both',  label: 'Both of us' },
                  ].map(o => (
                    <OptionButton
                      key={o.id}
                      label={o.label}
                      selected={form.who === o.id}
                      onClick={() => { set('who', o.id); go(1) }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Step: Goal ── */}
            {step === STEP_GOAL && (
              <div>
                <h2 className="quiz-q">What's your main goal?</h2>
                <div className="quiz-options">
                  {(GOALS[form.who] || GOALS.me).map(o => (
                    <OptionButton
                      key={o.id}
                      label={o.label}
                      selected={form.goal === o.id}
                      onClick={() => { set('goal', o.id); go(1) }}
                    />
                  ))}
                </div>
                <button className="quiz-back" onClick={() => go(-1)}>← Back</button>
              </div>
            )}

            {/* ── Step: Experience ── */}
            {step === STEP_EXPERIENCE && (
              <div>
                <h2 className="quiz-q">Any martial arts experience?</h2>
                <div className="quiz-options">
                  {[
                    { id: 'none',       label: 'None — complete beginner' },
                    { id: 'some',       label: 'Tried a class or two' },
                    { id: 'experienced', label: 'Been training before' },
                  ].map(o => (
                    <OptionButton
                      key={o.id}
                      label={o.label}
                      selected={form.experience === o.id}
                      onClick={() => { set('experience', o.id); go(1) }}
                    />
                  ))}
                </div>
                <button className="quiz-back" onClick={() => go(-1)}>← Back</button>
              </div>
            )}

            {/* ── Step: Times ── */}
            {step === STEP_TIMES && (
              <div>
                <h2 className="quiz-q">When do you prefer to train?</h2>
                <p className="quiz-sub">Pick as many as you like.</p>
                <div className="quiz-options">
                  {TIMES_OPTIONS.map(t => (
                    <OptionButton
                      key={t}
                      label={t}
                      selected={form.preferred_times.includes(t)}
                      onClick={() => toggleTime(t)}
                    />
                  ))}
                </div>
                <div className="quiz-nav">
                  <button className="quiz-back" onClick={() => go(-1)}>← Back</button>
                  <button
                    className="btn btn--accent"
                    onClick={() => go(1)}
                    disabled={form.preferred_times.length === 0}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

            {/* ── Step: Contact ── */}
            {step === STEP_CONTACT && (
              <form onSubmit={handleSubmit} noValidate>
                <h2 className="quiz-q">Almost there — how do we reach you?</h2>
                <p className="quiz-sub">We'll confirm your free class within{' '}
                  {/* TODO(client): fill in response time */}
                  <strong>a few hours</strong>. No spam, ever.
                </p>

                {/* Honeypot — hidden from real users */}
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

                <div className="quiz-fields">
                  <label className="quiz-label">
                    Name <span aria-hidden="true">*</span>
                    <input
                      ref={firstInputRef}
                      className="quiz-input"
                      type="text"
                      autoComplete="name"
                      required
                      placeholder="Your name"
                      value={form.name}
                      onChange={e => set('name', e.target.value)}
                    />
                  </label>
                  <label className="quiz-label">
                    Phone <span aria-hidden="true">*</span>
                    <input
                      className="quiz-input"
                      type="tel"
                      autoComplete="tel"
                      required
                      placeholder="541-555-0100"
                      value={form.phone}
                      onChange={e => set('phone', e.target.value)}
                    />
                  </label>
                  <label className="quiz-label">
                    Email <span className="quiz-label__opt">(optional)</span>
                    <input
                      className="quiz-input"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                    />
                  </label>
                  <label className="quiz-label">
                    Anything else? <span className="quiz-label__opt">(optional)</span>
                    <textarea
                      className="quiz-input quiz-input--ta"
                      rows={3}
                      placeholder="Questions, injuries we should know about, preferred program…"
                      value={form.note}
                      onChange={e => set('note', e.target.value)}
                    />
                  </label>
                </div>

                {error && <p className="quiz-error" role="alert">{error}</p>}

                <div className="quiz-nav">
                  <button type="button" className="quiz-back" onClick={() => go(-1)}>← Back</button>
                  <button type="submit" className="btn btn--accent btn--lg" disabled={submitting}>
                    {submitting ? 'Sending…' : 'Reserve my free class →'}
                  </button>
                </div>

                <p className="quiz-privacy">
                  By submitting you agree we can contact you about your free class.
                  We never sell your info.
                </p>
              </form>
            )}

            {/* ── Step: Success ── */}
            {step === STEP_SUCCESS && (
              <div className="quiz-success">
                <div className="quiz-success__icon" aria-hidden="true">🥊</div>
                <h2 className="quiz-success__h">You're in!</h2>
                <p className="quiz-success__p">
                  We'll reach out to confirm your free class. In the meantime, if you have any
                  questions just call or text us:
                </p>
                <a href={site.phoneHref} className="btn btn--accent btn--lg">
                  {site.phone}
                </a>
                <p className="quiz-success__small">
                  123 Example St, Cottage Grove, OR — see you on the mat.
                </p>
                <button className="quiz-back" style={{ marginTop: '1.5rem' }} onClick={onClose}>
                  Close
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
