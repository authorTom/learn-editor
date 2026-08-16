/**
 * SHA-256 over an asset's bytes, which is how the server names it.
 *
 * The awkward part is `crypto.subtle`: it exists only in a *secure context*.
 * That means https, or localhost — and not `http://192.168.1.20:8080`, which is
 * precisely how a self-hosted Quoin gets reached from a colleague's
 * laptop. Depending on WebCrypto alone would mean media sync silently failing
 * on the most ordinary LAN deployment there is.
 *
 * So there is a fallback implementation. It is used only when WebCrypto is
 * absent, it is about as fast as JavaScript gets for this, and the tests check
 * the two agree — a mismatch would put an asset under the wrong name and make
 * every client that pulls it disagree with the one that pushed it.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

/** Pure-JS SHA-256. Only reached when `crypto.subtle` is unavailable. */
export function sha256Fallback(bytes: Uint8Array): string {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])

  // Pad to a multiple of 64 bytes: 0x80, zeroes, then the bit length as a
  // 64-bit big-endian integer.
  const bitLen = bytes.length * 8
  const withPad = new Uint8Array((((bytes.length + 8) >> 6) + 1) << 6)
  withPad.set(bytes)
  withPad[bytes.length] = 0x80
  const view = new DataView(withPad.buffer)
  // Lengths above 2^32 bits (512MB) cannot occur here — the server's body limit
  // is far below it — so the high word is written as zero.
  view.setUint32(withPad.length - 4, bitLen >>> 0, false)
  view.setUint32(withPad.length - 8, Math.floor(bitLen / 0x100000000), false)

  const w = new Uint32Array(64)
  for (let offset = 0; offset < withPad.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false)
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15]
      const b = w[i - 2]
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3)
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }

    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      hh = g; g = f; f = e
      e = (d + t1) >>> 0
      d = c; c = b; b = a
      a = (t1 + t2) >>> 0
    }
    h[0] = (h[0] + a) >>> 0
    h[1] = (h[1] + b) >>> 0
    h[2] = (h[2] + c) >>> 0
    h[3] = (h[3] + d) >>> 0
    h[4] = (h[4] + e) >>> 0
    h[5] = (h[5] + f) >>> 0
    h[6] = (h[6] + g) >>> 0
    h[7] = (h[7] + hh) >>> 0
  }

  let out = ''
  for (const word of h) out += word.toString(16).padStart(8, '0')
  return out
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  if (globalThis.crypto?.subtle) {
    // Copy into a fresh ArrayBuffer: `bytes` may be a view onto a larger
    // buffer, and digest() would then hash the whole thing.
    const copy = new Uint8Array(bytes)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', copy)
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  return sha256Fallback(bytes)
}

/** Hash a string (used for change detection on a course document). */
export async function sha256Text(text: string): Promise<string> {
  return sha256(new TextEncoder().encode(text))
}

const DATA_URL = /^data:([^;,]*)(;base64)?,/

/** Split a data URL into its media type and raw bytes. */
export function decodeDataUrl(src: string): { mime: string; bytes: Uint8Array } | null {
  const m = DATA_URL.exec(src)
  if (!m) return null
  const mime = m[1] || 'application/octet-stream'
  const payload = src.slice(m[0].length)
  if (m[2]) {
    const binary = atob(payload)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return { mime, bytes }
  }
  return { mime, bytes: new TextEncoder().encode(decodeURIComponent(payload)) }
}

/** Turn downloaded bytes back into the data URL the course model stores. */
export function toDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = ''
  // Chunked: `String.fromCharCode(...bytes)` on a multi-megabyte image blows
  // the argument limit and throws.
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return `data:${mime || 'application/octet-stream'};base64,${btoa(binary)}`
}
