import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input, Notice, Select } from '@/components/ui'
import { Wordmark } from '@/components/brand'
import { ApiError } from '@/services/apiError'
import FotoPerfilPicker from './FotoPerfilPicker'
import { listarCiudadesPorDepartamento, listarDepartamentos, listarPaises } from '../api'
import { departamentosParaPais } from '../catalogo'
import {
  EMPTY_PERSONAL_DATA, GENEROS, UBICACION_FACTURACION, todayISO, validateImagen, validatePersonalData,
} from '../validators'

const asList = (valor) => (Array.isArray(valor) ? valor : [])

/**
 * Formulario de datos personales.
 * Reutilizable: HU4 lo usa para el registro de cliente y F1-07 para "completar registro" del
 * administrador (con `readOnlyFields={['correo']}` y otro título/etiqueta).
 *
 * La dirección de facturación es jerárquica: país → departamento/región → ciudad, más la
 * calle. El catálogo se carga una vez y los selects se filtran en pantalla; el backend
 * vuelve a validar la cadena completa.
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
  const [catalogo, setCatalogo] = useState({ paises: [], departamentos: [], ciudades: [] })

  // Lugar de nacimiento y catálogo de facturación. Todo idempotente y en paralelo.
  useEffect(() => {
    let vigente = true
    Promise.all([
      Promise.resolve(listarPaises()),
      Promise.resolve(listarDepartamentos()),
      Promise.resolve(listarCiudadesPorDepartamento()),
    ])
      .then(([paises, departamentos, ciudades]) => {
        if (vigente) {
          setCatalogo({
            paises: asList(paises), departamentos: asList(departamentos), ciudades: asList(ciudades),
          })
        }
      })
      .catch(() => { if (vigente) setCatalogo({ paises: [], departamentos: [], ciudades: [] }) })
    return () => { vigente = false }
  }, [])

  // Selects dependientes: Colombia muestra sus departamentos; cualquier otro
  // país muestra las regiones del exterior. La ciudad siempre cuelga de la región.
  const departamentos = useMemo(
    () => departamentosParaPais(catalogo.paises, catalogo.departamentos, values.pais_facturacion),
    [catalogo, values.pais_facturacion],
  )

  const ciudades = useMemo(() => {
    const dep = catalogo.departamentos.find((d) => d.codigo === values.departamento_facturacion)
    return dep ? catalogo.ciudades.filter((c) => c.id_departamento === dep.id) : []
  }, [catalogo, values.departamento_facturacion])

  const onChange = (e) => {
    const { name, value } = e.target
    setValues((v) => {
      const next = { ...v, [name]: value }
      if (name === 'pais_facturacion') {
        next.departamento_facturacion = ''
        next.ciudad_facturacion = ''
      } else if (name === 'departamento_facturacion') {
        next.ciudad_facturacion = ''
      }
      return next
    })
    setErrors((prev) => {
      const dependientes = name === 'pais_facturacion'
        ? UBICACION_FACTURACION
        : name === 'departamento_facturacion'
          ? ['departamento_facturacion', 'ciudad_facturacion']
          : [name]
      const limpios = { ...prev }
      for (const campo of dependientes) limpios[campo] = undefined
      return limpios
    })
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
            <div className="us-reg__cell us-reg__cell--lugar_nacimiento">
              <Select
                label="Lugar de nacimiento" name="lugar_nacimiento"
                value={values.lugar_nacimiento} onChange={onChange}
                error={errors.lugar_nacimiento} placeholder="Selecciona un país"
                options={catalogo.paises.map((p) => ({ value: p.nombre, label: p.nombre }))}
              />
            </div>
            <div className="us-reg__cell us-reg__cell--genero">
              <Select
                label="Género" name="genero" value={values.genero} onChange={onChange}
                error={errors.genero} placeholder="Selecciona" options={GENEROS}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="us-reg__group">
          <legend className="us-reg__legend"><span className="us-reg__step">2</span> Dirección de facturación</legend>
          <div className="us-reg__grid">
            <div className="us-reg__cell us-reg__cell--pais_facturacion">
              <Select
                label="País de facturación" name="pais_facturacion" value={values.pais_facturacion}
                onChange={onChange} error={errors.pais_facturacion} placeholder="Selecciona un país"
                options={catalogo.paises.map((p) => ({ value: p.nombre, label: p.nombre }))}
              />
            </div>
            <div className="us-reg__cell us-reg__cell--departamento_facturacion">
              <Select
                label="Departamento / región" name="departamento_facturacion"
                value={values.departamento_facturacion} onChange={onChange}
                error={errors.departamento_facturacion}
                placeholder={values.pais_facturacion ? 'Selecciona un departamento' : 'Selecciona primero un país'}
                options={departamentos.map((d) => ({ value: d.codigo, label: d.nombre }))}
              />
            </div>
            <div className="us-reg__cell us-reg__cell--ciudad_facturacion">
              <Select
                label="Ciudad de facturación" name="ciudad_facturacion" value={values.ciudad_facturacion}
                onChange={onChange} error={errors.ciudad_facturacion}
                placeholder={values.departamento_facturacion ? 'Selecciona una ciudad' : 'Selecciona primero un departamento'}
                options={ciudades.map((c) => ({ value: c.codigo, label: c.nombre }))}
              />
            </div>
            {field('direccion_facturacion', 'Dirección de facturación', { autoComplete: 'street-address' })}
          </div>
          <p className="us-reg__hint">Elige primero el país, después el departamento o región y por último la ciudad.</p>
        </fieldset>

        <fieldset className="us-reg__group">
          <legend className="us-reg__legend"><span className="us-reg__step">3</span> Tu cuenta</legend>
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
