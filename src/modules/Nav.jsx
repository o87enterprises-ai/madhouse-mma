import { useState, useEffect } from 'react'
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import media from '../media.js'
import { site } from '../content/site.js'

export default function Nav({ onCTA }) {
  const { scrollY } = useScroll()
  const prefersReduced = useReducedMotion()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    return scrollY.on('change', v => setScrolled(v > 160))
  }, [scrollY])

  const bgStyle = prefersReduced
    ? { backgroundColor: 'rgba(11,11,12,0.97)' }
    : undefined

  return (
    <motion.nav
      className={`nav ${scrolled ? 'nav--scrolled' : ''}`}
      animate={prefersReduced ? {} : {
        backgroundColor: scrolled ? 'rgba(11,11,12,0.97)' : 'rgba(11,11,12,0)',
        backdropFilter: scrolled ? 'blur(12px)' : 'blur(0px)',
      }}
      transition={{ duration: 0.25 }}
      style={bgStyle}
    >
      <motion.a
        href="/"
        className="nav__logo-link"
        aria-label={site.name + ' — home'}
        animate={{ opacity: scrolled ? 1 : 0, x: scrolled ? 0 : -8 }}
        transition={{ duration: 0.2 }}
      >
        <img
          src={media.logo}
          alt={site.name}
          width="77"
          height="58"
          className="nav__logo"
        />
      </motion.a>

      <a href={site.phoneHref} className="nav__phone">
        {site.phone}
      </a>

      <button className="btn btn--accent nav__cta" onClick={() => onCTA(null)}>
        Free Class
      </button>
    </motion.nav>
  )
}
