import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Input, Notice, Select, Skeleton } from '@/components/ui'
import { EmptyState, ErrorState, useToast } from '@/components/feedback'
import { PageHeader } from '@/components/layout'
import { formatDateTime } from '@/utils/format'
import { useAsyncData } from '@/utils/useAsyncData'
import { editarVuelo, listarCiudades, obtenerVuelo } from '../api'
import { estadoVuelo, evaluarEdicion, validarVuelo, valoresDesdeVuelo } from '../rules'
import '../vuelos.css'

const cargar = async (id) => {
  const [vuelo, ciudades] = await Promise.all([obtenerVuelo(id), listarCiudades()])
  return { vuelo, ciudades }
}

function Formulario({ vuelo, ciudades }) {
  const navigate = useNavigate()
  const toast = useToast()
  const formRef = useRef(null)
  const ev = evaluarEdicion(vuelo)
  const [values, setValues] = useState(() => valoresDesdeVuelo(vuelo))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const estado = estadoVuelo(vuelo.estado)

  // El vuelo actual siempre debe poder elegirse, aunque /ciudades no lo traiga
  const opciones = [vuelo.origen, vuelo.destino, ...ciudades.map((c) => ({ codigo: c.codigo, ciudad: c.ciudad }))]
    .filter((c, i, l) => l.findIndex((x) => x.codigo === c.codigo) === i)
    .map((c) => ({ value: c.codigo, label: `${c.ciudad} (${c.codigo})` }))

  const onChange = (e) => {
    const { name, value } = e.target
    setValues((v) => ({ ...v, [name]: value }))
    setErrors((p) => (p[name] ? { ...p, [name]: undefined } : p))
  }

  async function submit(e) {
    e.preventDefault()
    const found = validarVuelo(values)
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus())
      return
    }
    setSaving(true)
    try {
      await editarVuelo(vuelo.id, values)
      toast.success(`Actualizamos el vuelo ${vuelo.codigo}.`)
      navigate('/admin/vuelos')
    } catch (err) {
      const known = Object.fromEntries(Object.entries(err.fields ?? {}).filter(([k]) => k in values))
      setErrors(known)
      setFormError(Object.keys(known).length ? '' : err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="vu-page vu-narrow">
      <PageHeader eyebrow="Administración" title={`Editar vuelo ${vuelo.codigo}`}
        subtitle={`${vuelo.origen.ciudad} a ${vuelo.destino.ciudad} · sale ${formatDateTime(vuelo.salida, vuelo.salida_zona)}`}
        actions={<Link to="/admin/vuelos" className="btn btn-ghost">Volver</Link>} />

      <form ref={formRef} className="at-card vu-form vu-gestion" onSubmit={submit} noValidate aria-label="Editar vuelo">
        <p className="vu-form__state">Estado actual: <Badge tone={estado.tone}>{estado.label}</Badge></p>
        {!ev.puede && <Notice tone="warning" className="mb-3">{ev.motivo}</Notice>}
        {formError && <Notice tone="danger" className="mb-3">{formError}</Notice>}

        <fieldset disabled={!ev.puede || saving} className="vu-form__fields">
          <div className="vu-form__grid">
            <Input label="Fecha de salida" name="fecha" type="date" value={values.fecha} onChange={onChange} error={errors.fecha} />
            <Input label="Hora de salida" name="hora" type="time" value={values.hora} onChange={onChange} error={errors.hora}
              hint="Hora de Colombia." />
            <Select label="Origen" name="origen" placeholder="Selecciona" options={opciones} value={values.origen} onChange={onChange} error={errors.origen} />
            <Select label="Destino" name="destino" placeholder="Selecciona" options={opciones} value={values.destino} onChange={onChange} error={errors.destino} />
            <Input label="Duración (minutos)" name="duracion_min" inputMode="numeric" value={values.duracion_min} onChange={onChange} error={errors.duracion_min} />
            <Input label="Costo por persona (COP)" name="precio" inputMode="numeric" value={values.precio} onChange={onChange} error={errors.precio}
              hint="Valor único, sin distinción por clase." />
          </div>
        </fieldset>

        <div className="vu-form__actions">
          <Link to="/admin/vuelos" className="btn btn-outline-secondary">Cancelar</Link>
          <Button type="submit" loading={saving} disabled={!ev.puede}>Guardar cambios</Button>
        </div>
      </form>
    </div>
  )
}

/** HU12 — Editar vuelo: fecha, hora, origen, destino, duración y costo (solo si no ha sucedido y no tiene tiquetes vendidos). */
export default function EditarVueloPage() {
  const { id } = useParams()
  return <Cargador key={id} id={id} />
}

function Cargador({ id }) {
  const { status, data, error, reload } = useAsyncData(() => cargar(id))
  if (status === 'loading') return <div role="status" aria-label="Cargando el vuelo" className="vu-narrow d-grid gap-3"><Skeleton height="2.5rem" width="60%" /><Skeleton height="18rem" /></div>
  if (status === 'error') {
    return error?.status === 404
      ? <EmptyState icon="plane" title="No encontramos este vuelo" action={<Link to="/admin/vuelos" className="btn btn-primary">Volver a los vuelos</Link>} />
      : <ErrorState message={error?.message} onRetry={reload} />
  }
  return <Formulario vuelo={data.vuelo} ciudades={data.ciudades} />
}
