import { useCallback, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Wordmark, Logo } from '@/components/brand'
import Drawer from './Drawer'
import UserMenu from './UserMenu'

function MenuIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  )
}

const navClass = ({ isActive }) => `at-nav__link${isActive ? ' is-active' : ''}`
const drawerClass = ({ isActive }) => `at-drawer__link${isActive ? ' active' : ''}`

/**
 * Cabecera de la app. No sabe de sesión: recibe los ítems ya filtrados por rol.
 *  · Escritorio: logo · navegación visible · acciones de cuenta (ingresar/registrarse o menú de usuario).
 *  · Móvil: logo + botón de menú que abre un panel lateral con las mismas opciones.
 * `cartSlot`: reservado para el carrito de la Iteración 2; no se dibuja nada hasta que exista.
 */
export default function Header({ mainItems = [], accountItems = [], userName, onLogout, cartSlot }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const loggedIn = Boolean(userName)

  // Visitante: el último ítem de cuenta (Registrarse) es la acción principal; los demás, secundarios
  const guestActions = accountItems.map((i, idx) => ({ ...i, primary: idx === accountItems.length - 1 && accountItems.length > 1 }))

  return (
    <header className="at-header">
      <div className="container at-header__row">
        <button type="button" className="at-icon-btn at-burger" aria-label="Abrir menú" aria-expanded={open} onClick={() => setOpen(true)}>
          <MenuIcon />
        </button>

        <Link to="/" className="at-brand" aria-label="AeroTiquetes, ir al inicio"><Wordmark size={36} /></Link>

        <nav className="at-nav" aria-label="Principal">
          <ul>
            {mainItems.map((i) => (
              <li key={i.to}><NavLink to={i.to} end className={navClass}>{i.label}</NavLink></li>
            ))}
          </ul>
        </nav>

        <div className="at-header__end">
          {cartSlot}
          {loggedIn
            ? <UserMenu name={userName} items={accountItems} onLogout={onLogout} />
            : guestActions.map((i) => (
              <Link key={i.to} to={i.to} className={`btn btn-sm ${i.primary ? 'btn-primary' : 'btn-ghost'}`}>{i.label}</Link>
            ))}
        </div>
      </div>

      <Drawer open={open} onClose={close}>
        <div className="at-drawer__head">
          <span className="at-drawer__brand"><Logo size={34} title="" /> AeroTiquetes</span>
          <button type="button" className="btn-close btn-close-white" aria-label="Cerrar menú" onClick={close} />
        </div>
        {loggedIn && <div className="at-drawer__user">{userName}</div>}
        <nav aria-label="Principal">
          <ul className="at-drawer__nav">
            {[...mainItems, ...accountItems].map((i) => (
              <li key={i.to}><NavLink to={i.to} end className={drawerClass} onClick={close}>{i.label}</NavLink></li>
            ))}
          </ul>
        </nav>
        {onLogout && (
          <div className="at-drawer__foot">
            <button type="button" className="btn btn-outline-light w-100" onClick={() => { close(); onLogout() }}>Cerrar sesión</button>
          </div>
        )}
      </Drawer>
    </header>
  )
}
