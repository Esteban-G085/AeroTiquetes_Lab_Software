import { Link } from 'react-router-dom'
import { EstadoBadge } from '@/components/travel'
import { TIPO_LABEL } from '@/domain/estados'
import { formatDateShort, formatDuration, formatPrice, formatTime } from '@/utils/format'

/**
 * Tabla de vuelos programados del panel (HU19). Solo presenta; los filtros y la carga son de la página.
 * Usa la tabla compartida (.at-table, en styles/components.css): con scroll en pantallas medianas
 * y una tarjeta por fila en móvil, donde cada celda se rotula con su data-label.
 */
export default function VuelosTable({ vuelos = [] }) {
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
