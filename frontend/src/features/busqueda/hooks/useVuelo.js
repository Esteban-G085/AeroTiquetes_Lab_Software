import { useCallback, useEffect, useState } from 'react'
import { obtenerVuelo } from '../api'

/**
 * Carga el detalle público de un vuelo (HU5). Vive dentro del feature porque usa su `api.js`
 * (un feature no puede importar los internals de otro). `recargar()` reintenta tras un fallo.
 */
export default function useVuelo(id) {
  const [vuelo, setVuelo] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [error, setError] = useState(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    if (!id) {
      setStatus('error')
      setError({ message: 'No indicamos qué vuelo mostrar.' })
      return undefined
    }
    let vivo = true
    setStatus('loading')
    setError(null)
    obtenerVuelo(id)
      .then((data) => { if (vivo) { setVuelo(data); setStatus('ready') } })
      .catch((err) => { if (vivo) { setError(err); setStatus('error') } })
    return () => { vivo = false }
  }, [id, intento])

  const recargar = useCallback(() => setIntento((n) => n + 1), [])

  return { vuelo, status, error, recargar }
}
