import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import Icon from '@/components/ui/Icon'

const TOAST_ICON = { success: 'check', error: 'alert', info: 'info' }

const ToastContext = createContext(null)
const DURATION_MS = 5000

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const push = useCallback((type, message) => {
    const id = nextId.current++
    setToasts((t) => [...t, { id, type, message }])
    setTimeout(() => dismiss(id), DURATION_MS)
  }, [dismiss])

  const api = useMemo(() => ({
    success: (m) => push('success', m),
    error: (m) => push('error', m),
    info: (m) => push('info', m),
  }), [push])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="at-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`at-toast at-toast--${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
            <Icon name={TOAST_ICON[t.type]} size={18} className="at-toast__icon" />
            <span className="at-toast__msg">{t.message}</span>
            <button type="button" className="at-toast__close" aria-label="Cerrar aviso" onClick={() => dismiss(t.id)}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
