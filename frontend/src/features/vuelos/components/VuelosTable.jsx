import { Link } from 'react-router-dom'
import EstadoBadge from '../../../components/ui/EstadoBadge.jsx'
import { formatFechaCorta, formatHora, formatDuracion } from '../../../utils/fecha.js'
import { formatCOP } from '../../../utils/moneda.js'
import { precioConPromocion } from '../../../domain/vuelo.js'
import { TIPO_LABEL } from '../../../domain/estados.js'

export default function VuelosTable({ vuelos }) {
  return (
    <div className="table-responsive at-card">
      <table className="table table-hover align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>Código</th>
            <th>Ruta</th>
            <th>Salida</th>
            <th>Llegada</th>
            <th>Duración</th>
            <th className="text-end">Precio</th>
            <th>Cupos (Econ./Prim.)</th>
            <th>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {vuelos.map((v) => {
            const { final, tienePromocion, porcentaje } = precioConPromocion(v)
            return (
              <tr key={v.id ?? v.codigo}>
                <td className="titulo-mono">{v.codigo}</td>
                <td>
                  <div className="at-ruta">{v.origen?.codigo} → {v.destino?.codigo}</div>
                  <div className="texto-suave small">{TIPO_LABEL[v.tipo] ?? v.tipo}</div>
                </td>
                <td>
                  <div>{formatFechaCorta(v.fecha_hora_salida, v.origen?.zona_horaria)}</div>
                  <div className="texto-suave small">{formatHora(v.fecha_hora_salida, v.origen?.zona_horaria)}</div>
                </td>
                <td>
                  <div>{formatFechaCorta(v.fecha_hora_llegada, v.destino?.zona_horaria)}</div>
                  <div className="texto-suave small">{formatHora(v.fecha_hora_llegada, v.destino?.zona_horaria)}</div>
                </td>
                <td>{formatDuracion(v.duracion_min)}</td>
                <td className="text-end">
                  {tienePromocion && <div className="badge text-bg-success me-1">-{porcentaje}%</div>}
                  <span className="at-precio">{formatCOP(final)}</span>
                </td>
                <td>{v.cupos?.economica ?? 0} / {v.cupos?.primera ?? 0}</td>
                <td><EstadoBadge estado={v.estado} /></td>
                <td className="text-end">
                  <Link className="btn btn-sm btn-outline-primary" to={`/admin/vuelos/${v.id}`}>
                    Ver
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
