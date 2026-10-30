import { useRef, useState, useEffect } from 'react'
import Reveal from '../components/Reveal.jsx'
import { videos } from '../content/videos.js'

const fmt = s => {
  if (!Number.isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function VideoPlayer() {
  const wrapRef = useRef(null)
  const videoRef = useRef(null)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [started, setStarted] = useState(false)
  const autoplayNext = useRef(false)

  const current = videos[index]
  const multi = videos.length > 1

  // When the playlist advances, start playing the new source.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.load()
    if (autoplayNext.current) v.play().catch(() => {})
  }, [index])

  if (!videos.length) return null

  const toggle = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }
  const seek = e => {
    const t = Number(e.target.value)
    videoRef.current.currentTime = t
    setTime(t)
  }
  const setVol = e => {
    const val = Number(e.target.value)
    videoRef.current.volume = val
    videoRef.current.muted = val === 0
    setVolume(val)
    setMuted(val === 0)
  }
  const toggleMute = () => {
    const v = videoRef.current
    v.muted = !v.muted
    setMuted(v.muted)
  }
  const fullscreen = () => {
    const v = videoRef.current
    const el = wrapRef.current
    if (document.fullscreenElement) document.exitFullscreen()
    else if (el?.requestFullscreen) el.requestFullscreen().catch(() => {})
    else if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen() // iOS Safari
  }
  const pick = i => {
    autoplayNext.current = true
    setStarted(true)
    setIndex(i)
  }
  const onEnded = () => {
    if (multi && index < videos.length - 1) pick(index + 1)
    else setPlaying(false)
  }

  return (
    <section className="watch" id="watch">
      <div className="container">
        <Reveal>
          <p className="section-eyebrow">Watch</p>
          <h2 className="section-title">See Grove in action</h2>
        </Reveal>

        <Reveal>
          <div className={`player${multi ? ' player--playlist' : ''}`}>
            <div className="player__stage" ref={wrapRef}>
              <video
                ref={videoRef}
                className="player__video"
                src={`${current.src}#t=0.1`}
                poster={current.poster || undefined}
                preload="metadata"
                playsInline
                onClick={toggle}
                onPlay={() => { setPlaying(true); setStarted(true); autoplayNext.current = true }}
                onPause={() => setPlaying(false)}
                onEnded={onEnded}
                onTimeUpdate={e => setTime(e.currentTarget.currentTime)}
                onLoadedMetadata={e => setDuration(e.currentTarget.duration)}
                onVolumeChange={e => { setMuted(e.currentTarget.muted); setVolume(e.currentTarget.volume) }}
              />
              {!playing && (
                <button className="player__bigplay" onClick={toggle} aria-label={`Play ${current.title}`}>
                  <span aria-hidden="true">▶</span>
                </button>
              )}
              <div className="player__bar">
                <button className="player__btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
                  {playing ? '❚❚' : '▶'}
                </button>
                <span className="player__time">{fmt(time)}</span>
                <input
                  className="player__range player__seek"
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.1"
                  value={time}
                  onChange={seek}
                  aria-label="Seek"
                  style={{ '--fill': `${duration ? (time / duration) * 100 : 0}%` }}
                />
                <span className="player__time">{fmt(duration)}</span>
                <button className="player__btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
                  {muted || volume === 0 ? '🔇' : '🔊'}
                </button>
                <input
                  className="player__range player__vol"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={muted ? 0 : volume}
                  onChange={setVol}
                  aria-label="Volume"
                  style={{ '--fill': `${(muted ? 0 : volume) * 100}%` }}
                />
                <button className="player__btn" onClick={fullscreen} aria-label="Full screen">⛶</button>
              </div>
            </div>

            <div className="player__info">
              <h3 className="player__title">{current.title}</h3>
              {current.description && <p className="player__desc">{current.description}</p>}
              {multi && (
                <ol className="player__list" aria-label="Playlist">
                  {videos.map((v, i) => (
                    <li key={v.id}>
                      <button
                        className={`player__item${i === index ? ' player__item--active' : ''}`}
                        onClick={() => pick(i)}
                        aria-current={i === index ? 'true' : undefined}
                      >
                        <span className="player__item-n">{i === index && started ? '▶' : i + 1}</span>
                        <span>{v.title}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
