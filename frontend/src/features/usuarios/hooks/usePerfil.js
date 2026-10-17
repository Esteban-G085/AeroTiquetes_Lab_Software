import { useAsyncData } from '@/utils/useAsyncData'
import { obtenerPerfil } from '../api'

/** Perfil propio (GET /me): { status, perfil, error, reload, refresh }. */
export function usePerfil() {
  const { data, ...rest } = useAsyncData(obtenerPerfil)
  return { perfil: data, ...rest }
}
