import { Icon } from '@/components/ui'
import { formatDateTime, formatPrice } from '@/utils/format'
import { claseLabel, precioParaClase } from '../rules'

/** Una línea del resumen: tramo, ruta y salida (hora local del aeropuerto). */
export function TramoLinea({ tramo, vuelo }) {
  return (
    <div className="co-tramo">
      <span className="co-tramo__tag">{tramo === 'vuelta' ? 'Vuelta' : 'Ida'}</span>
      <div className="co-tramo__main">
        <strong className="co-tramo__route">
          {vuelo.origen.ciudad} <Icon name="arrow-right" size={14} /> {vuelo.destino.ciudad}
        </strong>
        <span className="co-tramo__when">
          <span className="at-mono">{vuelo.codigo}</span> · Sale {formatDateTime(vuelo.salida, vuelo.salida_zona)}
        </span>
      </div>
    </div>
  )
}

/**
 * Resumen de precio SIEMPRE visible antes de pagar (DISENO.md §5, reglas 1 y 2): cada tramo con su
 * subtotal y el total. No hay impuestos ni cargos aparte: es tarifa por persona y clase (D3, RF03).
 *  tramos: [{ tramo: 'ida' | 'vuelta', vuelo }]   viajeros: cantidad
 */
export default function ResumenViaje({ tramos, viajeros, clase, children }) {
  const total = tramos.reduce((sum, t) => sum + precioParaClase(t.vuelo, clase) * viajeros, 0)
  return (
    <section className="co-resumen at-card" aria-labelledby="co-resumen-t">
      <h2 id="co-resumen-t" className="co-resumen__title">Resumen</h2>
      {tramos.map((t) => <TramoLinea key={t.vuelo.id} {...t} />)}

      <dl className="co-resumen__lines">
        <div><dt>Clase</dt><dd>{claseLabel(clase)}</dd></div>
        <div><dt>Viajeros</dt><dd>{viajeros}</dd></div>
        {tramos.map((t) => (
          <div key={t.vuelo.id}>
            <dt>{t.tramo === 'vuelta' ? 'Vuelta' : 'Ida'} · {formatPrice(precioParaClase(t.vuelo, clase), t.vuelo.moneda)} × {viajeros}</dt>
            <dd>{formatPrice(precioParaClase(t.vuelo, clase) * viajeros, t.vuelo.moneda)}</dd>
          </div>
        ))}
      </dl>

      <div className="co-resumen__total">
        <span>Total</span>
        <strong aria-label={`Total ${formatPrice(total, tramos[0]?.vuelo.moneda)}`}>{formatPrice(total, tramos[0]?.vuelo.moneda)}</strong>
      </div>
      {children}
    </section>
  )
}
