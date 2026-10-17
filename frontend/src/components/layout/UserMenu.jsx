import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

const initial = (name) => (String(name ?? '').trim()[0] ?? '?').toUpperCase()

/** Menú de la persona con sesión (escritorio): nombre + opciones de cuenta + cerrar sesión. */
export default function UserMenu({ name, items = [], onLogout }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="at-usermenu" ref={rootRef}>
      <button type="button" className="at-usermenu__btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="at-usermenu__avatar" aria-hidden="true">{initial(name)}</span>
        <span className="at-usermenu__name">{name}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="at-usermenu__panel" role="menu" aria-label="Cuenta">
          {items.map((i) => (
            <Link key={i.to} to={i.to} role="menuitem" className="at-usermenu__item" onClick={() => setOpen(false)}>{i.label}</Link>
          ))}
          <button type="button" role="menuitem" className="at-usermenu__item at-usermenu__item--danger"
            onClick={() => { setOpen(false); onLogout?.() }}>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
