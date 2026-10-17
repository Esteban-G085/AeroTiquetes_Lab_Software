import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** "Atrás": vuelve a la pantalla anterior de la app; si se entró directo por URL, va a `fallback`. */
export function useGoBack(fallback = '/') {
  const navigate = useNavigate()
  const { key } = useLocation()
  return useCallback(() => (key !== 'default' ? navigate(-1) : navigate(fallback, { replace: true })), [key, navigate, fallback])
}
