import { useState } from 'react'
import Reveal from '../components/Reveal.jsx'
import { faqs } from '../content/faq.js'

function FAQItem({ faq, index }) {
  const [open, setOpen] = useState(false)
  const id = `faq-${index}`

  return (
    <div className={`faq-item ${open ? 'faq-item--open' : ''}`}>
      <button
        className="faq-item__question"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={id}
      >
        <span>{faq.q}</span>
        <span className="faq-item__chevron" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <div
        id={id}
        className="faq-item__answer"
        hidden={!open}
      >
        <p>{faq.a}</p>
      </div>
    </div>
  )
}

export default function FAQ() {
  return (
    <section className="faq" id="faq">
      <div className="container faq__inner">
        <Reveal>
          <p className="section-eyebrow">Questions</p>
          <h2 className="section-title">FAQ</h2>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="faq__list" role="list">
            {faqs.map((faq, i) => (
              <FAQItem key={i} faq={faq} index={i} />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
