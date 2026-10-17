import { Link } from 'react-router-dom'
import { EstadoBadge } from '@/components/travel'
import { TIPO_LABEL } from '@/domain/estados'
import { formatDateShort, formatDuration, formatPrice, formatTime } from '@/utils/format'

/** Tabla de vuelos programados del panel (HU19). Solo presenta; los filtros y la carga son de la página. */
export default function VuelosTable({ vuelos = [] }) {
  return (
    <div className="vu-table at-card at-card--flush">
      <table className="table align-middle mb-0">
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
              <td className="at-mono vu-table__code">{v.codigo}</td>
              <td>
                <span className="vu-table__route">
                  {v.origen?.codigo} <span aria-hidden="true">→</span> {v.destino?.codigo}
                </span>
                <span className="vu-table__cities">
                  {TIPO_LABEL[v.tipo] ?? v.tipo} · {v.origen?.nombre} · {v.destino?.nombre}
                </span>
              </td>
              <td>
                <span className="vu-table__val">{formatDateShort(v.salida_utc, v.origen?.zona_horaria)}</span>
                <span className="vu-table__cities">{formatTime(v.salida_utc, v.origen?.zona_horaria)}</span>
              </td>
              <td className="vu-table__val">{formatDuration(v.duracion_min)}</td>
              <td className="text-end vu-table__val">{formatPrice(v.costo)}</td>
              <td className="vu-table__val">{v.cupos_economica ?? 0} / {v.cupos_primera ?? 0}</td>
              <td><EstadoBadge estado={v.estado} /></td>
              <td className="text-end">
                <Link className="btn btn-sm btn-outline-primary" to={`/admin/vuelos/${v.id}`}>Consultar</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
