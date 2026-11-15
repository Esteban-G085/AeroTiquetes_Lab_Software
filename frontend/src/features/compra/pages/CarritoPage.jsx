import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, ConfirmDialog, Notice, Skeleton } from '@/components/ui'
import { EmptyState, useToast } from '@/components/feedback'
import { PageHeader } from '@/components/layout'
import { Stepper } from '@/components/travel'
import { subtotal, useCart } from '@/context'
import { formatPrice } from '@/utils/format'
import { useAsyncData } from '@/utils/useAsyncData'
import { crearCompra, obtenerSaldo } from '../api'
import { claseLabel } from '../rules'
import { TramoLinea } from '../components/ResumenViaje'
import { CompraConfirmada, PASOS } from '../components/Confirmaciones'
import '../compra.css'

function CarritoLleno({ onDone }) {
  const cart = useCart()
  const toast = useToast()
  const saldoQ = useAsyncData(obtenerSaldo)
  const [quitar, setQuitar] = useState(null)
  const [confirmar, setConfirmar] = useState(false)
  const [paying, setPaying] = useState(false)
  const [formError, setFormError] = useState('')

  const saldo = saldoQ.status === 'ready' ? Number(saldoQ.data.saldo) : null
  const falta = saldo === null ? 0 : Math.max(cart.total - saldo, 0)
  const insuficiente = saldo !== null && falta > 0

  async function pagar() {
    setPaying(true)
    setFormError('')
    const tramos = Object.fromEntries(cart.items.map((i) => [String(i.vuelo.id), i.tramo]))
    try {
      const r = await crearCompra(cart.items)
      cart.clear()
      onDone({ ...r, compras: (r.compras ?? []).map((c) => ({ ...c, tramo: tramos[String(c.vuelo?.id)] ?? 'ida' })) })
    } catch (err) {
      setConfirmar(false)
      setFormError(err.message)
      if (String(err.code).toLowerCase() === 'saldo_insuficiente') saldoQ.refresh()
    } finally {
      setPaying(false)
    }
  }

  return (
    <div className="co-page">
      <PageHeader eyebrow="Carrito" title="Mi carrito" subtitle="Revisa tus vuelos y el total antes de pagar con tu billetera." />
      <div className="mb-4"><Stepper steps={PASOS} current={1} label="Progreso de la compra" /></div>

      <div className="co-layout">
        <div className="co-form">
          {cart.items.map((item) => (
            <article key={item.vuelo.id} className="co-item at-card">
              <TramoLinea tramo={item.tramo} vuelo={item.vuelo} />
              <p className="co-item__meta">Clase {claseLabel(item.clase).toLowerCase()} · {item.viajeros.length} {item.viajeros.length === 1 ? 'viajero' : 'viajeros'}</p>
              <ul className="co-item__who">
                {item.viajeros.map((v) => <li key={v.documento}>{v.nombres} {v.apellidos} · <span className="at-mono">{v.documento}</span></li>)}
              </ul>
              <div className="co-item__foot">
                <strong>{formatPrice(subtotal(item), item.vuelo.moneda)}</strong>
                <span className="co-item__tools">
                  <Link to={`/comprar/${item.vuelo.id}`} className="btn btn-ghost btn-sm" aria-label={`Editar vuelo ${item.vuelo.codigo}`}>Editar</Link>
                  <Button variant="ghost" size="sm" aria-label={`Quitar vuelo ${item.vuelo.codigo}`} onClick={() => setQuitar(item)}>Quitar</Button>
                </span>
              </div>
            </article>
          ))}
        </div>

        <aside className="co-aside">
          <section className="co-resumen at-card" aria-labelledby="co-pago-t">
            <h2 id="co-pago-t" className="co-resumen__title">Pago con billetera</h2>
            {formError && <Notice tone="danger" className="mb-3">{formError}</Notice>}

            <dl className="co-resumen__lines">
              <div><dt>Tiquetes</dt><dd>{cart.count}</dd></div>
              <div>
                <dt>Saldo disponible</dt>
                <dd>
                  {saldoQ.status === 'loading' && <Skeleton width="6rem" height="1rem" />}
                  {saldoQ.status === 'ready' && formatPrice(saldo)}
                  {saldoQ.status === 'error' && '—'}
                </dd>
              </div>
            </dl>
            <div className="co-resumen__total"><span>Total a pagar</span><strong>{formatPrice(cart.total)}</strong></div>

            {saldoQ.status === 'error' && (
              <Notice tone="warning" className="mb-3">No pudimos consultar tu saldo. <Button variant="ghost" size="sm" onClick={saldoQ.reload}>Reintentar</Button></Notice>
            )}
            {insuficiente && (
              <Notice tone="danger" className="mb-3">
                Tu saldo es insuficiente: te faltan {formatPrice(falta)}. <Link to="/billetera">Agregar saldo</Link>
              </Notice>
            )}

            <div className="co-actions">
              <Button size="lg" disabled={saldo === null || insuficiente} onClick={() => setConfirmar(true)}>Confirmar compra</Button>
              <Link to="/" className="btn btn-ghost">Seguir buscando</Link>
            </div>
          </section>
        </aside>
      </div>

      <ConfirmDialog open={Boolean(quitar)} title="Quitar del carrito" confirmLabel="Quitar" danger
        message={quitar && `¿Quitar el vuelo ${quitar.vuelo.origen.ciudad} a ${quitar.vuelo.destino.ciudad} de tu carrito?`}
        onCancel={() => setQuitar(null)}
        onConfirm={() => { cart.removeItem(quitar.vuelo.id); toast.info('Quitamos el vuelo del carrito.'); setQuitar(null) }} />

      <ConfirmDialog open={confirmar} title="Confirmar compra" confirmLabel={`Pagar ${formatPrice(cart.total)}`} cancelLabel="Volver" loading={paying}
        message={`Se descontarán ${formatPrice(cart.total)} de tu billetera y se enviarán los códigos de reserva a cada viajero.`}
        onCancel={() => !paying && setConfirmar(false)} onConfirm={pagar} />
    </div>
  )
}

/** HU7 — Carrito con tiquetes de distintos vuelos y pago simulado con la billetera. */
export default function CarritoPage() {
  const { items } = useCart()
  const navigate = useNavigate()
  const [resultado, setResultado] = useState(null)

  if (resultado) return <CompraConfirmada resultado={resultado} onSeguir={() => navigate('/')} />
  if (!items.length) {
    return (
      <div className="co-page">
        <PageHeader eyebrow="Carrito" title="Mi carrito" />
        <EmptyState icon="cart" title="Tu carrito está vacío" message="Agrega un vuelo desde el buscador o desde las noticias."
          action={<Link to="/" className="btn btn-primary">Buscar vuelos</Link>} />
      </div>
    )
  }
  return <CarritoLleno onDone={setResultado} />
}
