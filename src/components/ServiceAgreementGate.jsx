import { useState, useEffect } from 'react'
import media from '../media.js'

// Value-based service agreement shown once per session over the preview.
// Preview build: amounts and dates are placeholders until the final agreement is signed.
const SEEN_KEY = 'grove-o87-sa-seen'
const AGREE_KEY = 'grove-o87-sa-agreed'

const TERMS = [
  {
    title: 'Services',
    text: 'Website design and hosting, a lead-capture form with instant email alerts, a local search strategy (SEO, answer-engine and AI search) for your service area, and search reporting so results can be measured.',
  },
  {
    title: 'Retainer',
    text: 'A $100 non-refundable retainer begins the work. It is a retainer only: it is not credited toward any fee agreed later. Work starts once the signed agreement and the retainer are received.',
  },
  {
    title: '30-day free trial',
    text: 'The first 30 days are free. At day 30 we review three things together: leads generated, new members signed, and this month’s revenue compared with the previous month, on the honor system.',
  },
  {
    title: 'Value-based fee',
    text: 'There is no fixed price up front. If the results show value, the fee is calculated after that value is determined and agreed together in writing. If they do not, you owe nothing beyond the retainer.',
  },
  {
    title: 'Ownership and credit',
    text: 'Once the agreement and retainer are in place, the finished website is jointly owned. o87Enterprises stays credited and may use the work in its portfolio and reuse the underlying design as a template. Your branding is never reused: your name, logo, photos, testimonials and content stay yours, as do your domain and accounts. Until then, the design remains the property of o87Enterprises.',
  },
]

const DOCS = [
  {
    title: 'Invoice',
    intro: 'Due when the agreement is signed.',
    items: [
      'Non-refundable retainer deposit, 30-day free trial: $100.00',
      'Total due: $100.00',
      'Nothing else is billed. The retainer is not credited toward any later fee.',
      'Invoice number, date and payment instructions are finalized when the agreement is signed.',
    ],
  },
]

function read(storage, key) {
  try { return storage.getItem(key) } catch { return null }
}
function write(storage, key, value) {
  try { storage.setItem(key, value) } catch { /* storage can be blocked; the page still works */ }
}

export default function ServiceAgreementGate() {
  // Closed during prerender and first paint, so crawlers and no-JS visitors still get the site.
  const [open, setOpen] = useState(false)
  const [agreed, setAgreed] = useState(false)

  useEffect(() => {
    if (read(sessionStorage, SEEN_KEY) !== 'yes') setOpen(true)
    if (read(sessionStorage, AGREE_KEY) === 'yes') setAgreed(true)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  const agree = () => {
    write(sessionStorage, AGREE_KEY, 'yes')
    setAgreed(true)
  }
  const proceed = () => {
    write(sessionStorage, SEEN_KEY, 'yes')
    setOpen(false)
  }

  return (
    <div className="sa-overlay" role="dialog" aria-modal="true" aria-labelledby="sa-title">
      <div className="sa-card">
        <div className="sa-card__head">
          <img src={media.logo} alt="Grove MMA" className="sa-card__logo" />
        </div>

        <p className="sa-card__eyebrow">Draft for review</p>
        <h2 id="sa-title" className="sa-card__title">Value-Based Service Agreement</h2>
        <p className="sa-card__lead">
          A summary of how we would work together, prepared for <strong>Grove MMA</strong>.
          Take a look, then continue to the preview.
        </p>

        <ol className="sa-terms">
          {TERMS.map((term) => (
            <li key={term.title}>
              <strong>{term.title}</strong>
              <p>{term.text}</p>
            </li>
          ))}
        </ol>

        <p className="sa-card__eyebrow">Included documents</p>
        {DOCS.map((doc) => (
          <details key={doc.title} className="sa-doc">
            <summary>{doc.title}</summary>
            <div className="sa-doc__body">
              <p>{doc.intro}</p>
              <ul>
                {doc.items.map((it) => <li key={it}>{it}</li>)}
              </ul>
            </div>
          </details>
        ))}

        <p className="sa-card__fine">
          This is a placeholder draft. The final agreement, including liability and governing-law terms,
          is reviewed and signed separately. Clicking “Yes, I agree” is a courtesy acknowledgment and is
          not required to view the preview.
        </p>

        <div className="sa-actions">
          <button type="button" className={`btn btn--accent${agreed ? ' sa-agreed' : ''}`} onClick={agree} aria-pressed={agreed}>
            {agreed ? 'Thank you, noted' : 'Yes, I agree'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={proceed}>
            Continue to Preview
          </button>
        </div>

        <p className="sa-card__fine sa-card__fine--center">
          Prepared exclusively for Grove MMA · o87Enterprises · 2026
        </p>
      </div>
    </div>
  )
}
