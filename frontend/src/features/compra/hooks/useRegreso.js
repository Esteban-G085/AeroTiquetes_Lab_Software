import { useEffect, useRef, useState } from 'react'
import { listarVuelosRegreso } from '../api'

/**
 * Carga (una sola vez) los vuelos de regreso cuando el cliente elige "Ida y vuelta".
 * → { status: 'idle' | 'loading' | 'ready' | 'error', vuelos, error }
 */
export function useRegreso(enabled, vueloId) {
  const [state, setState] = useState({ status: 'idle', vuelos: [], error: null })
  const started = useRef(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  useEffect(() => {
    if (!enabled || started.current) return
    started.current = true
    setState({ status: 'loading', vuelos: [], error: null })
    listarVuelosRegreso(vueloId)
      .then((vuelos) => { if (alive.current) setState({ status: 'ready', vuelos, error: null }) })
      .catch((e) => { if (alive.current) setState({ status: 'error', vuelos: [], error: e.message }) })
  }, [enabled, vueloId])

  return state
}
