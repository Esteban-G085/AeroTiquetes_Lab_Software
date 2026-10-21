// Única puerta de entrada a las variables de entorno.
// Nadie más debería leer import.meta.env directamente.
export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  // Inactividad (RNF06). Debe ser <= a JWT_EXPIRE_MINUTES del backend (30).
  idleMinutes: Number(import.meta.env.VITE_IDLE_MINUTES) || 30,
  isDev: import.meta.env.DEV,
}
