import { formatFechaHora, formatFechaCorta, formatHora, formatDuracion } from '../../utils/fecha.js'
import { formatCOP } from '../../utils/moneda.js'
import { precioConPromocion } from '../../domain/vuelo.js'
import { TIPO_LABEL } from '../../domain/estados.js'
import EstadoBadge from '../ui/EstadoBadge.jsx'

function Bloque({ titulo, children }) {
  return (
    <div className="mb-3">
      <div className="texto-suave small text-uppercase">{titulo}</div>
      <div>{children}</div>
    </div>
  )
}

export default function VueloDetalle({ vuelo, acciones }) {
  if (!vuelo) return null
  const { base, final, tienePromocion, porcentaje } = precioConPromocion(vuelo)
  const cupos = vuelo.cupos ?? {}

  return (
    <div className="at-card p-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <div className="texto-suave small">Código de vuelo</div>
          <div className="titulo-mono h4 mb-0">{vuelo.codigo}</div>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <span className="badge text-bg-light border">{TIPO_LABEL[vuelo.tipo] ?? vuelo.tipo}</span>
          <EstadoBadge estado={vuelo.estado} />
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-md-6">
          <Bloque titulo="Origen">
            <div className="at-ruta fs-5">{vuelo.origen?.codigo}</div>
            <div>{vuelo.origen?.nombre}, {vuelo.origen?.pais}</div>
            <div className="texto-suave small">
              Salida: {formatFechaHora(vuelo.fecha_hora_salida, vuelo.origen?.zona_horaria)}
            </div>
          </Bloque>
        </div>

        <div className="col-12 col-md-6">
          <Bloque titulo="Destino">
            <div className="at-ruta fs-5">{vuelo.destino?.codigo}</div>
            <div>{vuelo.destino?.nombre}, {vuelo.destino?.pais}</div>
            <div className="texto-suave small">
              Llegada: {formatFechaHora(vuelo.fecha_hora_llegada, vuelo.destino?.zona_horaria)}
            </div>
          </Bloque>
        </div>

        <div className="col-6 col-md-3">
          <Bloque titulo="Fecha de salida">
            {formatFechaCorta(vuelo.fecha_hora_salida, vuelo.origen?.zona_horaria)}
          </Bloque>
        </div>

        <div className="col-6 col-md-3">
          <Bloque titulo="Hora de salida">
            {formatHora(vuelo.fecha_hora_salida, vuelo.origen?.zona_horaria)}
          </Bloque>
        </div>

        <div className="col-6 col-md-3">
          <Bloque titulo="Hora de llegada">
            {formatHora(vuelo.fecha_hora_llegada, vuelo.destino?.zona_horaria)}
          </Bloque>
        </div>

        <div className="col-6 col-md-3">
          <Bloque titulo="Duración">
            {formatDuracion(vuelo.duracion_min)}
          </Bloque>
        </div>

        <div className="col-6 col-md-3">
          <Bloque titulo="Cupos · Económica">{cupos.economica ?? '—'}</Bloque>
        </div>

        <div className="col-6 col-md-3">
          <Bloque titulo="Cupos · Primera">{cupos.primera ?? 0}</Bloque>
        </div>

        <div className="col-12 col-md-6">
          <Bloque titulo="Precio por persona (valor único)">
            {tienePromocion && (
              <div>
                <span className="badge text-bg-success">-{porcentaje}%</span>{' '}
                <span className="at-precio-tachado">{formatCOP(base)}</span>
              </div>
            )}
            <span className="at-precio fs-4">{formatCOP(final)}</span>
          </Bloque>
        </div>
      </div>

      {acciones && <div className="d-flex gap-2 mt-3">{acciones}</div>}
    </div>
  )
}
