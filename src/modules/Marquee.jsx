import { useReducedMotion } from 'framer-motion'

const ITEMS = ['Jiu-Jitsu', 'No-Gi', 'Kickboxing', 'MMA', 'Kids']

function Track() {
  return (
    <>
      {ITEMS.map((item, i) => (
        <span key={i} className="marquee__item">
          {item}
          <span className="marquee__dot" aria-hidden="true">✦</span>
        </span>
      ))}
    </>
  )
}

export default function Marquee() {
  const prefersReduced = useReducedMotion()

  return (
    <div className="marquee" aria-label="Disciplines offered">
      {prefersReduced ? (
        <div className="marquee__static">
          {ITEMS.join(' · ')}
        </div>
      ) : (
        <div className="marquee__track">
          <Track />
          <Track />
        </div>
      )}
    </div>
  )
}
