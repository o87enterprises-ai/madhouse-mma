import { useRef, useEffect, useState } from 'react'

export default function VideoReel() {
  const videoRef = useRef(null)
  const sectionRef = useRef(null)
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (reduced || !videoRef.current || !sectionRef.current) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) videoRef.current?.play().catch(() => {})
        else videoRef.current?.pause()
      },
      { threshold: 0.1 }
    )
    obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [reduced])

  return (
    <section className="video-reel" ref={sectionRef} aria-hidden="true">
      <div className="video-reel__bg">
        {!reduced ? (
          <video
            ref={videoRef}
            className="video-reel__video"
            muted
            loop
            playsInline
            poster="https://images.pexels.com/videos/5752074/pictures/preview-0.jpg"
          >
            {/* HD first — falls back to UHD if HD isn't available */}
            <source
              src="https://videos.pexels.com/video-files/5752074/5752074-hd_1920_1080_25fps.mp4"
              type="video/mp4"
            />
            <source
              src="https://videos.pexels.com/video-files/5752074/5752074-uhd_2560_1440_25fps.mp4"
              type="video/mp4"
            />
          </video>
        ) : (
          <img
            className="video-reel__poster"
            src="https://images.pexels.com/videos/5752074/pictures/preview-0.jpg"
            alt=""
            loading="lazy"
          />
        )}
        <div className="video-reel__overlay" />
      </div>
      <div className="video-reel__content container">
        <p className="video-reel__eyebrow">Grove MMA · Cottage Grove, OR</p>
        <h2 className="video-reel__tagline">Train.<br />Compete.<br />Evolve.</h2>
        <p className="video-reel__sub">Jiu-Jitsu · Cardio Kickboxing · MMA · Kids</p>
      </div>
    </section>
  )
}
