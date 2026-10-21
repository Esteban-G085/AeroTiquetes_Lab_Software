import { useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Icon } from '@/components/ui'
import { SkyArt } from '@/components/brand'
import { LoadingState } from '@/components/feedback'
import { ApiError } from '@/services/apiError'
import { useAsyncData } from '@/utils/useAsyncData'
import { useAuth } from '@/context'
import { verificarCorreo } from '../api'
import '../usuarios.css'

// El backend responde 400 (token_invalido / sin_cambio_pendiente) cuando el enlace
// venció, ya se usó o no corresponde a ningún cambio pendiente.
const LINK_DEAD = [400, 404, 410]

/**
 * HU2 / D8 — Confirmación del cambio de correo: llega desde el enlace del correo NUEVO
 * (?token=…). Es pública (se abre con o sin sesión) porque el enlace puede llegar a un
 * correo distinto al de la sesión, y el backend tampoco exige token.
 */
export default function VerificarCorreoPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const { isAuthenticated } = useAuth()

  // El token es de un solo uso. En StrictMode el efecto se monta dos veces, así que sin
  // este candado se harían dos POST y el segundo fallaría con "sin cambio pendiente".
  const pending = useRef(null)

  const { status, data: perfil, error, reload } = useAsyncData(() => {
    if (!token) {
      return Promise.reject(new ApiError({ status: 400, code: 'TOKEN_FALTANTE', message: 'Falta el código del enlace.' }))
    }
    if (!pending.current) {
      pending.current = verificarCorreo(token).catch((e) => {
        pending.current = null // el reintento tiene que hacer una petición nueva
        throw e
      })
    }
    return pending.current
  })

  const destino = isAuthenticated ? '/perfil' : '/login'
  const etiquetaDestino = isAuthenticated ? 'Ir a mi perfil' : 'Ir a iniciar sesión'

  if (status === 'loading') {
    return (
      <div className="us-reg at-sky at-sky--fixed">
        <SkyArt />
        <div className="us-reg__card us-reg__card--narrow"><LoadingState label="Confirmando tu correo…" /></div>
      </div>
    )
  }

  if (status === 'error') {
    const dead = LINK_DEAD.includes(error?.status)
    return (
      <div className="us-reg at-sky at-sky--fixed">
        <SkyArt />
        <section className="us-reg__card us-reg__card--narrow" role="alert">
          <span className="us-reg__alerticon"><Icon name="alert" size={28} /></span>
          <h1 className="us-reg__title">{dead ? 'Enlace no válido' : 'No pudimos confirmar tu correo'}</h1>
          <p className="us-reg__msg">
            {dead
              ? 'Este enlace venció o ya fue utilizado. Vuelve a solicitar el cambio de correo desde tu perfil.'
              : error?.message}
          </p>
          <div className="us-reg__actions">
            {!dead && <Button onClick={reload}>Reintentar</Button>}
            <Link to={destino} className="btn btn-outline-primary">{etiquetaDestino}</Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="us-reg at-sky at-sky--fixed">
      <SkyArt />
      <section className="us-reg__card us-reg__card--narrow">
        <span className="us-reg__alerticon us-reg__alerticon--success"><Icon name="check" size={28} /></span>
        <h1 className="us-reg__title">Correo verificado</h1>
        <p className="us-reg__msg">
          Tu correo ahora es <strong>{perfil?.correo}</strong>. Ya puedes iniciar sesión con él.
        </p>
        <div className="us-reg__actions">
          <Link to={destino} className="btn btn-outline-primary">{etiquetaDestino}</Link>
        </div>
      </section>
    </div>
  )
}
