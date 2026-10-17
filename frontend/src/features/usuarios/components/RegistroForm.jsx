import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input, Notice, Select } from '@/components/ui'
import { Wordmark } from '@/components/brand'
import { ApiError } from '@/services/apiError'
import FotoPerfilPicker from './FotoPerfilPicker'
import {
  EMPTY_PERSONAL_DATA, GENEROS, todayISO, validateImagen, validatePersonalData,
} from '../validators'

/**
 * Formulario de datos personales.
 * Reutilizable: HU4 lo usa para el registro de cliente y F1-07 para "completar registro" del
 * administrador (con `readOnlyFields={['correo']}` y otro título/etiqueta).
 *
 * onSubmit({ values, imagen }) debe lanzar ApiError si el backend rechaza; sus `fields`
 * se pintan en cada campo. Cualquier otro error se muestra como aviso general.
 */
export default function RegistroForm({
  title = 'Registro',
  subtitle = 'Registrarse como cliente',
  submitLabel = 'Registrarse',
  initialValues,
  readOnlyFields = [],
  onSubmit,
  footer,
}) {
  const formRef = useRef(null)
  const [values, setValues] = useState({ ...EMPTY_PERSONAL_DATA, ...initialValues })
  const [imagen, setImagen] = useState(null)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  const onChange = (e) => {
    const { name, value } = e.target
    setValues((v) => ({ ...v, [name]: value }))
    // El error de un campo se limpia en cuanto el usuario lo corrige
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev))
  }

  const onImagen = (file) => {
    setImagen(file)
    setErrors((prev) => ({ ...prev, imagen: validateImagen(file) ?? undefined }))
  }

  const focusFirstError = () => requestAnimationFrame(() =>
    formRef.current?.querySelector('[aria-invalid="true"]')?.focus())

  async function submit(e) {
    e.preventDefault()
    const found = validatePersonalData(values, { skip: readOnlyFields })
    const imagenError = validateImagen(imagen)
    if (imagenError) found.imagen = imagenError
    setErrors(found)
    if (Object.keys(found).length) {
      setFormError('')
      focusFirstError()
      return
    }

    setFormError('')
    setLoading(true)
    try {
      await onSubmit({ values, imagen })
    } catch (err) {
      const fields = err instanceof ApiError ? err.fields : {}
      const known = Object.fromEntries(
        Object.entries(fields).filter(([k]) => k in values || k === 'imagen'),
      )
      setErrors(known)
      setFormError(Object.keys(known).length ? 'Revisa los campos marcados.' : (err.message ?? 'No se pudo completar el registro.'))
      focusFirstError()
      setLoading(false)
    }
  }

  const field = (name, label, extra = {}) => (
    <div className={`us-reg__cell us-reg__cell--${name}`}>
      <Input
        label={label} name={name} value={values[name]} onChange={onChange}
        error={errors[name]} readOnly={readOnlyFields.includes(name)} {...extra}
      />
    </div>
  )

  return (
    <section className="us-reg__card at-enter">
      <header className="us-reg__head">
        <Link to="/" className="us-reg__logo" aria-label="AeroTiquetes, ir al inicio"><Wordmark size={34} /></Link>
        <h1 className="us-reg__title">{title}</h1>
        <p className="us-reg__subtitle">{subtitle}</p>
      </header>

      <form ref={formRef} className="us-reg__form" onSubmit={submit} noValidate>
        {formError && <Notice tone="danger" className="mb-3">{formError}</Notice>}

        <fieldset className="us-reg__group">
          <legend className="us-reg__legend"><span className="us-reg__step">1</span> Tus datos</legend>
          <FotoPerfilPicker file={imagen} error={errors.imagen} onChange={onImagen} />
          <div className="us-reg__grid">
            {field('nombres', 'Nombres', { autoComplete: 'given-name' })}
            {field('apellidos', 'Apellidos', { autoComplete: 'family-name' })}
            {field('dni', 'Documento (DNI)', { inputMode: 'numeric', autoComplete: 'off' })}
            {field('fecha_nacimiento', 'Fecha de nacimiento', { type: 'date', max: todayISO(), autoComplete: 'bday' })}
            {field('lugar_nacimiento', 'Lugar de nacimiento')}
            <div className="us-reg__cell us-reg__cell--genero">
              <Select
                label="Género" name="genero" value={values.genero} onChange={onChange}
                error={errors.genero} placeholder="Selecciona" options={GENEROS}
              />
            </div>
            {field('direccion_facturacion', 'Dirección de facturación', { autoComplete: 'street-address' })}
          </div>
        </fieldset>

        <fieldset className="us-reg__group">
          <legend className="us-reg__legend"><span className="us-reg__step">2</span> Tu cuenta</legend>
          <div className="us-reg__grid">
            {field('correo', 'Correo', { type: 'email', autoComplete: 'email' })}
            {field('usuario', 'Usuario', { autoComplete: 'username' })}
            {field('password', 'Contraseña', {
              type: 'password', autoComplete: 'new-password', hint: 'Mín. 8, con letras y números',
            })}
          </div>
        </fieldset>

        <p className="us-reg__note">Todos los campos son obligatorios, salvo la foto.</p>

        <div className="us-reg__actions">
          <Button type="submit" size="lg" className="us-reg__submit" loading={loading}>{submitLabel}</Button>
          {footer}
        </div>
      </form>
    </section>
  )
}
