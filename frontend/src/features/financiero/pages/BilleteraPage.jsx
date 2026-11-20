import { useEffect, useState } from 'react'
import { Button, ConfirmDialog, Icon, Input, Notice, Select, Skeleton } from '@/components/ui'
import { EmptyState, ErrorState, useToast } from '@/components/feedback'
import { PageHeader } from '@/components/layout'
import { maskCard, formatPrice } from '@/utils/format'
import { useAsyncData } from '@/utils/useAsyncData'
import {
  actualizarTarjeta, agregarSaldo, crearTarjeta, eliminarTarjeta, listarTarjetas, obtenerBilletera,
} from '../api'
import { MONTOS_RAPIDOS, parseMonto, validarMonto, vencimientoVigente } from '../validators'
import TarjetaVisual from '../components/TarjetaVisual'
import TarjetaDialog from '../components/TarjetaDialog'
import '../financiero.css'

function SaldoCard({ billetera, tarjetas, onChanged }) {
  const toast = useToast()
  const [visible, setVisible] = useState(true)
  const [monto, setMonto] = useState('')
  const [idTarjeta, setIdTarjeta] = useState('')
  const [error, setError] = useState('')
  const [tarjetaError, setTarjetaError] = useState('')
  const [saving, setSaving] = useState(false)

  // Solo se pueden usar tarjetas propias que sigan vigentes; el backend lo vuelve a comprobar.
  const vigentes = tarjetas.filter((t) => vencimientoVigente(t.vencimiento))

  useEffect(() => {
    if (!idTarjeta && tarjetas.length) {
      const primera = tarjetas.find((t) => vencimientoVigente(t.vencimiento))
      if (primera) setIdTarjeta(String(primera.id))
    }
  }, [idTarjeta, tarjetas])

  async function submit(e) {
    e.preventDefault()
    const msg = validarMonto(monto)
    setError(msg ?? '')
    setTarjetaError(idTarjeta ? '' : 'Selecciona una tarjeta registrada y vigente.')
    if (msg || !idTarjeta) return

    setSaving(true)
    try {
      const valor = parseMonto(monto)
      const r = await agregarSaldo(valor, Number(idTarjeta))
      toast.success(`Agregamos ${formatPrice(valor)} a tu saldo.`)
      setMonto('')
      onChanged(r)
    } catch (err) {
      const campos = err.fields ?? {}
      setError(campos.monto ?? campos.saldo ?? (Object.keys(campos).length ? '' : err.message))
      setTarjetaError(campos.id_tarjeta ?? '')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="fi-balance at-card at-card--night at-enter-2" aria-labelledby="fi-saldo-t">
      <h2 id="fi-saldo-t" className="fi-balance__label">Saldo total</h2>
      <p className="fi-balance__amount">
        <span aria-live="polite">{visible ? formatPrice(billetera.saldo, billetera.moneda) : '$ ••••••'}</span>
        <button type="button" className="fi-balance__eye" aria-pressed={!visible} aria-label={visible ? 'Ocultar saldo' : 'Mostrar saldo'} onClick={() => setVisible((v) => !v)}>
          <Icon name={visible ? 'eye-off' : 'eye'} size={22} />
        </button>
      </p>

      <form onSubmit={submit} noValidate className="fi-balance__form">
        <Input label="Monto a agregar" name="monto" inputMode="numeric" autoComplete="off" placeholder="0"
          value={monto} onChange={(e) => { setMonto(e.target.value); setError('') }} error={error} />
        <div className="fi-quick" role="group" aria-label="Montos sugeridos">
          {MONTOS_RAPIDOS.map((m) => (
            <button key={m} type="button" className="fi-quick__btn" onClick={() => { setMonto(String(m)); setError('') }}>{formatPrice(m)}</button>
          ))}
        </div>
        <Select
          label="Tarjeta registrada" name="id_tarjeta" value={idTarjeta}
          onChange={(e) => { setIdTarjeta(e.target.value); setTarjetaError('') }}
          error={tarjetaError}
          placeholder={vigentes.length ? 'Selecciona una tarjeta' : 'No tienes tarjetas vigentes'}
          options={vigentes.map((t) => ({
            value: String(t.id),
            label: `${t.marca && t.marca !== 'Otra' ? `${t.marca} · ` : ''}•••• ${t.numero} (vence ${t.vencimiento})`,
          }))}
        />
        {vigentes.length === 0 && (
          <p className="fi-balance__hint">Registra una tarjeta vigente en «Mis tarjetas» para poder recargar.</p>
        )}
        <Button type="submit" loading={saving} disabled={vigentes.length === 0}>Agregar saldo</Button>
      </form>
      <p className="fi-balance__note">Saldo simulado: no está conectado a ningún banco ni se pide el CVV al recargar.</p>
    </section>
  )
}

/** HU15 / HU16 / HU17 — Billetera virtual: recargas de saldo y tarjetas de crédito y débito simuladas. */
export default function BilleteraPage() {
  const toast = useToast()
  const bil = useAsyncData(obtenerBilletera)
  const tar = useAsyncData(listarTarjetas)
  const [dialog, setDialog] = useState({ open: false, tarjeta: null })
  const [borrar, setBorrar] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function guardar(values) {
    if (dialog.tarjeta) await actualizarTarjeta(dialog.tarjeta.id, values)
    else await crearTarjeta(values)
    toast.success(dialog.tarjeta ? 'Tarjeta actualizada.' : 'Tarjeta agregada.')
    setDialog({ open: false, tarjeta: null })
    tar.refresh()
  }

  async function confirmarBorrar() {
    setDeleting(true)
    try {
      await eliminarTarjeta(borrar.id)
      toast.success(`Eliminamos la tarjeta ${maskCard(borrar.numero)}.`)
      setBorrar(null)
      tar.refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fi-page">
      <PageHeader eyebrow="Mi cuenta" title="Mi billetera" subtitle="Con tu saldo pagas tus compras y en él recibes los reintegros." />

      <div className="fi-layout">
        <div>
          {bil.status === 'loading' && <Skeleton height="17rem" />}
          {bil.status === 'error' && <ErrorState message={bil.error?.message} onRetry={bil.reload} />}
          {bil.status === 'ready' && (
            <SaldoCard
              billetera={bil.data}
              tarjetas={tar.status === 'ready' ? tar.data : []}
              onChanged={() => bil.refresh()}
            />
          )}
        </div>

        <section className="at-card at-enter-3" aria-labelledby="fi-tarjetas-t">
          <div className="fi-cards__head">
            <h2 id="fi-tarjetas-t" className="fi-cards__title">Mis tarjetas</h2>
            <Button variant="outline-primary" size="sm" onClick={() => setDialog({ open: true, tarjeta: null })}><Icon name="plus" size={16} /> Agregar tarjeta</Button>
          </div>

          {tar.status === 'loading' && <div role="status" aria-label="Cargando tus tarjetas" className="d-grid gap-3"><Skeleton height="8rem" /></div>}
          {tar.status === 'error' && <ErrorState message={tar.error?.message} onRetry={tar.reload} />}
          {tar.status === 'ready' && tar.data.length === 0 && (
            <EmptyState icon="card" title="Aún no tienes tarjetas" message="Registra una tarjeta de crédito o débito simulada para tenerla en tu billetera." />
          )}
          {tar.status === 'ready' && tar.data.length > 0 && (
            <div className="fi-cards">
              {tar.data.map((t) => (
                <TarjetaVisual key={t.id} tarjeta={t} onEdit={(x) => setDialog({ open: true, tarjeta: x })} onDelete={setBorrar} />
              ))}
            </div>
          )}
          <Notice tone="info" className="mt-3">Las tarjetas son simuladas: el número se valida con Luhn, pero no se consulta ningún banco.</Notice>
        </section>
      </div>

      <TarjetaDialog open={dialog.open} tarjeta={dialog.tarjeta} onSave={guardar} onClose={() => setDialog({ open: false, tarjeta: null })} />

      <ConfirmDialog open={Boolean(borrar)} danger loading={deleting} title="Eliminar tarjeta" confirmLabel="Eliminar"
        message={borrar && `¿Eliminar la tarjeta ${maskCard(borrar.numero)} de ${borrar.titular}? Esta acción no se puede deshacer.`}
        onConfirm={confirmarBorrar} onCancel={() => !deleting && setBorrar(null)} />
    </div>
  )
}
