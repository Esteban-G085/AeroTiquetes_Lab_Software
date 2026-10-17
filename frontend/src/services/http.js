import axios from 'axios'
import { env } from '@/config/env'
import { tokenStorage } from './tokenStorage'
import { toApiError } from './apiError'

/** Única instancia de Axios de la app. Todos los clientes de API (los api.js de cada feature) la usan. */
export const http = axios.create({ baseURL: env.apiUrl, timeout: 15000 })

// El AuthContext registra aquí qué hacer cuando la sesión deja de ser válida.
let onUnauthorized = null
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

http.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = toApiError(error)
    // 401 CON token enviado = sesión vencida/revocada. Un 401 sin token (ej. contraseña
    // incorrecta en el login) NO cierra nada: es un error normal del formulario.
    const hadToken = Boolean(error.config?.headers?.Authorization)
    if (apiError.status === 401 && hadToken) onUnauthorized?.()
    return Promise.reject(apiError)
  },
)
