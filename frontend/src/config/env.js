// Lectura centralizada de variables de entorno de Vite.

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const USE_MOCKS = String(import.meta.env.VITE_USE_MOCKS ?? 'false') === 'true'
