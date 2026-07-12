import { useRef, useState } from 'react'
import { X, Trash2, Upload, Music, Search } from 'lucide-react'
import { useStore } from '../store'
import { assetUsageCount } from '../utils/assets'
import { ASSET_REF } from '../types'
import type { Asset } from '../types'

function kb(bytes: number): string {
  const k = bytes / 1024
  return k > 1024 ? (k / 1024).toFixed(1) + ' MB' : Math.round(k) + ' KB'
}

/** Browse the course's uploaded media. In `pick` mode, choosing an asset returns
    its `asset:<id>` reference to the caller. */
export default function MediaLibrary({
  kind,
  onPick,
  onClose,
}: {
  kind?: Asset['kind'] // limit to images or audio when picking
  onPick?: (ref: string) => void
  onClose: () => void
}) {
  const course = useStore((s) => s.course)!
  const addAsset = useStore((s) => s.addAsset)
  const deleteAsset = useStore((s) => s.deleteAsset)
  const renameAsset = useStore((s) => s.renameAsset)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const allBlocks = course.lessons.flatMap((l) => l.blocks)
  const q = query.trim().toLowerCase()
  const assets = course.assets
    .filter((a) => (kind ? a.kind === kind : true))
    .filter((a) => !q || a.name.toLowerCase().includes(q))

  const totalSize = course.assets.reduce((n, a) => n + a.size, 0)

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/') && !f.type.startsWith('audio/')) continue
      await addAsset(f)
    }
    setBusy(false)
  }

  function pick(a: Asset) {
    onPick?.(ASSET_REF + a.id)
    onClose()
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{onPick ? 'Choose from media library' : 'Media library'}</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={17} />
          </button>
        </div>

        <div className="insert-search" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Search size={15} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
          <input
            className="input"
            autoFocus
            placeholder="Search media by file name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
          />
          <button className="btn primary" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> {busy ? 'Uploading…' : 'Upload'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={kind === 'audio' ? 'audio/*' : kind === 'image' ? 'image/*' : 'image/*,audio/*'}
            multiple
            hidden
            onChange={(e) => {
              upload(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        <div className="modal-body">
          {assets.length === 0 ? (
            <p className="drop-hint">
              {course.assets.length === 0
                ? 'No media yet. Upload images or audio here, or from any media block — everything you upload is stored once and reusable anywhere in the course.'
                : 'Nothing matches that search.'}
            </p>
          ) : (
            <div className="asset-grid">
              {assets.map((a) => {
                const uses = assetUsageCount(a.id, allBlocks)
                return (
                  <div
                    key={a.id}
                    className={'asset-card' + (onPick ? ' pickable' : '')}
                    onClick={onPick ? () => pick(a) : undefined}
                  >
                    <div className="asset-thumb">
                      {a.kind === 'image' ? (
                        <img src={a.src} alt={a.name} />
                      ) : (
                        <Music size={22} />
                      )}
                    </div>
                    <input
                      className="asset-name"
                      value={a.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => renameAsset(a.id, e.target.value)}
                    />
                    <div className="asset-meta">
                      <span>
                        {kb(a.size)} · used {uses}×
                      </span>
                      <button
                        className="icon-btn danger"
                        title={
                          uses > 0
                            ? `Used by ${uses} block${uses === 1 ? '' : 's'} — deleting will break them`
                            : 'Delete'
                        }
                        onClick={(e) => {
                          e.stopPropagation()
                          const warn =
                            uses > 0
                              ? `"${a.name}" is used by ${uses} block${uses === 1 ? '' : 's'}. Delete it anyway?`
                              : `Delete "${a.name}"?`
                          if (confirm(warn)) deleteAsset(a.id)
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <span className="drop-hint" style={{ flex: 1, marginTop: 0 }}>
            {course.assets.length} file{course.assets.length === 1 ? '' : 's'} · {kb(totalSize)} in
            this course. Each file is stored once, however many blocks use it.
          </span>
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
