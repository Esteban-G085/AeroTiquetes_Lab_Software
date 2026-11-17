import { useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { useToast } from '@/components/feedback'
import { BackLink, PageHeader } from '@/components/layout'
import { ConfirmDialog } from '@/components/ui'
import useVueloAdmin from '../hooks/useVueloAdmin'
import { MOTIVO_MIN, evaluarCancelacion, validarMotivo } from '../rules'
import { cancelarVuelo } from '../api'
import '../vuelos.css'

/** HU13 — Cancelar un vuelo programado (solo administrador). */
export default function CancelarVueloPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [motivo, setMotivo] = useState('')
  const [errorMotivo, setErrorMotivo] = useState('')
  const [confirmar, setConfirmar] = useState({ open: false, loading: false })
  const { vuelo, status, error, recargar } = useVueloAdmin(id)

  const volver = <BackLink to="/admin/vuelos">Volver al panel</BackLink>

  if (status === 'loading') {
    return (
      <div className="vu-page">
        {volver}
        <div className="at-skeleton" />
      </div>
    )
  }

  if (status === 'error') {
    if (error?.status === 404) {
      return (
        <div className="vu-page">
          {volver}
          <div className="at-card at-card--empty">
            <p>Vuelo no encontrado</p>
            <p>El vuelo consultado no existe o fue retirado del sistema.</p>
          </div>
        </div>
      )
    }
    return (
      <div className="vu-page">
        {volver}
        <div className="at-card at-card--empty">
          <p>{error?.message ?? 'Error al cargar el vuelo.'}</p>
          <button className="btn btn-primary" onClick={recargar}>Reintentar</button>
        </div>
      </div>
    )
  }

  // Una sola regla de cancelación para el panel y esta pantalla (HU13/HU21): la aplica `rules.js`.
  const evaluacion = evaluarCancelacion(vuelo)
  const requiereMotivo = evaluacion.requiereMotivo

  if (!evaluacion.puede) {
    return (
      <div className="vu-page">
        {volver}
        <PageHeader eyebrow="Administración" title={`Vuelo ${vuelo.codigo}`} subtitle="No se puede cancelar" />
        <div className="at-card at-card--empty">
          <p>{evaluacion.motivo}</p>
        </div>
      </div>
    )
  }

  async function manejarCancelar() {
    const causa = motivo.trim()
    setErrorMotivo('')
    const problema = validarMotivo(causa, requiereMotivo)
    if (problema) {
      setErrorMotivo(problema)
      return
    }
    setConfirmar((prev) => ({ ...prev, loading: true }))
    try {
      const actualizado = await cancelarVuelo(id, causa)
      toast.success(`Vuelo ${actualizado?.codigo ?? ''} cancelado correctamente.`)
      navigate('/admin/vuelos', { replace: true })
    } catch (err) {
      toast.error(err?.message ?? 'No se pudo cancelar el vuelo.')
      if (err?.fields?.motivo) setErrorMotivo(err.fields.motivo)
      setConfirmar({ open: false, loading: false })
    }
  }

  return (
    <div className="vu-page">
      {volver}

      <PageHeader
        eyebrow="Administración"
        title={`Cancelar vuelo ${vuelo.codigo}`}
        subtitle="Al cancelar se liberan los cupos por clase y no se puede deshacer."
      />

      <div className="at-card at-card--padded">
        {requiereMotivo && (
          <div className="vu-cancelar__aviso">
            <p><strong>{vuelo.tiquetes_vendidos} tiquetes vendidos</strong> en este vuelo.</p>
            <p>Se requiere registrar una causa de fuerza mayor (mínimo {MOTIVO_MIN} caracteres).</p>
          </div>
        )}

        <label className="form-label" htmlFor="vu-motivo">
          Causa de fuerza mayor {requiereMotivo ? <span aria-hidden="true">*</span> : <span className="text-muted">(opcional)</span>}
        </label>
        <textarea
          id="vu-motivo"
          className="form-control"
          aria-invalid={Boolean(errorMotivo)}
          aria-describedby={errorMotivo ? 'vu-motivo-error' : undefined}
          placeholder={requiereMotivo ? 'Ej. Cierre del aeropuerto por tormenta' : 'Opcional'}
          value={motivo}
          onChange={(e) => { setMotivo(e.target.value); if (errorMotivo) setErrorMotivo('') }}
          rows={3}
          maxLength={300}
        />
        {errorMotivo && <p id="vu-motivo-error" role="alert" className="text-danger">{errorMotivo}</p>}

        <div className="vu-cancelar__actions mt-3">
          <button
            type="button"
            className="btn btn-outline-danger"
            disabled={confirmar.loading || Boolean(validarMotivo(motivo, requiereMotivo))}
            onClick={() => setConfirmar({ open: true, loading: false })}
          >
            Cancelar vuelo
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmar.open}
        title={`Cancelar vuelo ${vuelo.codigo}`}
        message="¿Estás seguro de que deseas cancelar este vuelo? Se liberarán los cupos por clase y no se puede deshacer."
        confirmLabel="Sí, cancelar vuelo"
        cancelLabel="No, mantener"
        danger
        loading={confirmar.loading}
        onConfirm={manejarCancelar}
        onCancel={() => setConfirmar({ open: false, loading: false })}
      />
    </div>
  )
}
