import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Carga datos al montar con estados: 'loading' | 'ready' | 'error'.
 *  - reload():  vuelve a cargar mostrando "cargando"
 *  - refresh(): vuelve a cargar sin parpadeo (tras crear/eliminar); un fallo silencioso conserva lo que había
 * `fetcher` debe devolver una promesa; se usa siempre su última versión (no hace falta memoizarlo).
 */
export function useAsyncData(fetcher) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })
  const alive = useRef(true)
  const fetchRef = useRef(fetcher)
  useEffect(() => { fetchRef.current = fetcher })

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setState((s) => ({ ...s, status: 'loading', error: null }))
    try {
      const data = await fetchRef.current()
      if (alive.current) setState({ status: 'ready', data, error: null })
    } catch (error) {
      if (alive.current && !silent) setState({ status: 'error', data: null, error })
    }
  }, [])

  useEffect(() => {
    alive.current = true
    load()
    return () => { alive.current = false }
  }, [load])

  return { ...state, reload: load, refresh: () => load({ silent: true }) }
}
