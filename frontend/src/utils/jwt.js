/** Decodifica el payload de un JWT (NO verifica la firma: eso lo hace el backend). */
export function decodeJwt(token) {
  try {
    const part = token.split('.')[1]
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

/** `exp` viene en segundos (estándar JWT). */
export const getExpiryMs = (payload) => (payload?.exp ? payload.exp * 1000 : null)

export function isExpired(payload, now = Date.now()) {
  const exp = getExpiryMs(payload)
  return exp !== null && exp <= now
}
