import { site } from '../content/site.js'

// Mobile-only sticky bar fixed to the bottom of the screen.
export default function StickyCTA({ onCTA }) {
  return (
    <div className="sticky-cta" role="complementary" aria-label="Quick actions">
      <a href={site.phoneHref} className="sticky-cta__call">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
        Call
      </a>
      <button className="sticky-cta__book" onClick={() => onCTA(null)}>
        Free Class →
      </button>
    </div>
  )
}
