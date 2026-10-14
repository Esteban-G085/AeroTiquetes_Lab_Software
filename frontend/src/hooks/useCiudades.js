import { useEffect, useState } from 'react'
import api from '../services/api.js'
import { ENDPOINTS } from '../services/endpoints.js'
import { CIUDADES as CIUDADES_FALLBACK } from '../domain/ciudades.js'

/**
 * Carga el catálogo de ciudades desde la API.
 * Si el backend no responde, cae al catálogo local para no bloquear la UI.
 */
export default function useCiudades() {
  const [ciudades, setCiudades] = useState(CIUDADES_FALLBACK)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let vivo = true
    api
      .get(ENDPOINTS.ciudades)
      .then(({ data }) => {
        if (vivo && Array.isArray(data?.items) && data.items.length > 0) setCiudades(data.items)
      })
      .catch(() => {
        /* se mantiene el catálogo local */
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [])

  const porCodigo = new Map(ciudades.map((c) => [c.codigo, c]))

  return { ciudades, porCodigo, cargando }
}
