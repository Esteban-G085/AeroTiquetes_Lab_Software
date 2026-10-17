import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getRouteMeta } from '@/features'

/** Título de la pestaña = título de la ruta que declara su feature. */
export function useDocumentTitle() {
  const { pathname } = useLocation()
  const title = getRouteMeta(pathname)?.title
  useEffect(() => {
    document.title = title ? `${title} · AeroTiquetes` : 'AeroTiquetes'
  }, [title])
  return title
}
