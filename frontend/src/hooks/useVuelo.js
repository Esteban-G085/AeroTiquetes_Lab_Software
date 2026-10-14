import { useCallback, useEffect, useState } from 'react'
import { obtenerVuelo } from '../features/busqueda/services/busquedaService.js'

/** Carga el detalle de un vuelo por id (o código). */
export default function useVuelo(id) {
  const [vuelo, setVuelo] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vivo = true
    if (!id) {
      setCargando(false)
      return undefined
    }
    setCargando(true)
    setError(null)
    obtenerVuelo(id)
      .then((data) => {
        if (vivo) setVuelo(data)
      })
      .catch((e) => {
        if (vivo) setError(e)
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [id, intento])

  const recargar = useCallback(() => setIntento((n) => n + 1), [])

  return { vuelo, cargando, error, recargar }
}
