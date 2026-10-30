import { useState } from 'react'
import Reveal from '../components/Reveal.jsx'
import { site } from '../content/site.js'

export default function Location({ onCTA }) {
  const [mapLoaded, setMapLoaded] = useState(false)

  return (
    <section className="location" id="location">
      <div className="container location__inner">
        <div className="location__info">
          <Reveal>
            <p className="section-eyebrow">Find us</p>
            <h2 className="section-title">Come train</h2>
          </Reveal>

          <Reveal delay={0.1}>
            <address className="location__address">
              <strong>{site.name}</strong><br />
              {site.addressStreet}<br />
              {site.addressCity}, {site.addressState} {site.addressZip}
            </address>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="location__contact">
              <a href={site.phoneHref} className="location__contact-link">
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                {site.phone}
              </a>
              <a href={`mailto:${site.email}`} className="location__contact-link">
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                {site.email}
              </a>
            </div>
          </Reveal>

          {site.hours ? (
            <Reveal delay={0.2}>
              <div className="location__hours">
                <strong>Hours</strong>
                <p>{site.hours}</p>
              </div>
            </Reveal>
          ) : (
            /* TODO(client): provide hours of operation */
            <Reveal delay={0.2}>
              <p className="location__hours-placeholder">
                Hours vary — <a href={site.phoneHref}>call us</a> or check our{' '}
                <a href={site.facebook} target="_blank" rel="noopener noreferrer">Facebook page</a> for current schedule.
              </p>
            </Reveal>
          )}

          <Reveal delay={0.25}>
            <div className="location__ctas">
              <button className="btn btn--accent" onClick={() => onCTA(null)}>
                Book your free class
              </button>
              <a
                href={site.mapLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--ghost"
              >
                Get directions →
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal className="location__map-wrap" delay={0.15}>
          {/* Lazy-load the map embed only after user interaction / viewport entry */}
          <div className="location__map-container">
            {mapLoaded ? (
              <iframe
                title="Grove MMA location"
                src={`https://www.google.com/maps/embed/v1/place?key=&q=172+Gateway+Blvd,+Cottage+Grove,+OR+97424`}
                className="location__map"
                width="600"
                height="400"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allow="fullscreen"
              />
            ) : (
              <button
                className="location__map-placeholder"
                onClick={() => setMapLoaded(true)}
                aria-label="Load interactive map"
              >
                <div className="location__map-preview" aria-hidden="true">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span>123 Example St<br />Cottage Grove, OR</span>
                  <span className="location__map-load-hint">Click to load map</span>
                </div>
              </button>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
