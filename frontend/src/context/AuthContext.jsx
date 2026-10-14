import { createContext, useCallback, useContext, useMemo, useState } from 'react'

// ---------------------------------------------------------------------------
// Contexto de sesión mínimo.
// NOTA: el módulo de Usuarios (F1) es dueño del flujo real de autenticación.
// Aquí se expone lo mínimo que necesitan las rutas protegidas por rol de F2
// (panel de administración de vuelos). F1 puede extenderlo sin romper nada.
// ---------------------------------------------------------------------------

const AuthContext = createContext(null)

const SESION_KEY = 'aerotiquetes.session'
const TOKEN_KEY = 'aerotiquetes.token'

function leerSesionInicial() {
  try {
    const raw = localStorage.getItem(SESION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(leerSesionInicial)

  const iniciarSesion = useCallback(({ usuario, token }) => {
    localStorage.setItem(SESION_KEY, JSON.stringify(usuario))
    if (token) localStorage.setItem(TOKEN_KEY, token)
    setSesion(usuario)
  }, [])

  const cerrarSesion = useCallback(() => {
    localStorage.removeItem(SESION_KEY)
    localStorage.removeItem(TOKEN_KEY)
    setSesion(null)
  }, [])

  const valor = useMemo(
    () => ({
      usuario: sesion,
      autenticado: Boolean(sesion),
      rol: sesion?.rol ?? 'visitante',
      iniciarSesion,
      cerrarSesion,
      tieneRol: (...roles) => Boolean(sesion && roles.includes(sesion.rol)),
    }),
    [sesion, iniciarSesion, cerrarSesion],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
