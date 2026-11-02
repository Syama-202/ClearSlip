import { useState, useRef, useEffect } from 'react'
import { UploadCloud, FileText, X } from 'lucide-react'
import { preprocessImage, formatFileSize } from '../utils/preprocessImage'

export default function ImageUpload({ onImageReady }) {
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState(null) // { name, size, url | null }
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  // Release the thumbnail's object URL when it is replaced or removed
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url) }, [preview])

  async function handleFile(file) {
    setError('')
    try {
      const result = await preprocessImage(file)
      const url = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      setPreview({ name: file.name, size: file.size, url })
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
      <div className="flex items-center gap-4 rounded-xl border border-line bg-sand p-3">
        {preview.url
          ? <img src={preview.url} alt="Payslip preview" className="h-20 w-16 shrink-0 rounded-lg border border-line bg-white object-cover" />
          : <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg bg-saffron-500 text-white"><FileText size={28} /></div>}
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-medium text-terra">{preview.name}</div>
          <div className="text-sm text-muted">{formatFileSize(preview.size)} · ready to decode</div>
        </div>
        <button onClick={clearFile} className="rounded-lg p-2 text-maroon hover:bg-white" aria-label="Remove file">
          <X size={20} />
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 transition focus:outline-none focus-visible:ring-4 focus-visible:ring-saffron-100 ${
          dragging ? 'border-saffron-500 bg-saffron-50' : 'border-line bg-white hover:border-saffron-500/50'
        }`}
      >
        <UploadCloud size={36} className="text-saffron-500" />
        <span className="text-base font-medium text-terra">Drop your payslip here</span>
        <span className="text-sm text-muted">or click to browse · JPEG, PNG, PDF up to 5 MB</span>
      </button>
      {error && <div className="mt-2 text-sm text-bad">{error}</div>}
      <p className="mt-2 text-sm text-muted">Tip: bright light, the full page in view and no blur give the best results.</p>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}
