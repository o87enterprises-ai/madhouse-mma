import { useState } from 'react'
import Reveal from '../components/Reveal.jsx'
import { programs, programsIntro, groveDifference } from '../content/programs.js'
import media from '../media.js'

function ProgramCard({ prog, onCTA }) {
  const [expanded, setExpanded] = useState(false)
  const moreId = `program-more-${prog.id}`
  const [lead, ...rest] = prog.intro

  return (
    <li className="program-card">
      <div className="program-card__img-wrap">
        <img
          src={media[prog.mediaKey]}
          alt={prog.altText}
          className="program-card__img"
          loading="lazy"
          width="960"
          height="640"
        />
        <span className="program-card__overlay" aria-hidden="true" />
      </div>
      <div className="program-card__body">
        <h3 className="program-card__name">{prog.name}</h3>
        <p className="program-card__subtitle">{prog.subtitle}</p>
        <p className="program-card__blurb">{lead}</p>

        <div id={moreId} className="program-card__more" hidden={!expanded}>
          {rest.map((para, i) => <p key={i} className="program-card__blurb">{para}</p>)}
        </div>
        {rest.length > 0 && (
          <button
            className="program-card__toggle"
            onClick={() => setExpanded(e => !e)}
            aria-expanded={expanded}
            aria-controls={moreId}
          >
            {expanded ? 'Show less ↑' : 'Read more ↓'}
          </button>
        )}

        <p className="program-card__benefits-heading">{prog.benefitsHeading}</p>
        <ul className="program-card__benefits" aria-label={prog.benefitsHeading}>
          {prog.benefits.map(b => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p className="program-card__blurb">{prog.outro}</p>
        <p className="program-card__tagline">{prog.tagline}</p>
        <button
          className="btn btn--accent program-card__cta"
          onClick={() => onCTA(prog.id)}
        >
          Try {prog.shortName} free →
        </button>
      </div>
    </li>
  )
}

export default function Programs({ onCTA }) {
  return (
    <section className="programs" id="programs">
      <div className="container">
        <Reveal>
          <p className="section-eyebrow">What we teach</p>
          <h2 className="section-title">{programsIntro.title}</h2>
          <p className="section-sub">{programsIntro.sub}</p>
        </Reveal>

        <ul className="programs__grid" role="list">
          {programs.map((prog, i) => (
            <Reveal key={prog.id} delay={i * 0.07}>
              <ProgramCard prog={prog} onCTA={onCTA} />
            </Reveal>
          ))}
        </ul>

        <Reveal>
          <div className="programs__difference">
            <h3 className="programs__difference-heading">{groveDifference.heading}</h3>
            {groveDifference.body.map((para, i) => <p key={i}>{para}</p>)}
            <p className="programs__difference-tagline">{groveDifference.tagline}</p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
