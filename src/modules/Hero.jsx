import { useRef } from 'react'
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import media from '../media.js'

export default function Hero({ onCTA }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const prefersReduced = useReducedMotion()

  const logoScale = useTransform(scrollYProgress, [0, 1], [1, 0.7])
  const logoOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])
  const logoY = useTransform(scrollYProgress, [0, 1], ['0%', '-20%'])
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])

  return (
    <section className="hero" ref={ref} id="home">
      {/* Subtle parallax background texture */}
      {!prefersReduced && (
        <motion.div className="hero__bg" style={{ y: bgY }} aria-hidden="true" />
      )}

      <div className="hero__inner">
        <motion.div
          className="hero__logo-wrap"
          style={prefersReduced ? {} : {
            scale: logoScale,
            opacity: logoOpacity,
            y: logoY,
          }}
        >
          <img
            src={media.logo}
            alt="Grove MMA"
            width="1920"
            height="1453"
            className="hero__logo"
            fetchpriority="high"
          />
        </motion.div>

        <motion.div
          className="hero__text"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="hero__h1">
            MMA, Jiu&#8209;Jitsu &amp; Kickboxing<br />
            <span className="hero__location">in Cottage Grove, Oregon</span>
          </h1>
        </motion.div>

        <motion.div
          className="hero__ctas"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <button className="btn btn--accent btn--lg" onClick={() => onCTA(null)}>
            Claim your free class
          </button>
          <a href="tel:+15415550100" className="btn btn--ghost btn--lg">
            Call 541&#8209;555&#8209;0100
          </a>
        </motion.div>
      </div>

      <div className="hero__scroll-hint" aria-hidden="true">
        <motion.span
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
        >↓</motion.span>
      </div>
    </section>
  )
}
