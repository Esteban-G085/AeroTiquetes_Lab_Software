import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EmptyState } from '@/components/feedback'
import { Notice } from '@/components/ui'
import { PageHeader } from '@/components/layout'
import { cancelarConToken } from '../api'
import '../noticias.css'

/** HU11 — Página pública: cancelar suscripción desde el enlace del correo.
 * Se abre con /cancelar-suscripcion?token=… y llama a
 * POST /noticias/suscripcion/cancelar con el token (sin sesión).
 */
export default function CancelarSuscripcionPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('idle') // idle | saving | success | error
  const [error, setError] = useState(null)

  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('No se recibió un enlace de cancelación válido.')
      return
    }
    setStatus('saving')
    cancelarConToken(token)
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error')
        setError(err?.message ?? 'No se pudo cancelar la suscripción.')
      })
  }, [token])

  return (
    <div className="not-page">
      <PageHeader
        eyebrow="Noticias"
        title="Cancelar suscripción"
        subtitle="Gestión de tu suscripción a las noticias de AeroTiquetes."
      />

      {status === 'saving' && (
        <div className="at-card at-card--padded">
          <p>Procesando tu solicitud…</p>
        </div>
      )}

      {status === 'success' && (
        <div className="at-card at-card--padded">
          <Notice tone="success" className="mb-3">
            ✓ Tu suscripción a las noticias ha sido cancelada.
          </Notice>
          <p>Ya no recibirás correos con noticias de nuevos vuelos. Si cambias de opinión, puedes volver a suscribirte desde tu panel de cliente.</p>
        </div>
      )}

      {status === 'error' && (
        <EmptyState
          title="No se pudo cancelar la suscripción"
          message={error?.message ?? 'El enlace de cancelación no es válido o ya se usó.'}
        />
      )}
    </div>
  )
}
