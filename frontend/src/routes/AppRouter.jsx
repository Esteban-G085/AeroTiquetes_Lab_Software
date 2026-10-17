import { Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { BareLayout, MainLayout } from '@/components/layout'
import { LoadingState } from '@/components/feedback'
import { allRoutes } from '@/features'
import { env } from '@/config/env'
import RouteGuard from './RouteGuard'
import NotFoundPage from '@/pages/NotFoundPage'
import DevUiPage from '@/pages/DevUiPage'

const renderRoute = ({ path, Component, roles }) => (
  <Route key={path} path={path} element={<RouteGuard roles={roles}><Component /></RouteGuard>} />
)

/**
 * Construye el árbol de rutas SOLO a partir de lo que declaran los features.
 * Cada ruta elige su layout: 'bare' (pantalla completa) o el de por defecto (con barra superior).
 */
export default function AppRouter() {
  const bare = allRoutes.filter((r) => r.layout === 'bare')
  const withBar = allRoutes.filter((r) => r.layout !== 'bare')

  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route element={<BareLayout />}>{bare.map(renderRoute)}</Route>
        <Route element={<MainLayout />}>
          {withBar.map(renderRoute)}
          {env.isDev && <Route path="/dev/ui" element={<DevUiPage />} />}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
