import { useEffect, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/utils/cn'
import Icon from './Icon'

/** Modal accesible: Escape y clic fuera cierran, el foco entra al abrir y vuelve al cerrar. */
export default function Modal({ open, title, onClose, footer, size, children }) {
  const titleId = useId()
  const dialogRef = useRef(null)

  // `onClose` suele ser una función nueva en cada render: se guarda en una ref para que el
  // efecto dependa solo de `open`. Si dependiera de `onClose`, el foco volvería al diálogo
  // en cada tecla escrita dentro de un campo.
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose })

  useEffect(() => {
    if (!open) return undefined
    const previous = document.activeElement
    // Respeta el foco si un campo del diálogo ya lo tomó (autoFocus)
    if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && closeRef.current?.()
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="at-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={cn('at-modal', size === 'lg' && 'at-modal--lg')}
      >
        <div className="at-modal__head">
          <h2 id={titleId} className="at-modal__title">{title}</h2>
          <button type="button" className="at-icon-btn at-icon-btn--soft" aria-label="Cerrar" onClick={onClose}><Icon name="x" size={20} /></button>
        </div>
        <div className="at-modal__body">{children}</div>
        {footer && <div className="at-modal__foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
