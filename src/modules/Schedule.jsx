import { useState } from 'react'
import Reveal from '../components/Reveal.jsx'
import ImageLightbox from '../components/ImageLightbox.jsx'
import { schedule } from '../content/schedule.js'
import media from '../media.js'
import { site } from '../content/site.js'

export default function Schedule() {
  const [fullscreen, setFullscreen] = useState(false)

  return (
    <section className="schedule-section" id="schedule">
      <div className="container">
        <Reveal>
          <p className="section-eyebrow">Class times</p>
          <h2 className="section-title">When to show up</h2>
        </Reveal>

        {schedule ? (
          // Will render the text schedule when client provides data
          <Reveal>
            <div className="schedule-table">
              {/* TODO: render schedule data from content/schedule.js */}
            </div>
          </Reveal>
        ) : (
          <Reveal>
            <div className="schedule-placeholder">
              <button
                type="button"
                className="schedule-placeholder__zoom"
                onClick={() => setFullscreen(true)}
                aria-label="View the class schedule full screen"
              >
                <img
                  src={media.schedule}
                  alt="Grove MMA weekly class schedule"
                  className="schedule-placeholder__img"
                  loading="lazy"
                  width="1536"
                  height="1024"
                />
                <span className="schedule-placeholder__hint">Tap to enlarge ⤢</span>
              </button>
              <div className="schedule-placeholder__cta">
                <p>
                  <strong>Schedule may have changed.</strong> For the most current times, give us a call.
                </p>
                <a href={site.phoneHref} className="btn btn--accent">
                  Call {site.phone}
                </a>
              </div>
              {/* TODO(client): provide schedule as text — days, times, class names, age groups */}
            </div>
          </Reveal>
        )}
      </div>

      {fullscreen && (
        <ImageLightbox
          src={media.schedule}
          alt="Grove MMA weekly class schedule"
          onClose={() => setFullscreen(false)}
        />
      )}
    </section>
  )
}
