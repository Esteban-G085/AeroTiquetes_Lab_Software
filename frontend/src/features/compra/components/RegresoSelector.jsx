import { Icon, Notice } from '@/components/ui'
import { LoadingState } from '@/components/feedback'
import { formatDateTime, formatDuration, formatPrice } from '@/utils/format'
import { precioParaClase } from '../rules'

/**
 * Elegir el vuelo de regreso de un trayecto completo (Origen → Destino → Origen, RF20).
 * Solo presenta los vuelos que le entrega la página; no busca por su cuenta.
 * Muestra la tarifa de la clase elegida y, si difiere, la de la otra clase.
 */
export default function RegresoSelector({ status, vuelos = [], value, onChange, error, clase }) {
  if (status === 'loading') return <LoadingState label="Buscando vuelos de regreso…" />
  if (status === 'error') return <Notice tone="danger">{error ?? 'No pudimos cargar los vuelos de regreso.'}</Notice>
  if (!vuelos.length) {
    return <Notice tone="warning">No hay vuelos de regreso programados para este trayecto. Puedes comprar solo la ida.</Notice>
  }
  return (
    <fieldset className="co-regreso">
      <legend className="visually-hidden">Vuelo de regreso</legend>
      {vuelos.map((v) => {
        const checked = String(value) === String(v.id)
        return (
          <label key={v.id} className={`co-regreso__item${checked ? ' is-checked' : ''}`}>
            <input type="radio" name="vuelo_regreso" value={v.id} checked={checked} onChange={() => onChange(v)} />
            <span className="co-regreso__body">
              <span className="co-regreso__route">
                <strong>{v.origen.codigo}</strong> <Icon name="arrow-right" size={14} /> <strong>{v.destino.codigo}</strong>
                <span className="co-regreso__code at-mono">{v.codigo}</span>
              </span>
              <span className="co-regreso__when">
                {formatDateTime(v.salida, v.salida_zona)} · {formatDuration(v.duracion_min)}
              </span>
            </span>
            <span className="co-regreso__price">
              {formatPrice(precioParaClase(v, clase), v.moneda)}
              {v.precio_primera != null && v.precio_primera !== v.precio && (
                <small className="co-regreso__otra">
                  {clase === 'primera'
                    ? `Económica ${formatPrice(v.precio, v.moneda)}`
                    : `Primera ${formatPrice(v.precio_primera, v.moneda)}`}
                </small>
              )}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
