// ── BoomerangVideo ─────────────────────────────────────────────────
// Plays an MP4/WebM clip as a seamless back-and-forth boomerang loop.
//
// The user records a simple 2–3 rep clip (e.g. three squats) and uploads
// the raw file. This component plays it forward, then reverses, then
// forward again, ad infinitum — giving the smooth "boomerang" feel seen
// in Instagram Reels / the reference app.
//
// Strategy: since HTMLVideoElement has no native reverse playback, we
// drive `currentTime` manually via requestAnimationFrame when playing
// the reverse segment. The forward segment uses native playback for
// smoothness.
//
// Props:
//   src        — clip URL (mp4/webm)
//   poster     — optional poster
//   sx         — MUI sx passthrough for the wrapper
//   trimStart  — optional seconds to skip at the very start
//   trimEnd    — optional seconds to trim from the end
//   speed      — forward playback rate (default 1)
//   reverseSpeed — reverse rate multiplier (default 1)

import { useEffect, useRef, useState } from 'react'
import { Box } from '@mui/material'

export default function BoomerangVideo({
  src,
  poster,
  sx = {},
  trimStart = 0,
  trimEnd = 0,
  speed = 1,
  reverseSpeed = 1,
  rounded = 16,
}) {
  const videoRef = useRef(null)
  const rafRef = useRef(0)
  const lastTsRef = useRef(0)
  const [direction, setDirection] = useState('forward') // 'forward' | 'reverse'

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    let cancelled = false

    const onLoadedMeta = () => {
      if (cancelled) return
      const start = Math.max(0, trimStart)
      try {
        video.currentTime = start
        video.playbackRate = speed
        video.play().catch(() => { /* autoplay may be blocked — user tap resumes */ })
      } catch { /* noop */ }
    }

    const effectiveEnd = () => {
      const dur = video.duration || 0
      return Math.max(0, dur - (trimEnd || 0))
    }

    const onTimeUpdate = () => {
      if (direction !== 'forward') return
      if (video.currentTime >= effectiveEnd() - 0.05) {
        // Flip to reverse
        video.pause()
        setDirection('reverse')
      }
    }

    const reverseTick = (ts) => {
      if (cancelled) return
      if (direction !== 'reverse') return
      const last = lastTsRef.current || ts
      const dt = (ts - last) / 1000
      lastTsRef.current = ts
      const start = Math.max(0, trimStart)
      const next = video.currentTime - dt * reverseSpeed
      if (next <= start + 0.01) {
        video.currentTime = start
        setDirection('forward')
        try { video.playbackRate = speed; video.play() } catch {}
        lastTsRef.current = 0
      } else {
        video.currentTime = next
        rafRef.current = requestAnimationFrame(reverseTick)
      }
    }

    if (direction === 'reverse') {
      lastTsRef.current = 0
      rafRef.current = requestAnimationFrame(reverseTick)
    }

    video.addEventListener('loadedmetadata', onLoadedMeta)
    video.addEventListener('timeupdate', onTimeUpdate)

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      video.removeEventListener('loadedmetadata', onLoadedMeta)
      video.removeEventListener('timeupdate', onTimeUpdate)
    }
  }, [src, direction, trimStart, trimEnd, speed, reverseSpeed])

  if (!src) return null

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        borderRadius: `${rounded}px`,
        overflow: 'hidden',
        background: '#000',
        aspectRatio: '1 / 1',
        ...sx,
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        muted
        playsInline
        preload="auto"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </Box>
  )
}
