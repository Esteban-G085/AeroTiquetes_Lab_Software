import { setupWorker } from 'msw/browser'
import { handlers } from './handlers.js'

export const worker = setupWorker(...handlers)

/** Arranca MSW solo si está habilitado por entorno. */
export async function iniciarMocks() {
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
  })
}
