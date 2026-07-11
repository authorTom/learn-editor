export interface ParsedEmbed {
  provider: 'youtube' | 'vimeo' | 'other'
  embedUrl: string
}

/** Turn a pasted video URL (YouTube, Vimeo, or any iframe-able URL) into an embed src. */
export function parseVideoUrl(raw: string): ParsedEmbed | null {
  const url = raw.trim()
  if (!url) return null

  // YouTube: watch?v=, youtu.be/, shorts/, embed/
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,20})/
  )
  if (yt) {
    return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${yt[1]}` }
  }

  // Vimeo: vimeo.com/12345 or player.vimeo.com/video/12345, optional privacy hash
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([\w]+))?/)
  if (vimeo) {
    const hash = vimeo[2] ? `?h=${vimeo[2]}` : ''
    return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeo[1]}${hash}` }
  }

  if (/^https?:\/\//.test(url)) {
    return { provider: 'other', embedUrl: url }
  }
  return null
}
