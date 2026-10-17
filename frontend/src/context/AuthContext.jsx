import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ROLES } from '@/config/roles'
import { env } from '@/config/env'
import { decodeJwt, getExpiryMs, isExpired } from '@/utils/jwt'
import { tokenStorage } from '@/services/tokenStorage'
import { setUnauthorizedHandler } from '@/services/http'
import * as authApi from '@/services/authApi'
import { useToast } from '@/components/feedback'
import { useIdleTimeout } from './useIdleTimeout'

const AuthContext = createContext(null)

/** Reconstruye la sesión desde sessionStorage (sobrevive a recargar la página). */
function readStoredSession() {
  const token = tokenStorage.get()
  if (!token) return null
  const payload = decodeJwt(token)
  if (!payload || isExpired(payload)) {
    tokenStorage.clear()
    return null
  }
  return { token, rol: payload.rol, expiresAt: getExpiryMs(payload), user: tokenStorage.getUser() ?? {} }
}

const EXPIRE_MESSAGES = {
  inactividad: 'Cerramos tu sesión por inactividad. Inicia sesión de nuevo.',
  expirada: 'Tu sesión expiró. Inicia sesión de nuevo.',
}

export function AuthProvider({ children }) {
  const toast = useToast()
  const [session, setSession] = useState(readStoredSession)

  /** Refresca datos mostrables (nombre) tras editar el perfil, sin volver a iniciar sesión. */
  const updateUser = useCallback((patch) => {
    setSession((s) => (s ? { ...s, user: { ...s.user, ...patch } } : s))
  }, [])

  const logout = useCallback(() => {
    tokenStorage.clear()
    setSession(null)
  }, [])

  const expire = useCallback((reason) => {
    logout()
    toast.info(EXPIRE_MESSAGES[reason] ?? EXPIRE_MESSAGES.expirada)
  }, [logout, toast])

  const login = useCallback(async (identificador, password) => {
    const { token, rol, user } = await authApi.login(identificador, password)
    const payload = decodeJwt(token)
    tokenStorage.set(token, user)
    setSession({ token, rol: payload?.rol ?? rol, expiresAt: getExpiryMs(payload), user })
    return { rol: payload?.rol ?? rol }
  }, [])

  // Persistir cambios del usuario (updateUser) para que sobrevivan a recargar
  useEffect(() => {
    if (session) tokenStorage.set(session.token, session.user)
  }, [session])

  // 401 del backend con token enviado => sesión vencida
  useEffect(() => {
    setUnauthorizedHandler(() => expire('expirada'))
    return () => setUnauthorizedHandler(null)
  }, [expire])

  // Cierre exacto cuando el JWT vence (RNF06)
  const expiresAt = session?.expiresAt
  useEffect(() => {
    if (!expiresAt) return undefined
    const timer = setTimeout(() => expire('expirada'), Math.max(expiresAt - Date.now(), 0))
    return () => clearTimeout(timer)
  }, [expiresAt, expire])

  // Cierre por inactividad en el front
  useIdleTimeout({
    enabled: Boolean(session),
    timeoutMs: env.idleMinutes * 60 * 1000,
    onTimeout: () => expire('inactividad'),
  })

  const value = useMemo(() => ({
    user: session?.user ?? null,
    rol: session?.rol ?? ROLES.VISITANTE,
    isAuthenticated: Boolean(session),
    login,
    logout,
    updateUser,
  }), [session, login, logout, updateUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
