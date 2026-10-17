import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/** Panel lateral accesible: Escape y clic fuera cierran; el foco entra al abrir y vuelve al cerrar. */
export default function Drawer({ open, onClose, label = 'Menú', children }) {
  const panelRef = useRef(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })

  useEffect(() => {
    if (!open) return undefined
    const previous = document.activeElement
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && closeRef.current?.()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="at-drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <aside ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} className="at-drawer">
        {children}
      </aside>
    </div>,
    document.body,
  )
}
