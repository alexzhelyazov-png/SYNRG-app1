// ── Video embed utilities ────────────────────────────────────
// Supports: Vimeo, YouTube, Bunny Stream, direct MP4

const BUNNY_CDN = import.meta.env.VITE_BUNNY_CDN || ''

/**
 * Convert any video URL to an embeddable URL
 * @param {string} url - Video URL (Vimeo, YouTube, Bunny, or direct)
 * @returns {{ type: string, embedUrl: string } | null}
 */
export function parseVideoUrl(url) {
  if (!url) return null
  const u = url.trim()

  // Vimeo: vimeo.com/123456 or player.vimeo.com/video/123456
  const vimeoMatch = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeoMatch) {
    return { type: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=0&title=0&byline=0&portrait=0&dnt=1` }
  }

  // YouTube: youtube.com/watch?v=xxx or youtu.be/xxx or youtube.com/embed/xxx
  const ytMatch = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) {
    return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1` }
  }

  // Bunny Stream: iframe.mediadelivery.net/embed/{library_id}/{video_id}
  // or video.bunnycdn.com/embed/{library_id}/{video_id}
  const bunnyMatch = u.match(/(?:iframe\.mediadelivery\.net|video\.bunnycdn\.com)\/embed\/(\d+)\/([a-f0-9-]+)/)
  if (bunnyMatch) {
    return { type: 'bunny', embedUrl: `https://iframe.mediadelivery.net/embed/${bunnyMatch[1]}/${bunnyMatch[2]}?autoplay=false&preload=true` }
  }

  // Bunny Stream play URL (player.mediadelivery.net/play/ or iframe.mediadelivery.net/play/)
  const bunnyDirect = u.match(/(?:player|iframe)\.mediadelivery\.net\/play\/(\d+)\/([a-f0-9-]+)/)
  if (bunnyDirect) {
    return { type: 'bunny', embedUrl: `https://iframe.mediadelivery.net/embed/${bunnyDirect[1]}/${bunnyDirect[2]}?autoplay=false&preload=true` }
  }

  // Direct video file (mp4, webm, etc.)
  if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(u)) {
    return { type: 'direct', embedUrl: u }
  }

  // Unknown — try as iframe anyway
  return { type: 'unknown', embedUrl: u }
}

/**
 * Extract Bunny video ID from any Bunny URL
 * @param {string} url
 * @returns {string|null}
 */
function extractBunnyVideoId(url) {
  if (!url) return null
  const u = url.trim()
  // embed URL
  const embed = u.match(/(?:iframe\.mediadelivery\.net|video\.bunnycdn\.com)\/embed\/\d+\/([a-f0-9-]+)/)
  if (embed) return embed[1]
  // play URL
  const play = u.match(/(?:player|iframe)\.mediadelivery\.net\/play\/\d+\/([a-f0-9-]+)/)
  if (play) return play[1]
  // CDN URL (vz-xxx.b-cdn.net/{video_id}/...)
  const cdn = u.match(/vz-[^/]+\.b-cdn\.net\/([a-f0-9-]+)\//)
  if (cdn) return cdn[1]
  return null
}

/**
 * Get a thumbnail URL from a video URL
 * @param {string} url
 * @returns {string|null}
 */
export function getVideoThumbnail(url) {
  if (!url) return null
  const u = url.trim()

  // YouTube
  const ytMatch = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`

  // Bunny Stream — use configured CDN hostname
  if (BUNNY_CDN) {
    const videoId = extractBunnyVideoId(u)
    if (videoId) return `https://${BUNNY_CDN}/${videoId}/thumbnail.jpg`
  }

  return null
}
