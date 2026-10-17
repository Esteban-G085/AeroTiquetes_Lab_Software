import { Outlet } from 'react-router-dom'
import { useAuth } from '@/context'
import { getNavItems } from '@/features'
import Header from './Header'
import Footer from './Footer'
import { useDocumentTitle } from './useDocumentTitle'

// Nombre visible: el backend decide qué campos manda; se prueban los más probables.
const displayName = (user) => user?.nombres ?? user?.nombre ?? user?.usuario ?? 'Mi cuenta'

/** Layout con cabecera y pie (la mayoría de pantallas). */
export default function MainLayout() {
  const { rol, user, isAuthenticated, logout } = useAuth()
  useDocumentTitle()

  return (
    <div className="at-app">
      <a href="#contenido" className="visually-hidden-focusable btn btn-light m-2">Saltar al contenido</a>
      <Header
        mainItems={getNavItems(rol, 'main')}
        accountItems={getNavItems(rol, 'account')}
        userName={isAuthenticated ? displayName(user) : undefined}
        onLogout={isAuthenticated ? logout : undefined}
      />
      <main id="contenido" className="at-main container">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
