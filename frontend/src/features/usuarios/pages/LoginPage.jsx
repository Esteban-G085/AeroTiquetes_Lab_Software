import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input, Notice } from '@/components/ui'
import { SkyArt, Wordmark } from '@/components/brand'
import { useAuth } from '@/context'
import '../usuarios.css'

// HU1: el mensaje no revela si falló el identificador o la contraseña.
const GENERIC_ERROR = 'Usuario o contraseña incorrectos.'
const CREDENTIAL_STATUSES = [400, 401, 404, 422]

export default function LoginPage() {
  const { login } = useAuth()
  const [values, setValues] = useState({ identificador: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  const onChange = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }))

  const validate = () => {
    const next = {}
    if (!values.identificador.trim()) next.identificador = 'Escribe tu usuario o correo.'
    if (!values.password) next.password = 'Escribe tu contraseña.'
    return next
  }

  async function onSubmit(e) {
    e.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return

    setFormError('')
    setLoading(true)
    try {
      // Al quedar la sesión activa, RouteGuard redirige solo (a donde iba o a su inicio).
      await login(values.identificador.trim(), values.password)
    } catch (err) {
      setFormError(CREDENTIAL_STATUSES.includes(err.status) ? GENERIC_ERROR : err.message)
      setLoading(false)
    }
  }

  return (
    <div className="us-auth">
      <aside className="us-auth__brand at-sky">
        <SkyArt />
        <Link to="/" className="us-auth__home" aria-label="AeroTiquetes, ir al inicio"><Wordmark tone="light" size={40} /></Link>
        <div className="us-auth__pitch">
          <p className="us-auth__kicker">Reservas en línea</p>
          <p className="us-auth__headline">Tu próximo viaje empieza aquí.</p>
        </div>
      </aside>

      <section className="us-auth__panel">
        <div className="us-auth__box at-enter">
          <header className="us-auth__head">
            <p className="us-auth__eyebrow">Bienvenido de nuevo</p>
            <h1 className="us-auth__title">Iniciar sesión</h1>
            <p className="us-auth__subtitle">Inicia sesión para continuar</p>
          </header>

          <form onSubmit={onSubmit} noValidate>
            {formError && <Notice tone="danger" className="mb-3">{formError}</Notice>}

            <Input
              label="Escribe tu usuario o correo electrónico" name="identificador"
              autoComplete="username" autoFocus
              value={values.identificador} onChange={onChange} error={errors.identificador}
            />
            <Input
              label="Escribe tu contraseña" name="password" type="password"
              autoComplete="current-password"
              value={values.password} onChange={onChange} error={errors.password}
            />

            <Button type="submit" size="lg" className="w-100 mt-2" loading={loading}>Iniciar sesión</Button>

            {/* "¿Olvidó su contraseña?" sale del mockup: ningún requisito lo cubre (decisión D9). */}
            <p className="us-auth__alt">
              ¿No tienes cuenta? <Link to="/registro">Regístrate</Link>
            </p>
          </form>
        </div>
      </section>
    </div>
  )
}
