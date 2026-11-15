import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, ConfirmDialog, Notice, Skeleton } from '@/components/ui'
import { EmptyState, ErrorState, useToast } from '@/components/feedback'
import { PageHeader } from '@/components/layout'
import { FlightCard, toFlightProps } from '@/components/travel'
import { useAsyncData } from '@/utils/useAsyncData'
import { cancelarVuelo, obtenerVuelo } from '../api'
import { evaluarCancelacion, validarMotivo } from '../rules'
import '../vuelos.css'

function Contenido({ vuelo }) {
  const navigate = useNavigate()
  const toast = useToast()
  const ev = evaluarCancelacion(vuelo)
  const vendidos = Number(vuelo.tiquetes_vendidos) || 0
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  const [saving, setSaving] = useState(false)

  function pedirConfirmacion(e) {
    e.preventDefault()
    const msg = validarMotivo(motivo, ev.requiereMotivo)
    setError(msg ?? '')
    if (!msg) setConfirmar(true)
  }

  async function cancelar() {
    setSaving(true); setFormError('')
    try {
      await cancelarVuelo(vuelo.id, motivo)
      toast.success(`Cancelamos el vuelo ${vuelo.codigo}, liberamos sus cupos y reintegramos los tiquetes vendidos.`)
      navigate('/admin/vuelos')
    } catch (err) {
      setConfirmar(false)
      setError(err.fields?.motivo ?? '')
      setFormError(err.fields?.motivo ? '' : err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="vu-page vu-narrow">
      <PageHeader eyebrow="Administración" title={`Cancelar vuelo ${vuelo.codigo}`}
        subtitle="El vuelo pasa a «cancelado» y se liberan sus cupos."
        actions={<Link to="/admin/vuelos" className="btn btn-ghost">Volver</Link>} />
      <FlightCard {...toFlightProps(vuelo)} />

      <form className="at-card vu-form vu-gestion mt-3" onSubmit={pedirConfirmacion} noValidate aria-label="Cancelar vuelo">
        {!ev.puede && <Notice tone="warning">{ev.motivo}</Notice>}
        {ev.puede && vendidos > 0 && (
          <Notice tone="warning" className="mb-3">
            Este vuelo ya tiene {vendidos} {vendidos === 1 ? 'tiquete vendido' : 'tiquetes vendidos'}. Solo se puede cancelar por una causa de fuerza mayor, que debes registrar aquí.
          </Notice>
        )}
        {formError && <Notice tone="danger" className="mb-3">{formError}</Notice>}

        {ev.puede && (
          <>
            <div className="at-field">
              <label htmlFor="vu-motivo" className="form-label">Causa de fuerza mayor{ev.requiereMotivo ? '' : ' (opcional)'}</label>
              <textarea id="vu-motivo" name="motivo" className={`form-control${error ? ' is-invalid' : ''}`} rows={3} maxLength={300}
                aria-invalid={error ? 'true' : undefined} aria-describedby={error ? 'vu-motivo-err' : undefined}
                value={motivo} onChange={(e) => { setMotivo(e.target.value); setError('') }} />
              {error && <div id="vu-motivo-err" role="alert" className="at-field__error">{error}</div>}
            </div>
            <div className="vu-form__actions">
              <Link to="/admin/vuelos" className="btn btn-outline-secondary">Volver sin cancelar</Link>
              <Button type="submit" variant="danger">Cancelar vuelo</Button>
            </div>
          </>
        )}
      </form>

      <ConfirmDialog open={confirmar} danger loading={saving} title="Cancelar vuelo" confirmLabel="Sí, cancelar vuelo" cancelLabel="Volver"
        message={`Vas a cancelar el vuelo ${vuelo.codigo} (${vuelo.origen.ciudad} a ${vuelo.destino.ciudad}). Se liberarán sus cupos y esta acción no se puede deshacer.`}
        onCancel={() => !saving && setConfirmar(false)} onConfirm={cancelar} />
    </div>
  )
}

/** HU13 — Cancelar un vuelo programado (sin tiquetes vendidos, o con causa de fuerza mayor registrada). */
export default function CancelarVueloPage() {
  const { id } = useParams()
  return <Cargador key={id} id={id} />
}

function Cargador({ id }) {
  const { status, data, error, reload } = useAsyncData(() => obtenerVuelo(id))
  if (status === 'loading') return <div role="status" aria-label="Cargando el vuelo" className="vu-narrow d-grid gap-3"><Skeleton height="2.5rem" width="60%" /><Skeleton height="10rem" /></div>
  if (status === 'error') {
    return error?.status === 404
      ? <EmptyState icon="plane" title="No encontramos este vuelo" action={<Link to="/admin/vuelos" className="btn btn-primary">Volver a los vuelos</Link>} />
      : <ErrorState message={error?.message} onRetry={reload} />
  }
  return <Contenido vuelo={data} />
}
