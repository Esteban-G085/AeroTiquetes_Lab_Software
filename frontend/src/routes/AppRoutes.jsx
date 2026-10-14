import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'

import BuscarVuelosPage from '../features/busqueda/pages/BuscarVuelosPage.jsx'
import VueloDetallePage from '../features/busqueda/pages/VueloDetallePage.jsx'
import VuelosAdminPage from '../features/vuelos/pages/VuelosAdminPage.jsx'
import VueloAdminDetallePage from '../features/vuelos/pages/VueloAdminDetallePage.jsx'
import ProgramarVueloPage from '../features/vuelos/pages/ProgramarVueloPage.jsx'
import NoEncontradoPage from '../features/comun/pages/NoEncontradoPage.jsx'
import LoginPage from '../features/usuarios/pages/LoginPage.jsx'

const ROLES_ADMIN = ['administrador', 'root']

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/buscar" replace />} />

        {/* HU05 — búsqueda y detalle (visitante y cliente) */}
        <Route path="buscar" element={<BuscarVuelosPage />} />
        <Route path="vuelos/:id" element={<VueloDetallePage />} />

        {/* Autenticación (placeholder: lo implementa F1) */}
        <Route path="login" element={<LoginPage />} />

        {/* HU18 / HU19 — panel de administración de vuelos */}
        <Route
          path="admin/vuelos"
          element={
            <ProtectedRoute roles={ROLES_ADMIN}>
              <VuelosAdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/vuelos/nuevo"
          element={
            <ProtectedRoute roles={ROLES_ADMIN}>
              <ProgramarVueloPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/vuelos/:id"
          element={
            <ProtectedRoute roles={ROLES_ADMIN}>
              <VueloAdminDetallePage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NoEncontradoPage />} />
      </Route>
    </Routes>
  )
}
