import { useRef, useState } from 'react'
import { ImageUp, Plus, RefreshCw, Trash2, X, Link2 } from 'lucide-react'
import type {
  ImageBlock, ImageTextBlock, GalleryBlock, VideoBlock, EmbedBlock, AudioBlock,
} from '../../types'
import { readImageFile, readFileAsDataURL } from '../../utils/file'
import { parseVideoUrl } from '../../utils/embed'
import { uid } from '../../utils/id'
import RichText from '../RichText'
import { usePatch, Seg } from './SimpleBlocks'

/* ---------- shared image upload zone ---------- */
export function UploadZone({
  onImage,
  label = 'Drop an image here, or click to browse',
  accept = 'image/*',
  compact,
}: {
  onImage: (dataUrl: string) => void
  label?: string
  accept?: string
  compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  async function handleFiles(files: FileList | null) {
    const f = files?.[0]
    if (!f) return
    const dataUrl = accept.startsWith('image')
      ? await readImageFile(f)
      : await readFileAsDataURL(f)
    onImage(dataUrl)
  }

  return (
    <div
      className={'upload-zone' + (over ? ' over' : '')}
      style={compact ? { padding: '18px 14px' } : undefined}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        handleFiles(e.dataTransfer.files)
      }}
    >
      <div className="up-icon">
        <ImageUp size={compact ? 18 : 26} />
      </div>
      {label}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          handleFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

/* ---------- Image ---------- */
export function ImageEditor({ block }: { block: ImageBlock }) {
  const patch = usePatch(block)
  return (
    <div>
      {block.src ? (
        <div className="img-preview">
          <img src={block.src} alt={block.alt} />
          <div className="img-replace">
            <button className="btn sm" onClick={() => patch({ src: '' })}>
              <RefreshCw size={12} /> Replace
            </button>
          </div>
        </div>
      ) : (
        <UploadZone onImage={(src) => patch({ src })} />
      )}
      <div className="blk-options">
        <input
          className="mini-input"
          style={{ flex: 1, minWidth: 140 }}
          value={block.caption}
          placeholder="Caption (optional)"
          onChange={(e) => patch({ caption: e.target.value })}
        />
        <input
          className="mini-input"
          style={{ flex: 1, minWidth: 140 }}
          value={block.alt}
          placeholder="Alt text for accessibility"
          onChange={(e) => patch({ alt: e.target.value })}
        />
        <span className="lbl">Width</span>
        <Seg
          value={block.width}
          options={[{ v: 'normal', label: 'Normal' }, { v: 'wide', label: 'Wide' }, { v: 'full', label: 'Full' }]}
          onChange={(width) => patch({ width })}
        />
      </div>
    </div>
  )
}

/* ---------- Image & text ---------- */
export function ImageTextEditor({ block }: { block: ImageTextBlock }) {
  const patch = usePatch(block)
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, flexDirection: block.imageSide === 'right' ? 'row-reverse' : 'row' }}>
        <div style={{ width: '42%', flexShrink: 0 }}>
          {block.src ? (
            <div className="img-preview">
              <img src={block.src} alt={block.alt} />
              <div className="img-replace">
                <button className="btn sm" onClick={() => patch({ src: '' })}>
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>
          ) : (
            <UploadZone compact onImage={(src) => patch({ src })} label="Add image" />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <RichText
            value={block.html}
            onChange={(html) => patch({ html })}
            placeholder="Text beside the image…"
            compact
          />
        </div>
      </div>
      <div className="blk-options">
        <span className="lbl">Image side</span>
        <Seg
          value={block.imageSide}
          options={[{ v: 'left', label: 'Left' }, { v: 'right', label: 'Right' }]}
          onChange={(imageSide) => patch({ imageSide })}
        />
        <input
          className="mini-input"
          style={{ flex: 1, minWidth: 130 }}
          value={block.alt}
          placeholder="Alt text"
          onChange={(e) => patch({ alt: e.target.value })}
        />
      </div>
    </div>
  )
}

/* ---------- Gallery ---------- */
export function GalleryEditor({ block }: { block: GalleryBlock }) {
  const patch = usePatch(block)
  const inputRef = useRef<HTMLInputElement>(null)

  async function addFiles(files: FileList | null) {
    if (!files) return
    const added = [...block.images]
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue
      added.push({ id: uid(), src: await readImageFile(f, 1280), alt: '', caption: '' })
    }
    patch({ images: added })
  }

  return (
    <div>
      <div className="gallery-edit-grid">
        {block.images.map((im) => (
          <div key={im.id} className="g-item">
            <img src={im.src} alt={im.alt} />
            <button
              className="g-del"
              title="Remove"
              onClick={() => patch({ images: block.images.filter((x) => x.id !== im.id) })}
            >
              <X size={13} />
            </button>
            <input
              className="g-cap"
              value={im.caption}
              placeholder="Caption…"
              onChange={(e) =>
                patch({
                  images: block.images.map((x) =>
                    x.id === im.id ? { ...x, caption: e.target.value, alt: e.target.value } : x
                  ),
                })
              }
            />
          </div>
        ))}
        <button className="g-add" onClick={() => inputRef.current?.click()}>
          <Plus size={18} />
          Add images
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      <div className="blk-options">
        <span className="lbl">Columns</span>
        <Seg
          value={String(block.columns) as '2' | '3' | '4'}
          options={[{ v: '2', label: '2' }, { v: '3', label: '3' }, { v: '4', label: '4' }]}
          onChange={(v) => patch({ columns: Number(v) as 2 | 3 | 4 })}
        />
      </div>
    </div>
  )
}

/* ---------- Video ---------- */
export function VideoEditor({ block }: { block: VideoBlock }) {
  const patch = usePatch(block)
  const [draft, setDraft] = useState(block.url)
  const [error, setError] = useState('')

  function apply() {
    const parsed = parseVideoUrl(draft)
    if (!parsed) {
      setError('That doesn’t look like a valid URL. Paste a YouTube or Vimeo link.')
      return
    }
    setError('')
    patch({ url: draft.trim(), embedUrl: parsed.embedUrl, provider: parsed.provider })
  }

  return (
    <div>
      <div className="blk-row">
        <Link2 size={15} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
        <input
          className="mini-input"
          style={{ flex: 1 }}
          value={draft}
          placeholder="Paste a YouTube or Vimeo URL (e.g. https://youtu.be/…)"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
        />
        <button className="btn sm primary" onClick={apply}>
          {block.embedUrl ? 'Update' : 'Add video'}
        </button>
      </div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 6 }}>{error}</div>}
      {block.embedUrl && (
        <div style={{ marginTop: 12 }}>
          <div className="video-embed-preview">
            <iframe
              src={block.embedUrl}
              title="Video preview"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
          <div className="blk-options" style={{ borderTop: 'none', paddingTop: 6 }}>
            <input
              className="mini-input"
              style={{ flex: 1 }}
              value={block.caption}
              placeholder="Caption (optional)"
              onChange={(e) => patch({ caption: e.target.value })}
            />
            <span className="lbl">{block.provider}</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- Embed ---------- */
export function EmbedEditor({ block }: { block: EmbedBlock }) {
  const patch = usePatch(block)
  const [draft, setDraft] = useState(block.url)

  return (
    <div>
      <div className="blk-row">
        <Link2 size={15} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
        <input
          className="mini-input"
          style={{ flex: 1 }}
          value={draft}
          placeholder="Paste any embeddable URL (Google Docs, Genially, H5P, maps…)"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && patch({ url: draft.trim() })}
        />
        <button className="btn sm primary" onClick={() => patch({ url: draft.trim() })}>
          {block.url ? 'Update' : 'Embed'}
        </button>
      </div>
      {block.url && (
        <div style={{ marginTop: 12 }}>
          <div className="embed-frame" style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
            <iframe src={block.url} title="Embed preview" style={{ width: '100%', height: block.height, border: 0, display: 'block' }} />
          </div>
          <div className="blk-options" style={{ borderTop: 'none', paddingTop: 6 }}>
            <span className="lbl">Height</span>
            <input
              className="mini-input"
              type="number"
              min={120}
              max={1200}
              step={20}
              style={{ width: 90 }}
              value={block.height}
              onChange={(e) => patch({ height: Number(e.target.value) || 480 })}
            />
            <input
              className="mini-input"
              style={{ flex: 1 }}
              value={block.caption}
              placeholder="Caption (optional)"
              onChange={(e) => patch({ caption: e.target.value })}
            />
          </div>
        </div>
      )}
      <p className="drop-hint">
        Note: some sites block embedding in iframes. If the preview stays blank, the site doesn’t allow it.
      </p>
    </div>
  )
}

/* ---------- Audio ---------- */
export function AudioEditor({ block }: { block: AudioBlock }) {
  const patch = usePatch(block)
  return (
    <div>
      <input
        className="mini-input"
        style={{ width: '100%', marginBottom: 10, fontWeight: 600 }}
        value={block.title}
        placeholder="Audio title (optional)"
        onChange={(e) => patch({ title: e.target.value })}
      />
      {block.src ? (
        <div className="blk-row">
          <audio controls src={block.src} style={{ flex: 1 }} />
          <button className="icon-btn danger" title="Remove audio" onClick={() => patch({ src: '' })}>
            <Trash2 size={15} />
          </button>
        </div>
      ) : (
        <UploadZone
          accept="audio/*"
          label="Drop an audio file here, or click to browse (MP3, M4A, WAV)"
          onImage={(src) => patch({ src })}
        />
      )}
    </div>
  )
}
