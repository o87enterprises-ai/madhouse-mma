import Reveal from '../components/Reveal.jsx'

const STEPS = [
  {
    n: '01',
    heading: 'What to wear',
    body: 'Athletic shorts and a t-shirt are perfect. No special gear required for your first visit. No shoes on the mat.',
  },
  {
    n: '02',
    heading: 'Arrive a little early',
    body: 'Show up 10 minutes before class starts. We\'ll introduce you to the coach, walk you through the facility, and answer any questions before training begins.',
  },
  {
    n: '03',
    heading: 'No experience? Good.',
    body: 'Every coach at Grove has taught complete beginners. You won\'t be thrown in the deep end. The class is structured so you can follow along and learn from your very first rep.',
  },
  {
    n: '04',
    heading: 'Parents can watch',
    body: 'If you\'re bringing a child, stay as long as you like. We\'re a community gym and we want families to feel comfortable. Pull up a chair.',
  },
  {
    n: '05',
    heading: 'Zero pressure',
    body: 'Your free class comes with no sales pitch, no obligation, and no awkward follow-up if it\'s not for you. We\'d rather earn your membership than pressure you into one.',
  },
]

export default function FirstClass({ onCTA }) {
  return (
    <section className="first-class" id="what-to-expect">
      <div className="container">
        <Reveal>
          <p className="section-eyebrow">First time here?</p>
          <h2 className="section-title">What to expect at your first class</h2>
          <p className="section-sub">
            We know walking into a martial arts gym for the first time can feel intimidating.
            Here's exactly what happens so there are no surprises.
          </p>
        </Reveal>

        <ol className="first-class__steps" aria-label="What to expect at your first class">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 0.07}>
              <li className="first-class__step">
                <span className="first-class__n" aria-hidden="true">{step.n}</span>
                <div>
                  <strong className="first-class__heading">{step.heading}</strong>
                  <p className="first-class__body">{step.body}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={0.2}>
          <div className="first-class__cta-block">
            <p>Ready to come in? Claim your free class below — we'll confirm within the hour.</p>
            <button className="btn btn--accent btn--lg" onClick={() => onCTA && onCTA(null)}>
              Book my free class →
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
