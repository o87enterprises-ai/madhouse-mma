import Reveal from '../components/Reveal.jsx'
import media from '../media.js'

const PILLARS = [
  { icon: '🎯', heading: 'Focus & Discipline', body: 'Our drills teach kids to listen, stay on task, and follow through — skills that transfer directly into the classroom.' },
  { icon: '🛡️', heading: 'Confidence, Not Aggression', body: 'Kids who feel capable don\'t need to prove it. We build the kind of confidence that de-escalates situations before they start.' },
  { icon: '🤝', heading: 'Respect & Teamwork', body: 'Every class starts and ends with courtesy. Our kids learn to treat partners, coaches, teachers, and parents with genuine respect.' },
  { icon: '💪', heading: 'Self-Defense Fundamentals', body: 'Real skills — not choreography. Kids learn to protect themselves in age-appropriate ways without becoming a bully.' },
]

export default function Kids({ onCTA }) {
  return (
    <section className="kids-section" id="kids">
      <div className="container kids-section__inner">
        <Reveal className="kids-section__photo-col">
          <img
            src={media.kids2}
            alt="Kids martial arts class at Grove MMA"
            className="kids-section__photo"
            loading="lazy"
            width="960"
            height="960"
          />
        </Reveal>

        <div className="kids-section__text-col">
          <Reveal>
            <p className="section-eyebrow">For parents</p>
            <h2 className="section-title">More than martial arts.<br />Life skills they'll actually use.</h2>
            <p className="section-sub">
              Our kids program is built for families, not just fighters. A safe, structured environment where
              your child can grow — physically, mentally, and socially. Parents are always welcome to watch.
            </p>
          </Reveal>

          <ul className="kids-section__pillars" role="list">
            {PILLARS.map((p, i) => (
              <Reveal key={p.heading} delay={i * 0.08}>
                <li className="kids-pillar">
                  <span className="kids-pillar__icon" aria-hidden="true">{p.icon}</span>
                  <div>
                    <strong className="kids-pillar__heading">{p.heading}</strong>
                    <p className="kids-pillar__body">{p.body}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ul>

          <Reveal delay={0.3}>
            <button className="btn btn--accent btn--lg" onClick={() => onCTA('kids')}>
              Book a free kids class →
            </button>
            <p className="kids-section__note">
              {/* TODO(client): confirm age ranges */}
              Questions about age groups? Call us at{' '}
              <a href="tel:+15415550100">541-555-0100</a>.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
