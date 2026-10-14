import axios from 'axios'
import { API_URL } from '../config/env'

// Instancia única de Axios para todo el frontend.
// El token JWT (lo administra el módulo Usuarios / F1) se adjunta automáticamente.
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

const TOKEN_KEY = 'aerotiquetes.token'

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api
