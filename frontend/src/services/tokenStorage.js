// sessionStorage: la sesión muere al cerrar la pestaña (coherente con el cierre por inactividad)
// y el token no queda persistido en disco como en localStorage.
const TOKEN_KEY = 'at.token'
const USER_KEY = 'at.user'

const safe = (fn, fallback = null) => { try { return fn() } catch { return fallback } }

export const tokenStorage = {
  get: () => safe(() => sessionStorage.getItem(TOKEN_KEY)),
  getUser: () => safe(() => JSON.parse(sessionStorage.getItem(USER_KEY))),
  set(token, user) {
    safe(() => {
      sessionStorage.setItem(TOKEN_KEY, token)
      sessionStorage.setItem(USER_KEY, JSON.stringify(user ?? {}))
    })
  },
  clear() {
    safe(() => { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(USER_KEY) })
  },
}
