import { useRef, useState } from 'react'
import { ImageUp, Plus, RefreshCw, Trash2, X, Link2, FolderOpen } from 'lucide-react'
import type {
  ImageBlock, ImageTextBlock, GalleryBlock, VideoBlock, EmbedBlock, AudioBlock,
} from '../../types'
import { resolveAssetSrc } from '../../types'
import { useStore } from '../../store'
import { readImageFile, readFileAsDataURL } from '../../utils/file'
import { parseVideoUrl } from '../../utils/embed'
import { uid } from '../../utils/id'
import MediaLibrary from '../MediaLibrary'
import RichText from '../RichText'
import { Button } from '../../ui'
import { usePatch } from './SimpleBlocks'
import { Group, NoOptions, NumberRow, SegRow, TextRow } from './inspectorFields'

/** Turn a stored src (an `asset:<id>` ref or a plain URL) into something an
    <img>/<audio> tag can display. */
export function useAssetSrc(src: string): string {
  const assets = useStore((s) => s.course?.assets)
  return resolveAssetSrc(src, assets)
}

function AssetImg({ src, alt, style }: { src: string; alt: string; style?: React.CSSProperties }) {
  const resolved = useAssetSrc(src)
  if (!resolved) return <div className="asset-missing">Media missing — it was deleted from the library</div>
  return <img src={resolved} alt={alt} style={style} />
}

/* ---------- shared upload zone: uploads land in the course media library ---------- */
export function UploadZone({
  onImage,
  label = 'Drop an image here, or click to browse',
  accept = 'image/*',
  compact,
  raw = false, // keep the data URL instead of creating an asset (course cover)
}: {
  onImage: (src: string) => void
  label?: string
  accept?: string
  compact?: boolean
  raw?: boolean
}) {
  const addAsset = useStore((s) => s.addAsset)
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [picking, setPicking] = useState(false)
  const isImage = accept.startsWith('image')

  async function handleFiles(files: FileList | null) {
    const f = files?.[0]
    if (!f) return
    if (raw) {
      onImage(isImage ? await readImageFile(f) : await readFileAsDataURL(f))
      return
    }
    const asset = await addAsset(f)
    if (asset) onImage('asset:' + asset.id)
  }

  return (
    <>
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
        {!raw && (
          <button
            className="btn sm"
            style={{ marginTop: 10 }}
            onClick={(e) => {
              e.stopPropagation()
              setPicking(true)
            }}
          >
            <FolderOpen size={13} /> Choose from library
          </button>
        )}
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
      {picking && (
        <div onClick={(e) => e.stopPropagation()}>
          <MediaLibrary
            kind={isImage ? 'image' : 'audio'}
            onPick={onImage}
            onClose={() => setPicking(false)}
          />
        </div>
      )}
    </>
  )
}

/* ---------- Image ---------- */
export function ImageEditor({ block }: { block: ImageBlock }) {
  const patch = usePatch(block)
  return (
    <div>
      {block.src ? (
        <div className="img-preview">
          <AssetImg src={block.src} alt={block.alt} />
          <div className="img-replace">
            <button className="btn sm" onClick={() => patch({ src: '' })}>
              <RefreshCw size={12} /> Replace
            </button>
          </div>
        </div>
      ) : (
        <UploadZone onImage={(src) => patch({ src })} />
      )}
      <input
        className="mini-input blk-caption"
        aria-label="Caption"
        value={block.caption}
        placeholder="Caption (optional)"
        onChange={(e) => patch({ caption: e.target.value })}
      />
    </div>
  )
}

export function ImageOptions({ block }: { block: ImageBlock }) {
  const patch = usePatch(block)
  return (
    <Group title="Image">
      <SegRow
        label="Width"
        value={block.width}
        options={[
          { value: 'normal', label: 'Normal' },
          { value: 'wide', label: 'Wide' },
          { value: 'full', label: 'Full' },
        ]}
        onChange={(width) => patch({ width })}
      />
      <TextRow
        label="Alt text"
        value={block.alt}
        placeholder="Describe the image"
        onChange={(alt) => patch({ alt })}
        hint="Read aloud by screen readers. Leave empty only if the image is purely decorative."
      />
    </Group>
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
              <AssetImg src={block.src} alt={block.alt} />
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
    </div>
  )
}

export function ImageTextOptions({ block }: { block: ImageTextBlock }) {
  const patch = usePatch(block)
  return (
    <Group title="Image & text">
      <SegRow
        label="Image side"
        value={block.imageSide}
        options={[
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
        ]}
        onChange={(imageSide) => patch({ imageSide })}
      />
      <TextRow
        label="Alt text"
        value={block.alt}
        placeholder="Describe the image"
        onChange={(alt) => patch({ alt })}
      />
    </Group>
  )
}

/* ---------- Gallery ---------- */
export function GalleryEditor({ block }: { block: GalleryBlock }) {
  const patch = usePatch(block)
  const addAsset = useStore((s) => s.addAsset)
  const inputRef = useRef<HTMLInputElement>(null)
  const [picking, setPicking] = useState(false)

  async function addFiles(files: FileList | null) {
    if (!files) return
    const added = [...block.images]
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue
      const asset = await addAsset(f)
      if (asset) added.push({ id: uid(), src: 'asset:' + asset.id, alt: '', caption: '' })
    }
    patch({ images: added })
  }

  return (
    <div>
      <div className="gallery-edit-grid">
        {block.images.map((im) => (
          <div key={im.id} className="g-item">
            <AssetImg src={im.src} alt={im.alt} />
            <button
              className="g-del"
              title="Remove"
              aria-label="Remove" onClick={() => patch({ images: block.images.filter((x) => x.id !== im.id) })}
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
      <div className="blk-actions">
        <Button size="sm" icon={<FolderOpen size={13} />} onClick={() => setPicking(true)}>
          From library
        </Button>
      </div>
      {picking && (
        <MediaLibrary
          kind="image"
          onPick={(src) => patch({ images: [...block.images, { id: uid(), src, alt: '', caption: '' }] })}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}

export function GalleryOptions({ block }: { block: GalleryBlock }) {
  const patch = usePatch(block)
  return (
    <Group title="Gallery">
      <SegRow
        label="Columns"
        value={String(block.columns) as '2' | '3' | '4'}
        options={[
          { value: '2', label: '2' },
          { value: '3', label: '3' },
          { value: '4', label: '4' },
        ]}
        onChange={(v) => patch({ columns: Number(v) as 2 | 3 | 4 })}
        hint="Collapses to a single column on phones."
      />
    </Group>
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
          <input
            className="mini-input blk-caption"
            aria-label="Caption"
            value={block.caption}
            placeholder="Caption (optional)"
            onChange={(e) => patch({ caption: e.target.value })}
          />
        </div>
      )}
    </div>
  )
}

export function VideoOptions({ block }: { block: VideoBlock }) {
  return (
    <Group title="Video">
      {block.embedUrl ? (
        <p className="insp-note">
          Source: {block.provider}. The player embeds it responsively at 16:9.
        </p>
      ) : (
        <p className="insp-note">Paste a YouTube or Vimeo URL on the canvas to add a video.</p>
      )}
    </Group>
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
          <input
            className="mini-input blk-caption"
            aria-label="Caption"
            value={block.caption}
            placeholder="Caption (optional)"
            onChange={(e) => patch({ caption: e.target.value })}
          />
        </div>
      )}
      <p className="drop-hint">
        Note: some sites block embedding in iframes. If the preview stays blank, the site doesn’t allow it.
      </p>
    </div>
  )
}

export function EmbedOptions({ block }: { block: EmbedBlock }) {
  const patch = usePatch(block)
  return (
    <Group title="Embed">
      <NumberRow
        label="Height"
        min={120}
        max={1200}
        step={20}
        suffix="px"
        value={block.height}
        onChange={(height) => patch({ height })}
      />
      <p className="insp-note">
        Some sites refuse to be embedded in an iframe. If the preview stays blank, that site does
        not allow it.
      </p>
    </Group>
  )
}

/* ---------- Audio ---------- */
export function AudioEditor({ block }: { block: AudioBlock }) {
  const patch = usePatch(block)
  const audioSrc = useAssetSrc(block.src)
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
          <audio controls src={audioSrc} style={{ flex: 1 }} />
          <button className="icon-btn danger" title="Remove audio" aria-label="Remove audio" onClick={() => patch({ src: '' })}>
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

export function AudioOptions() {
  return <NoOptions what="An audio clip" />
}
