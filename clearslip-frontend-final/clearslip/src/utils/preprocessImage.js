const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE_MB = 5
const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024

export async function preprocessImage(file) {
  if (!file) throw new Error('No file provided')

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`File type not supported. Please upload a JPEG, PNG, WebP, or PDF file.`)
  }

  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is ${MAX_SIZE_MB}MB.`)
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      const base64 = dataUrl.split(',')[1]
      const mediaType = file.type === 'image/jpg' ? 'image/jpeg' : file.type
      // ile is read in the browser; base64 is only used if that isn't possible
      resolve({ base64, mediaType, fileName: file.name, fileSize: file.size, file })
    }
    reader.onerror = () => reject(new Error('Failed to read file. Please try again.'))
    reader.readAsDataURL(file)
  })
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}
