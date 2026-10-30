import { useState } from 'react'
import Reveal from '../components/Reveal.jsx'
import { coaches } from '../content/coaches.js'
import media from '../media.js'

function CoachCard({ coach }) {
  const [expanded, setExpanded] = useState(false)
  const bioId = `bio-${coach.id}`

  return (
    <article className="coach-card">
      <div className="coach-card__img-wrap">
        <img
          src={media[coach.mediaKey]}
          alt={coach.altText}
          className="coach-card__img"
          loading="lazy"
          width="960"
          height="960"
        />
      </div>
      <div className="coach-card__body">
        <h3 className="coach-card__name">{coach.name}</h3>
        {coach.title && <p className="coach-card__title">{coach.title}</p>}
        {coach.shortBio && <p className="coach-card__short">{coach.shortBio}</p>}

        {coach.fullBio && (
          <>
            <div
              id={bioId}
              className={`coach-card__full ${expanded ? 'coach-card__full--open' : ''}`}
              hidden={!expanded}
            >
              {coach.fullBio.split('\n\n').map((para, i) => <p key={i}>{para}</p>)}
            </div>

            <button
              className="coach-card__toggle"
              onClick={() => setExpanded(e => !e)}
              aria-expanded={expanded}
              aria-controls={bioId}
            >
              {expanded ? 'Show less ↑' : 'Full bio ↓'}
            </button>
          </>
        )}
      </div>
    </article>
  )
}

export default function Coaches() {
  return (
    <section className="coaches" id="coaches">
      <div className="container">
        <Reveal>
          <p className="section-eyebrow">The team</p>
          <h2 className="section-title">Coaches who've done it</h2>
          <p className="section-sub">
            Every coach at Grove has real credentials in the discipline they teach.
            No hobbyists. No rank inflation. Just people who love what they do and know how to pass it on.
          </p>
        </Reveal>

        <ul className="coaches__grid" role="list">
          {coaches.map((coach, i) => (
            <Reveal key={coach.id} delay={i * 0.08}>
              <li><CoachCard coach={coach} /></li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
