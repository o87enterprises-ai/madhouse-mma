import { useRef, useState, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// Scroll-reveal wrapper. Renders children visible in SSR, animates on client.
export default function Reveal({ children, delay = 0, className = '' }) {
  const prefersReduced = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  const ref = useRef(null)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted || prefersReduced) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
