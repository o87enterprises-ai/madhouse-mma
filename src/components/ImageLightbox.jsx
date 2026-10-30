import { useEffect, useRef, useState } from 'react'

const MIN_ZOOM = 1
const MAX_ZOOM = 4

// Full-screen image viewer: pinch / +− / double-tap to zoom, drag to pan, X or Esc to close.
export default function ImageLightbox({ src, alt, onClose }) {
  // Phones: open at 2x so the small print is readable; pan to scan, "−" returns to fit-width.
  const startZoom = typeof window !== 'undefined' && window.innerWidth < 600 ? 2 : 1
  const [zoom, setZoom] = useState(startZoom)
  const scrollRef = useRef(null)
  const zoomRef = useRef(startZoom)
  const pinch = useRef(null)
  const lastTap = useRef(0)

  const applyZoom = (next, cx, cy) => {
    const el = scrollRef.current
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
    if (!el || z === zoomRef.current) return
    // keep the point under (cx, cy) fixed while zooming
    const rect = el.getBoundingClientRect()
    const px = (cx ?? rect.left + rect.width / 2) - rect.left
    const py = (cy ?? rect.top + rect.height / 2) - rect.top
    const ratio = z / zoomRef.current
    const nx = (el.scrollLeft + px) * ratio - px
    const ny = (el.scrollTop + py) * ratio - py
    zoomRef.current = z
    setZoom(z)
    requestAnimationFrame(() => {
      el.scrollLeft = nx
      el.scrollTop = ny
    })
  }

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onStart = e => {
      if (e.touches.length === 2) {
        pinch.current = { d: dist(e.touches), z: zoomRef.current }
      }
    }
    const onMove = e => {
      if (e.touches.length === 2 && pinch.current) {
        e.preventDefault()
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
        applyZoom(pinch.current.z * (dist(e.touches) / pinch.current.d), cx, cy)
      }
    }
    const onEnd = e => {
      if (e.touches.length < 2) pinch.current = null
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [])

  const onDoubleTap = e => {
    const now = Date.now()
    if (now - lastTap.current < 300) {
      applyZoom(zoomRef.current > 1 ? 1 : 2.5, e.clientX, e.clientY)
      lastTap.current = 0
    } else {
      lastTap.current = now
    }
  }

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={alt}>
      <button className="lightbox__close" onClick={onClose} aria-label="Close full screen view">✕</button>
      <div className="lightbox__scroll" ref={scrollRef}>
        <img
          src={src}
          alt={alt}
          className="lightbox__img"
          style={{ width: `${zoom * 100}%` }}
          onClick={onDoubleTap}
          draggable="false"
        />
      </div>
      <div className="lightbox__controls">
        <button onClick={() => applyZoom(zoomRef.current / 1.5)} aria-label="Zoom out" disabled={zoom <= MIN_ZOOM}>−</button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button onClick={() => applyZoom(zoomRef.current * 1.5)} aria-label="Zoom in" disabled={zoom >= MAX_ZOOM}>+</button>
      </div>
    </div>
  )
}
