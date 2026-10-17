import { env } from '@/config/env'

/** Convierte la ruta de una imagen del backend (`/uploads/x.png`) en URL utilizable por <img>. */
export function resolveMediaUrl(path) {
  if (!path) return null
  if (/^(https?:|blob:|data:)/i.test(path)) return path
  return `${env.apiUrl.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`
}
