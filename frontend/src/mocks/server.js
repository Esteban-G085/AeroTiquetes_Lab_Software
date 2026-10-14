import { setupServer } from 'msw/node'
import { handlers } from './handlers.js'

// Servidor MSW para tests (Vitest).
export const server = setupServer(...handlers)
