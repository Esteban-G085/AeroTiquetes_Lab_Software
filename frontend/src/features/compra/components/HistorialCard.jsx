import { Badge, Button } from '@/components/ui'
import { formatPrice, formatRemaining } from '@/utils/format'
import { ESTADOS_COMPRA, ESTADOS_RESERVA, claseLabel, msRestantesReserva, puedeCancelarCompra } from '../rules'
import { TramoLinea } from './ResumenViaje'

/**
 * Una compra o una reserva del historial (un vuelo con sus tiquetes). Solo presenta y avisa qué se quiere hacer:
 * las llamadas a la API las hace la página.
 *   kind: 'compra' | 'reserva'     now: ms (reloj de la página, para la cuenta regresiva)
 */
export default function HistorialCard({ kind, item, now, onCancelar, onPagar, onDetalle }) {
  const esCompra = kind === 'compra'
  const restante = !esCompra ? msRestantesReserva(item.expira_en, now) : null
  // Una reserva "activa" cuyo plazo ya pasó se muestra como vencida aunque el servidor aún no la haya liberado
  const estadoKey = !esCompra && item.estado === 'activa' && restante <= 0 ? 'vencida' : item.estado
  const estado = (esCompra ? ESTADOS_COMPRA : ESTADOS_RESERVA)[estadoKey] ?? { tone: 'neutral', label: item.estado }
  const activa = esCompra ? item.estado === 'confirmada' : estadoKey === 'activa'
  const cancelable = esCompra ? (item.puede_cancelar ?? puedeCancelarCompra(item.vuelo.salida, now)) : restante > 0

  return (
    <article className="co-hist at-card" aria-label={`${esCompra ? 'Compra' : 'Reserva'} ${item.vuelo.codigo}`}>
      <header className="co-hist__head">
        <TramoLinea tramo={item.tramo} vuelo={item.vuelo} />
        <Badge tone={estado.tone}>{estado.label}</Badge>
      </header>

      <p className="co-hist__meta">
        Clase {claseLabel(item.clase).toLowerCase()} · {formatPrice(item.total ?? item.vuelo.precio * item.tiquetes.length, item.vuelo.moneda)}
        {!esCompra && activa && <> · <strong>Vence en {formatRemaining(restante)}</strong></>}
        {esCompra && item.estado === 'cancelada' && item.reintegro != null && <> · Reintegrado {formatPrice(item.reintegro)}</>}
      </p>

      <ul className="co-hist__tickets">
        {item.tiquetes.map((t) => (
          <li key={t.id} className="co-hist__ticket">
            <span className="co-hist__who">{t.viajero.nombres} {t.viajero.apellidos}</span>
            <span className="at-mono co-hist__code">{t.codigo_reserva}</span>
            {t.silla ? <span className="co-hist__seat">Silla {t.silla}</span> : null}
            <span className="co-hist__tools">
              <Button variant="ghost" size="sm" aria-label={`Ver detalle del tiquete ${t.codigo_reserva}`} onClick={() => onDetalle(item, t)}>Ver detalle</Button>
            </span>
          </li>
        ))}
      </ul>

      {activa && (
        <footer className="co-hist__foot">
          {!esCompra && <Button size="sm" onClick={() => onPagar(item)}>Pagar reserva</Button>}
          {cancelable
            ? <Button variant="danger" size="sm" onClick={() => onCancelar(item)}>{esCompra ? 'Cancelar compra' : 'Cancelar reserva'}</Button>
            : esCompra && <span className="co-hist__note">Ya no se puede cancelar: el límite es 1 hora antes de la salida.</span>}
        </footer>
      )}
    </article>
  )
}
