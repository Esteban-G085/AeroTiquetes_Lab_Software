import { Outlet } from 'react-router-dom'
import { useDocumentTitle } from './useDocumentTitle'

/** Layout de pantalla completa, sin barra (login, registro, perfil: así están en los mockups). */
export default function BareLayout() {
  useDocumentTitle()
  return <Outlet />
}
