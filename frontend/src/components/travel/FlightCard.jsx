import { Icon } from '@/components/ui'
import { dayOffset, formatDay, formatDuration, formatPrice, formatTime, minutesBetween } from '@/utils/format'

/**
 * Tarjeta de vuelo para listas de resultados y comparación. SOLO presenta: no busca, no compra y no
 * inventa datos. Quien la usa (F2) le pasa lo que devuelva la API.
 *
 *  origen / destino : { ciudad, codigo }          p. ej. { ciudad: 'Bogotá', codigo: 'BOG' }
 *  salida / llegada : instantes ISO con zona      p. ej. '2026-11-10T22:10:00-05:00'
 *  salidaZona / llegadaZona : zona IANA del aeropuerto ('America/Bogota'); las horas se muestran en ELLA,
 *                     así la llegada se ve en la hora local del destino (criterio de la HU5).
 *  duracionMin      : opcional; si falta se calcula con salida y llegada.
 *  etiqueta         : texto SOLO si hay un criterio real que lo respalde ("Más barato de esta búsqueda").
 *                     Sin etiqueta no se dibuja nada: nunca se inventan insignias.
 *  detalles         : condiciones y restricciones (equipaje, cambios, costos adicionales) visibles en la tarjeta.
 *  action           : el botón de acción lo pone quien usa la tarjeta (así la tarjeta no finge ser funcional).
 */
export default function FlightCard({
  codigo, aerolinea, origen, destino, salida, llegada, salidaZona, llegadaZona,
  duracionMin, escalas = 0, precio, moneda = 'COP', etiqueta, disponibilidad, detalles, action,
}) {
  const minutos = duracionMin ?? minutesBetween(salida, llegada)
  const dias = dayOffset(salida, salidaZona, llegada, llegadaZona)
  const escalasTxt = escalas === 0 ? 'Directo' : `${escalas} escala${escalas > 1 ? 's' : ''}`

  return (
    <article className="at-flight" aria-label={`Vuelo ${codigo}: ${origen.ciudad} a ${destino.ciudad}`}>
      {etiqueta && <span className="at-flight__tag">{etiqueta}</span>}

      <div className="at-flight__main">
        <header className="at-flight__meta">
          <span className="at-flight__code at-mono">{codigo}</span>
          {aerolinea && <span className="at-flight__airline">{aerolinea}</span>}
        </header>

        <div className="at-flight__route">
          <div className="at-flight__stop">
            <time className="at-flight__time" dateTime={salida}>{formatTime(salida, salidaZona)}</time>
            <span className="at-flight__city">{origen.ciudad}{origen.codigo && <span className="at-flight__iata at-mono"> {origen.codigo}</span>}</span>
            <span className="at-flight__day">{formatDay(salida, salidaZona)}</span>
          </div>

          <div className="at-flight__path" aria-hidden="true">
            <span className="at-flight__duration"><Icon name="clock" size={14} /> {formatDuration(minutos)}</span>
            <span className="at-flight__line"><Icon name="plane" size={16} className="at-flight__plane" /></span>
            <span className="at-flight__stops">{escalasTxt}</span>
          </div>

          <div className="at-flight__stop at-flight__stop--end">
            <time className="at-flight__time" dateTime={llegada}>
              {formatTime(llegada, llegadaZona)}
              {dias > 0 && <sup className="at-flight__plus" title="Llegada al día siguiente">+{dias}</sup>}
            </time>
            <span className="at-flight__city">{destino.ciudad}{destino.codigo && <span className="at-flight__iata at-mono"> {destino.codigo}</span>}</span>
            <span className="at-flight__day">{formatDay(llegada, llegadaZona)} · hora local</span>
          </div>
        </div>

        {/* El texto accesible resume el recorrido, porque el trazo visual es decorativo */}
        <p className="visually-hidden">{`${escalasTxt}, duración ${formatDuration(minutos)}.`}</p>

        {detalles && <div className="at-flight__details">{detalles}</div>}
      </div>

      <aside className="at-flight__buy">
        <div className="at-flight__price">
          <span className="at-flight__from">Precio</span>
          <strong className="at-flight__amount">{formatPrice(precio, moneda)}</strong>
          <span className="at-flight__note">por persona</span>
        </div>
        {disponibilidad && <span className="at-flight__avail">{disponibilidad}</span>}
        {action}
      </aside>
    </article>
  )
}
