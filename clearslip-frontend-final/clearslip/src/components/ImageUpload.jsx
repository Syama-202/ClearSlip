import { useState, useRef } from 'react'
import { preprocessImage, formatFileSize } from '../utils/preprocessImage'
import { C } from '../utils/colors'

export default function ImageUpload({ onImageReady }) {
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  async function handleFile(file) {
    setError('')
    try {
      const result = await preprocessImage(file)
      setPreview({ name: file.name, size: file.size, isImage: file.type.startsWith('image/') })
      onImageReady(result)
    } catch (err) {
      setError(err.message)
      setPreview(null)
      onImageReady(null)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function clearFile() {
    setPreview(null)
    setError('')
    onImageReady(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  if (preview) {
    return (
      <div style={{ border: `1px solid ${C.amberBorder}`, borderRadius: 10, padding: 12, background: C.yellowCard, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, background: C.saffron, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
          {preview.isImage ? '🖼️' : '📄'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.terra, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview.name}</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>{formatFileSize(preview.size)}</div>
        </div>
        <button onClick={clearFile} style={{ background: 'none', border: 'none', color: C.maroon, cursor: 'pointer', fontSize: 16, padding: 4, flexShrink: 0 }} aria-label="Remove file">✕</button>
      </div>
    )
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragging ? C.saffron : C.amberBorder}`,
          borderRadius: 10, padding: '24px 16px', cursor: 'pointer',
          background: dragging ? C.saffronLight : '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          transition: 'all 0.15s',
        }}
      >
        <div style={{ fontSize: 28 }}>📷</div>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.terra }}>Drag your payslip photo here</div>
        <div style={{ fontSize: 12, color: C.textMuted }}>or click to browse</div>
        <div style={{ fontSize: 11, color: C.textFaint, marginTop: 4 }}>JPEG, PNG, PDF — max 5MB</div>
      </div>
      {error && <div style={{ fontSize: 12, color: C.red, marginTop: 6 }}>{error}</div>}
      <div style={{ fontSize: 11, color: C.textFaint, marginTop: 6 }}>
        💡 Tip: bright light, full page visible, no blur gives best results
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
        style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}
