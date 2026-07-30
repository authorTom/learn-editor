import { useMemo, useState } from 'react'
import { X, Monitor, Tablet, Smartphone } from 'lucide-react'
import type { Course } from '../types'
import { buildPlayerHtml } from '../scorm/buildPlayerHtml'

type Device = 'desktop' | 'tablet' | 'phone'

const SIZES: Record<Device, { w: string; h: string; device: boolean }> = {
  desktop: { w: '100%', h: '100%', device: false },
  tablet: { w: '820px', h: '1080px', device: true },
  phone: { w: '390px', h: '780px', device: true },
}

export default function Preview({ course, onClose }: { course: Course; onClose: () => void }) {
  const [device, setDevice] = useState<Device>('desktop')

  // The preview is the real exported player, running in 'preview' SCORM mode.
  const html = useMemo(() => buildPlayerHtml(course, 'preview'), [course])
  const size = SIZES[device]

  return (
    <div className="preview-scrim">
      <div className="preview-topbar">
        <span className="pv-title">Preview — {course.title || 'Untitled course'}</span>
        <span className="seg">
          <button
            className={device === 'desktop' ? 'active' : ''}
            onClick={() => setDevice('desktop')}
            aria-label="Desktop preview" title="Desktop"
          >
            <Monitor size={14} style={{ verticalAlign: '-2px' }} /> Desktop
          </button>
          <button
            className={device === 'tablet' ? 'active' : ''}
            onClick={() => setDevice('tablet')}
            aria-label="Tablet preview" title="Tablet"
          >
            <Tablet size={14} style={{ verticalAlign: '-2px' }} /> Tablet
          </button>
          <button
            className={device === 'phone' ? 'active' : ''}
            onClick={() => setDevice('phone')}
            aria-label="Phone preview" title="Phone"
          >
            <Smartphone size={14} style={{ verticalAlign: '-2px' }} /> Phone
          </button>
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#8a8fb0' }}>
          Exactly what your learners will see — progress isn’t saved in preview
        </span>
        <button className="btn" onClick={onClose}>
          <X size={14} /> Close
        </button>
      </div>
      <div className="preview-stage">
        <div
          className={'preview-frame-wrap' + (size.device ? ' device' : '')}
          style={{ width: size.w, height: size.h }}
        >
          <iframe title="Course preview" srcDoc={html} sandbox="allow-scripts allow-popups allow-same-origin" />
        </div>
      </div>
    </div>
  )
}
