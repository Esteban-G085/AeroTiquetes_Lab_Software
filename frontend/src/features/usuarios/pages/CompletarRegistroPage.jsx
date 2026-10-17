import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Icon } from '@/components/ui'
import { SkyArt } from '@/components/brand'
import { LoadingState, useToast } from '@/components/feedback'
import { ApiError } from '@/services/apiError'
import { useAsyncData } from '@/utils/useAsyncData'
import RegistroForm from '../components/RegistroForm'
import { completarRegistro, validarInvitacion } from '../api'
import '../usuarios.css'

// Códigos con los que el backend indica que el enlace ya no sirve (venció a las 48 h, ya se usó o no existe)
const LINK_DEAD = [400, 404, 410]

/** HU23 / D6 — Primer ingreso del administrador: llega desde el enlace del correo (?token=…). */
export default function CompletarRegistroPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()
  const toast = useToast()

  const { status, data: invitacion, error, reload } = useAsyncData(() => (
    token
      ? validarInvitacion(token)
      : Promise.reject(new ApiError({ status: 400, code: 'TOKEN_FALTANTE', message: 'Falta el código del enlace.' }))
  ))

  async function handleSubmit({ values, imagen }) {
    await completarRegistro(token, values, imagen)
    toast.success('Registro completado. Ya puedes iniciar sesión.')
    navigate('/login', { replace: true })
  }

  if (status === 'loading') {
    return (
      <div className="us-reg at-sky at-sky--fixed">
        <SkyArt />
        <div className="us-reg__card us-reg__card--narrow"><LoadingState label="Validando tu enlace…" /></div>
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
          <h1 className="us-reg__title">{dead ? 'Enlace no válido' : 'No pudimos validar tu enlace'}</h1>
          <p className="us-reg__msg">
            {dead
              ? 'Este enlace venció o ya fue utilizado. Pide al administrador principal que te envíe una nueva invitación.'
              : error?.message}
          </p>
          <div className="us-reg__actions">
            {!dead && <Button onClick={reload}>Reintentar</Button>}
            <Link to="/login" className="btn btn-outline-primary">Ir a iniciar sesión</Link>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="us-reg at-sky at-sky--fixed">
      <SkyArt />
      <RegistroForm
        title="Completar registro"
        subtitle="Completa tus datos de administrador"
        submitLabel="Completar registro"
        initialValues={{ correo: invitacion.correo, nombres: invitacion.nombre ?? '' }}
        readOnlyFields={['correo']}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
