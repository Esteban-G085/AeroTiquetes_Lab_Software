import { Badge, Card } from '@/components/ui'
import { TIPO_LABEL } from '@/domain/estados'
import { formatDateShort, formatDateTime, formatDuration, formatPrice, formatTime, formatZone } from '@/utils/format'
import EstadoBadge from './EstadoBadge'

/**
 * Ficha de un vuelo en modo lectura (detalle público HU5 y consulta del panel HU19).
 * SOLO presenta lo que devuelve la API: no calcula cupos ni reglas (eso es del backend).
 *
 *  vuelo     : objeto del contrato (docs/CONTRATO_VUELOS.md)
 *  acciones  : nodo opcional con los botones de quien la usa (la ficha no finge ser funcional)
 *  admin     : true muestra los campos del panel (fecha de programación)
 */
export default function VueloDetalle({ vuelo, acciones, admin = false }) {
  if (!vuelo) return null

  const origen = vuelo.origen ?? {}
  const destino = vuelo.destino ?? {}
  const cuposEconomica = vuelo.cupos_economica ?? 0
  const cuposPrimera = vuelo.cupos_primera ?? 0

  return (
    <Card className="at-detail at-enter">
      <div className="at-detail__head">
        <div>
          <p className="at-detail__label">Código de vuelo</p>
          <p className="at-detail__code at-mono">{vuelo.codigo}</p>
        </div>
        <div className="at-detail__flags">
          <Badge tone="neutral">{TIPO_LABEL[vuelo.tipo] ?? vuelo.tipo}</Badge>
          <EstadoBadge estado={vuelo.estado} />
        </div>
      </div>

      <div className="at-detail__route">
        <Bloque titulo="Origen">
          <span className="at-detail__iata at-mono">{origen.codigo}</span>
          <span className="at-detail__city">{origen.nombre}{origen.pais ? `, ${origen.pais}` : ''}</span>
          <span className="at-detail__sub">
            Salida: {formatDateTime(vuelo.salida_utc, origen.zona_horaria)}
            {formatZone(vuelo.salida_utc, origen.zona_horaria) && ` (${formatZone(vuelo.salida_utc, origen.zona_horaria)})`}
          </span>
        </Bloque>

        <Bloque titulo="Destino">
          <span className="at-detail__iata at-mono">{destino.codigo}</span>
          <span className="at-detail__city">{destino.nombre}{destino.pais ? `, ${destino.pais}` : ''}</span>
          <span className="at-detail__sub">
            Llegada: {formatDateTime(vuelo.llegada_utc, destino.zona_horaria)}
            {formatZone(vuelo.llegada_utc, destino.zona_horaria) && ` (${formatZone(vuelo.llegada_utc, destino.zona_horaria)})`}
          </span>
        </Bloque>
      </div>

      <div className="at-detail__grid">
        <Dato titulo="Fecha de salida">{formatDateShort(vuelo.salida_utc, origen.zona_horaria)}</Dato>
        <Dato titulo="Hora de salida">{formatTime(vuelo.salida_utc, origen.zona_horaria)}</Dato>
        <Dato titulo="Hora de llegada (local)">{formatTime(vuelo.llegada_utc, destino.zona_horaria)}</Dato>
        <Dato titulo="Duración">{formatDuration(vuelo.duracion_min)}</Dato>
        <Dato titulo="Cupos · Económica">{cuposEconomica}</Dato>
        <Dato titulo="Cupos · Primera">{cuposPrimera}</Dato>
        <Dato titulo="Costo por persona">
          <span className="at-detail__price">{formatPrice(vuelo.costo)}</span>
        </Dato>
        {admin && (
          <Dato titulo="Programado el">{formatDateTime(vuelo.fecha_programacion, origen.zona_horaria)}</Dato>
        )}
      </div>

      {acciones && <div className="at-detail__actions">{acciones}</div>}
    </Card>
  )
}

function Bloque({ titulo, children }) {
  return (
    <div className="at-detail__block">
      <p className="at-detail__label">{titulo}</p>
      {children}
    </div>
  )
}

function Dato({ titulo, children }) {
  return (
    <div className="at-detail__item">
      <p className="at-detail__label">{titulo}</p>
      <p className="at-detail__value">{children}</p>
    </div>
  )
}
