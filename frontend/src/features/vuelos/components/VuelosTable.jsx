import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '@/components/feedback'
import { EstadoBadge } from '@/components/travel'
import { ConfirmDialog } from '@/components/ui'
import { TIPO_LABEL } from '@/domain/estados'
import { formatDateShort, formatDuration, formatPrice, formatTime } from '@/utils/format'
import { cancelarVuelo } from '../api'

/**
 * Tabla de vuelos programados del panel (HU19). Solo presenta; los filtros y la carga son de la página.
 * Usa la tabla compartida (.at-table, en styles/components.css): con scroll en pantallas medianas
 * y una tarjeta por fila en móvil, donde cada celda se rotula con su data-label.
 */
export default function VuelosTable({ vuelos = [] }) {
  const toast = useToast()
  const [cancelar, setCancelar] = useState({ open: false, id: null, loading: false })

  async function confirmarCancelar(id) {
    setCancelar((prev) => ({ ...prev, loading: true }))
    try {
      const actualizado = await cancelarVuelo(id)
      toast.success(`Vuelo ${actualizado?.codigo ?? id} cancelado correctamente.`)
      setCancelar({ open: false, id: null, loading: false })
    } catch (err) {
      toast.error(err?.message ?? 'No se pudo cancelar el vuelo.')
      setCancelar((prev) => ({ ...prev, loading: false }))
    }
  }

  return (
    <div className="at-table at-table--cards at-card at-card--flush">
      <div className="at-table__scroll">
        <table>
          <caption className="visually-hidden">Vuelos programados</caption>
          <thead>
            <tr>
              <th scope="col">Código</th>
              <th scope="col">Ruta</th>
              <th scope="col">Salida</th>
              <th scope="col">Duración</th>
              <th scope="col" className="text-end">Costo</th>
              <th scope="col">Cupos (Econ./Prim.)</th>
              <th scope="col">Estado</th>
              <th scope="col"><span className="visually-hidden">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {vuelos.map((v) => (
              <tr key={v.id ?? v.codigo}>
                <td className="at-mono vu-table__code" data-label="Código">{v.codigo}</td>
                <td data-label="Ruta">
                  <span className="vu-table__cell">
                    <span className="vu-table__route">
                      {v.origen?.codigo} <span aria-hidden="true">→</span> {v.destino?.codigo}
                    </span>
                    <span className="vu-table__cities">
                      {TIPO_LABEL[v.tipo] ?? v.tipo} · {v.origen?.nombre} · {v.destino?.nombre}
                    </span>
                  </span>
                </td>
                <td data-label="Salida">
                  <span className="vu-table__cell">
                    <span className="vu-table__val">{formatDateShort(v.salida_utc, v.origen?.zona_horaria)}</span>
                    <span className="vu-table__cities">{formatTime(v.salida_utc, v.origen?.zona_horaria)}</span>
                  </span>
                </td>
                <td className="vu-table__val" data-label="Duración">{formatDuration(v.duracion_min)}</td>
                <td className="text-end vu-table__val" data-label="Costo">{formatPrice(v.costo)}</td>
                <td className="vu-table__val" data-label="Cupos">{v.cupos_economica ?? 0} / {v.cupos_primera ?? 0}</td>
                <td data-label="Estado"><EstadoBadge estado={v.estado} /></td>
                <td className="text-end" data-label="">
                  <Link className="btn btn-sm btn-outline-primary" to={`/admin/vuelos/${v.id}`}>Consultar</Link>
                  {v.estado === 'programado' && (
                    <>
                      <Link className="btn btn-sm btn-outline-secondary ms-1" to={`/admin/vuelos/${v.id}/editar`}>Editar</Link>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger ms-1"
                        onClick={() => setCancelar({ open: true, id: v.id, loading: false })}
                        disabled={cancelar.loading}
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={cancelar.open}
        title={`Cancelar vuelo ${vuelos.find((v) => v.id === cancelar.id)?.codigo ?? ''}`.trim() || 'Cancelar vuelo'}
        message="¿Estás seguro de que deseas cancelar este vuelo? Se liberarán los cupos por clase."
        confirmLabel="Cancelar vuelo"
        cancelLabel="No, mantener"
        danger
        loading={cancelar.loading}
        onConfirm={() => confirmarCancelar(cancelar.id)}
        onCancel={() => setCancelar({ open: false, id: null, loading: false })}
      />
    </div>
  )
}
