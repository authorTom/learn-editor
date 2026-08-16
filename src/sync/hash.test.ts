import { describe, expect, it } from 'vitest'
import { decodeDataUrl, sha256, sha256Fallback, toDataUrl } from './hash'

/**
 * The two hash implementations must agree, always.
 *
 * They are chosen by whether the page is a secure context, which is a property
 * of the deployment rather than the data — so the same asset hashed on an https
 * laptop and an http LAN machine has to come out with the same name, or the two
 * clients disagree about which bytes the server already holds.
 */

const KNOWN: [string, string][] = [
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ['hello', '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'],
]

describe('sha256', () => {
  it.each(KNOWN)('matches the published digest for %j', async (input, expected) => {
    const bytes = new TextEncoder().encode(input)
    expect(await sha256(bytes)).toBe(expected)
    expect(sha256Fallback(bytes)).toBe(expected)
  })

  it('agrees with WebCrypto across lengths that straddle the block boundary', async () => {
    // 55/56/57 and 63/64/65 are where SHA-256's padding rules change, and where
    // a hand-written implementation goes wrong if it is going to.
    for (const n of [1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 121, 1000, 4096]) {
      const bytes = new Uint8Array(n)
      for (let i = 0; i < n; i++) bytes[i] = (i * 31 + 7) & 0xff
      expect(sha256Fallback(bytes), `length ${n}`).toBe(await sha256(bytes))
    }
  })

  it('hashes only the view, not the buffer behind it', async () => {
    const buffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
    const view = buffer.subarray(2, 5)
    expect(await sha256(view)).toBe(await sha256(new Uint8Array([3, 4, 5])))
  })

  it('is sensitive to a single flipped bit', async () => {
    const a = new Uint8Array([0, 0, 0, 0])
    const b = new Uint8Array([0, 0, 0, 1])
    expect(await sha256(a)).not.toBe(await sha256(b))
  })
})

describe('data URLs', () => {
  it('round-trips bytes through a data URL', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255])
    const url = toDataUrl(bytes, 'image/png')
    expect(url.startsWith('data:image/png;base64,')).toBe(true)
    const decoded = decodeDataUrl(url)
    expect(decoded?.mime).toBe('image/png')
    expect([...decoded!.bytes]).toEqual([...bytes])
  })

  it('handles a payload larger than the spread-argument limit', () => {
    // String.fromCharCode(...bytes) throws above ~65k arguments, so this is the
    // case that breaks a naive implementation — and every real photograph hits it.
    const bytes = new Uint8Array(300_000)
    for (let i = 0; i < bytes.length; i++) bytes[i] = i & 0xff
    const decoded = decodeDataUrl(toDataUrl(bytes, 'image/jpeg'))
    expect(decoded?.bytes.length).toBe(bytes.length)
    expect(decoded?.bytes[299_999]).toBe(bytes[299_999])
  })

  it('reads a non-base64 data URL', () => {
    const decoded = decodeDataUrl('data:text/plain,hello%20world')
    expect(new TextDecoder().decode(decoded!.bytes)).toBe('hello world')
  })

  it('returns null for something that is not a data URL', () => {
    expect(decodeDataUrl('https://example.com/a.png')).toBeNull()
    expect(decodeDataUrl('')).toBeNull()
  })

  it('defaults the media type when the URL omits one', () => {
    expect(decodeDataUrl('data:;base64,aGk=')?.mime).toBe('application/octet-stream')
  })
})
