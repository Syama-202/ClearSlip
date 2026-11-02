import { createContext, useContext, useState, useCallback } from 'react'
import { X } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev.slice(-2), { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed right-4 top-20 z-[1000] flex flex-col gap-2">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }) {
  const bg = toast.type === 'success' ? 'bg-good' : toast.type === 'error' ? 'bg-maroon' : 'bg-terra'
  return (
    <div role="status" className={`flex w-[min(26rem,calc(100vw-2rem))] animate-slide-in items-start gap-3 rounded-xl px-4 py-3 text-base leading-snug text-white shadow-lg ${bg}`}>
      <span className="flex-1">{toast.message}</span>
      <button onClick={onClose} className="rounded p-0.5 text-white/80 hover:text-white" aria-label="Dismiss">
        <X size={18} />
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx.addToast
}
