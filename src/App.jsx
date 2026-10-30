import { useState, useEffect } from 'react'
import { captureAttribution } from './utils/attribution.js'
import Nav from './modules/Nav.jsx'
import Hero from './modules/Hero.jsx'
import Marquee from './modules/Marquee.jsx'
import Programs from './modules/Programs.jsx'
import VideoReel from './modules/VideoReel.jsx'
import VideoPlayer from './modules/VideoPlayer.jsx'
import Kids from './modules/Kids.jsx'
import Coaches from './modules/Coaches.jsx'
import Schedule from './modules/Schedule.jsx'
import Equipment from './modules/Equipment.jsx'
// DEMO_MODE: payment sections hidden until client approves direction + Stripe is configured
const DEMO_MODE = true
// eslint-disable-next-line no-unused-vars
import Pricing from './modules/Pricing.jsx'
// eslint-disable-next-line no-unused-vars
import PayDirectly from './modules/PayDirectly.jsx'
import FirstClass from './modules/FirstClass.jsx'
import FAQ from './modules/FAQ.jsx'
import Location from './modules/Location.jsx'
import LeadMiniForm from './modules/LeadMiniForm.jsx'
import Footer from './modules/Footer.jsx'
import StickyCTA from './components/StickyCTA.jsx'
import LeadQuiz from './modules/LeadQuiz.jsx'
import ServiceAgreementGate from './components/ServiceAgreementGate.jsx'

function PaymentToast({ onClose }) {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const success = params.has('payment_success')
  const cancelled = params.has('payment_cancelled')
  if (!success && !cancelled) return null
  return (
    <div className={`payment-toast${success ? ' payment-toast--success' : ''}`} role="status">
      <span className="payment-toast__icon">{success ? '🎉' : '↩️'}</span>
      <span className="payment-toast__msg">
        {success
          ? 'Payment confirmed! Welcome to Grove. Check your email for a receipt.'
          : 'Payment cancelled — no charge was made. Questions? Call 541-555-0100.'}
      </span>
      <button className="payment-toast__close" onClick={onClose} aria-label="Dismiss">✕</button>
    </div>
  )
}

function App() {
  const [quiz, setQuiz] = useState({ open: false, program: null })
  const [showToast, setShowToast] = useState(true)

  useEffect(() => {
    captureAttribution()
    const params = new URLSearchParams(window.location.search)
    if (params.has('payment_success') || params.has('payment_cancelled')) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const openQuiz = (program = null) => setQuiz({ open: true, program })
  const closeQuiz = () => setQuiz({ open: false, program: null })

  return (
    <>
      <Nav onCTA={openQuiz} />
      <Hero onCTA={openQuiz} />
      <Marquee />
      <Programs onCTA={openQuiz} />
      <VideoReel />
      <VideoPlayer />
      <Kids onCTA={openQuiz} />
      <Coaches />
      <Schedule />
      <Equipment />
      {!DEMO_MODE && <Pricing />}
      {!DEMO_MODE && <PayDirectly />}
      <FirstClass onCTA={openQuiz} />
      <FAQ />
      <Location onCTA={openQuiz} />

      {/* Mini form: #free-trial anchor — scroll target for no-JS / fallback */}
      <section className="mini-form-section">
        <div className="container">
          <LeadMiniForm />
        </div>
      </section>

      <Footer />
      <StickyCTA onCTA={openQuiz} />
      <LeadQuiz open={quiz.open} program={quiz.program} onClose={closeQuiz} />
      {showToast && <PaymentToast onClose={() => setShowToast(false)} />}
      <ServiceAgreementGate />
    </>
  )
}

export default App
