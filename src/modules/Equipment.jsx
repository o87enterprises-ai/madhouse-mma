import Reveal from '../components/Reveal.jsx'
import { equipment, loanerNote } from '../content/equipment.js'

export default function Equipment() {
  return (
    <section className="equipment" id="equipment">
      <div className="container">
        <Reveal>
          <p className="section-eyebrow">What to bring</p>
          <h2 className="section-title">Class equipment &amp; attire</h2>
        </Reveal>

        <Reveal>
          <div className="equipment__loaner">
            <strong className="equipment__loaner-heading">{loanerNote.heading}</strong>
            <p>{loanerNote.body}</p>
            <p className="equipment__fine">{loanerNote.fine}</p>
          </div>
        </Reveal>

        <ul className="equipment__grid" role="list">
          {equipment.map((cls, i) => (
            <Reveal key={cls.id} delay={i * 0.05}>
              <li className="equipment-card">
                <h3 className="equipment-card__name">{cls.name}</h3>
                {cls.ages && <p className="equipment-card__ages">{cls.ages}</p>}
                <ul className="equipment-card__items">
                  {cls.items.map(item => <li key={item}>{item}</li>)}
                </ul>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
