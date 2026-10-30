import { site } from '../content/site.js'
import media from '../media.js'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <img
            src={media.logo}
            alt={site.name}
            width="77"
            height="58"
            className="footer__logo"
            loading="lazy"
          />
          <address className="footer__address">
            {site.name}<br />
            {site.addressStreet}<br />
            {site.addressCity}, {site.addressState} {site.addressZip}<br />
            <a href={site.phoneHref}>{site.phone}</a><br />
            <a href={`mailto:${site.email}`}>{site.email}</a>
          </address>
        </div>

        <nav className="footer__nav" aria-label="Footer navigation">
          <ul>
            <li><a href="#programs">Programs</a></li>
            <li><a href="#coaches">Coaches</a></li>
            <li><a href="#schedule">Schedule</a></li>
            <li><a href="#what-to-expect">First class</a></li>
            <li><a href="#faq">FAQ</a></li>
            <li><a href="#location">Location</a></li>
          </ul>
        </nav>

        <div className="footer__social">
          <a
            href={site.facebook}
            target="_blank"
            rel="noopener noreferrer"
            className="footer__social-link"
            aria-label="Grove MMA on Facebook"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
            </svg>
            Facebook
          </a>
        </div>
      </div>

      <div className="footer__legal">
        <div className="container">
          <p>© {year} {site.name}. All rights reserved.</p>
          <a href="/privacy" className="footer__privacy">Privacy Policy</a>
        </div>
      </div>
    </footer>
  )
}
