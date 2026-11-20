import { Link } from 'react-router-dom'
import { Button, Icon, Notice } from '@/components/ui'
import { Stepper } from '@/components/travel'
import { formatDateTime, formatPrice } from '@/utils/format'
import { claseLabel } from '../rules'
import { TramoLinea } from './ResumenViaje'

export const PASOS = ['Viajeros', 'Carrito y pago', 'Confirmación']

function TiquetesLista({ tiquetes }) {
  return (
    <ul className="co-codes">
      {tiquetes.map((t) => (
        <li key={t.id ?? t.codigo_reserva} className="co-codes__item">
          <span className="co-codes__who">{t.viajero.nombres} {t.viajero.apellidos}</span>
          <span className="co-codes__code at-mono" aria-label={`Código de reserva ${t.codigo_reserva}`}>{t.codigo_reserva}</span>
          {t.silla ? <span className="co-codes__seat">Silla {t.silla}</span> : null}
        </li>
      ))}
    </ul>
  )
}

/** Resultado inequívoco de una compra (DISENO.md §5, regla 5): total gastado, saldo restante y códigos de reserva. */
export function CompraConfirmada({ resultado, onSeguir }) {
  const { compras = [], total, saldo, correo } = resultado
  return (
    <div className="co-done at-enter">
      <Stepper steps={PASOS} current={3} label="Progreso de la compra" />
      <section className="co-done__card at-card" aria-labelledby="co-done-t">
        <span className="co-done__icon"><Icon name="check" size={28} /></span>
        <h1 id="co-done-t" className="co-done__title">Compra confirmada</h1>
        <p className="co-done__lead">Pagaste con tu billetera. Guarda tus códigos de reserva: identifican a cada viajero.</p>

        {compras.map((c) => (
          <article key={c.id} className="co-done__block">
            <TramoLinea tramo={c.tramo} vuelo={c.vuelo} />
            <p className="co-done__meta">Clase {claseLabel(c.clase).toLowerCase()} · {formatPrice(c.total, c.vuelo.moneda)}</p>
            <TiquetesLista tiquetes={c.tiquetes} />
          </article>
        ))}

        <dl className="co-done__totals">
          <div><dt>Total gastado</dt><dd>{formatPrice(total)}</dd></div>
          <div><dt>Saldo restante</dt><dd>{formatPrice(saldo)}</dd></div>
        </dl>
        {correo && <Notice tone="info">Enviamos los códigos de reserva a <strong>{correo}</strong>.</Notice>}

        <div className="co-done__actions">
          <Link to="/mis-viajes" className="btn btn-primary">Ver mis viajes</Link>
          <Button variant="ghost" onClick={onSeguir}>Seguir buscando</Button>
        </div>
      </section>
    </div>
  )
}

/** Reserva creada: códigos por viajero y hasta cuándo está vigente (24 h). */
export function ReservaCreada({ resultado, onSeguir }) {
  const reservas = resultado.reservas ?? []
  return (
    <div className="co-done at-enter">
      <section className="co-done__card at-card" aria-labelledby="co-res-t">
        <span className="co-done__icon"><Icon name="clock" size={28} /></span>
        <h1 id="co-res-t" className="co-done__title">Reserva creada</h1>
        <p className="co-done__lead">Tu cupo queda guardado, pero todavía no está pagado. Si no la pagas dentro de las 24 horas, se libera sola.</p>

        {reservas.map((r) => (
          <article key={r.id} className="co-done__block">
            <TramoLinea tramo={r.tramo} vuelo={r.vuelo} />
            <p className="co-done__meta">
              Clase {claseLabel(r.clase).toLowerCase()} · Vigente hasta <strong>{formatDateTime(r.expira_en)}</strong>
            </p>
            <TiquetesLista tiquetes={r.tiquetes} />
          </article>
        ))}

        <div className="co-done__actions">
          <Link to="/mis-viajes?ver=reservas" className="btn btn-primary">Ver mis reservas</Link>
          <Button variant="ghost" onClick={onSeguir}>Seguir buscando</Button>
        </div>
      </section>
    </div>
  )
}
