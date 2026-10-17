import { useCallback, useEffect, useState } from 'react'
import { http } from '@/services/http'
import { CIUDADES as CATALOGO } from '@/domain/ciudades'

/**
 * Catálogo de ciudades para los selects (HU5 y HU18). Lo comparten los módulos Vuelos y Búsqueda,
 * por eso vive en el núcleo (`utils/`) y no dentro de un feature.
 *
 * `GET /ciudades?uso=nacional|internacional` → { items: [Ciudad] } (ver docs/CONTRATO_VUELOS.md).
 * Si la API no responde se usa el respaldo local (`domain/ciudades`) para no bloquear el formulario;
 * `status === 'fallback'` deja que la pantalla lo advierta.
 */
export function useCiudades() {
  const [ciudades, setCiudades] = useState(CATALOGO)
  const [status, setStatus] = useState('loading') // loading | ready | fallback
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vivo = true
    setStatus('loading')
    http.get('/ciudades')
      .then(({ data }) => {
        if (!vivo) return
        const items = Array.isArray(data) ? data : data?.items
        if (Array.isArray(items) && items.length > 0) {
          setCiudades(items)
          setStatus('ready')
        } else {
          setStatus('fallback')
        }
      })
      .catch(() => { if (vivo) setStatus('fallback') })
    return () => { vivo = false }
  }, [intento])

  const recargar = useCallback(() => setIntento((n) => n + 1), [])

  return { ciudades, status, recargar }
}
