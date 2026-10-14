import { Link } from 'react-router-dom'
import { formatHora, formatFechaCorta, formatDuracion } from '../../../utils/fecha.js'
import { formatCOP } from '../../../utils/moneda.js'
import { precioConPromocion } from '../../../domain/vuelo.js'
import { TIPO_LABEL } from '../../../domain/estados.js'

export default function FlightCard({ vuelo }) {
  const { base, final, tienePromocion, porcentaje } = precioConPromocion(vuelo)
  const salida = formatHora(vuelo.fecha_hora_salida, vuelo.origen?.zona_horaria)
  const llegada = formatHora(vuelo.fecha_hora_llegada, vuelo.destino?.zona_horaria)

  return (
    <article className="at-card p-3 h-100 d-flex flex-column">
      <div className="d-flex justify-content-between align-items-start gap-2">
        <div className="at-ruta fs-5">
          <span title={vuelo.origen?.nombre}>{vuelo.origen?.codigo}</span>
          <span className="texto-suave mx-2">→</span>
          <span title={vuelo.destino?.nombre}>{vuelo.destino?.codigo}</span>
        </div>
        <span className="badge text-bg-light border">{TIPO_LABEL[vuelo.tipo] ?? vuelo.tipo}</span>
      </div>

      <div className="texto-suave small mb-2">
        {vuelo.codigo} · {vuelo.origen?.nombre} → {vuelo.destino?.nombre}
      </div>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <div>
          <div className="fw-bold fs-5">{salida}</div>
          <div className="small texto-suave">{formatFechaCorta(vuelo.fecha_hora_salida, vuelo.origen?.zona_horaria)}</div>
        </div>
        <div className="text-center px-2 flex-grow-1">
          <div className="small texto-suave">{formatDuracion(vuelo.duracion_min)}</div>
          <hr className="my-1" />
          <span className="small texto-suave">{TIPO_LABEL[vuelo.tipo]}</span>
        </div>
        <div className="text-end">
          <div className="fw-semibold">{llegada}</div>
          <div className="texto-suave small">{formatFechaCorta(vuelo.fecha_hora_llegada, vuelo.destino?.zona_horaria)}</div>
        </div>
      </div>

      <div className="mt-auto d-flex justify-content-between align-items-end">
        <div>
          {tienePromocion && (
            <div>
              <span className="badge text-bg-success">-{porcentaje}%</span>
              <span className="at-precio-tachado ms-2">{formatCOP(base)}</span>
            </div>
          )}
          <div className="at-precio fs-5">{formatCOP(final)}</div>
          <div className="texto-suave small">por persona</div>
        </div>
        <Link className="btn btn-outline-primary btn-sm" to={`/vuelos/${vuelo.id}`}>
          Ver detalle
        </Link>
      </div>
    </article>
  )
}
