import { useState } from 'react'
import { Button, Icon, Input, Notice, Skeleton } from '@/components/ui'
import { ErrorState, useToast } from '@/components/feedback'
import { useAsyncData } from '@/utils/useAsyncData'
import { cancelarSuscripcion, obtenerSuscripcion, suscribirse } from '../api'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** HU12 — Suscribirse o cancelar la suscripción a las noticias por correo (solo clientes). */
export default function Suscripcion() {
  const toast = useToast()
  const { status, data, error, reload, refresh } = useAsyncData(obtenerSuscripcion)
  const [correo, setCorreo] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (status === 'loading') return <Skeleton height="7rem" />
  if (status === 'error') return <ErrorState title="No pudimos cargar tu suscripción" message={error?.message} onRetry={reload} />

  async function alta(e) {
    e.preventDefault()
    const valor = correo.trim() || data.correo || ''
    if (!EMAIL_RE.test(valor)) { setErr('Escribe un correo válido.'); return }
    setBusy(true); setErr('')
    try {
      await suscribirse(valor)
      toast.success(`Listo: te avisaremos en ${valor}.`)
      setCorreo('')
      refresh()
    } catch (ex) {
      setErr(ex.fields?.correo ?? ex.message)
    } finally {
      setBusy(false)
    }
  }

  async function baja() {
    setBusy(true)
    try {
      await cancelarSuscripcion()
      toast.success('Cancelamos tu suscripción. Ya no recibirás novedades por correo.')
      refresh()
    } catch (ex) {
      toast.error(ex.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="nt-sub at-card" aria-labelledby="nt-sub-t">
      <span className="nt-sub__icon"><Icon name="bell" size={22} /></span>
      <div className="nt-sub__body">
        <h2 id="nt-sub-t" className="nt-sub__title">Novedades por correo</h2>
        {data.suscrito
          ? (
            <>
              <p className="nt-sub__text">Estás suscrito: te escribimos a <strong>{data.correo}</strong> cuando hay vuelos o promociones nuevas.</p>
              <Button variant="outline-secondary" size="sm" onClick={baja} loading={busy}>Cancelar suscripción</Button>
            </>
          )
          : (
            <form onSubmit={alta} noValidate>
              <p className="nt-sub__text">Recibe en tu correo los vuelos y promociones nuevas.</p>
              {err && <Notice tone="danger" className="mb-2">{err}</Notice>}
              <div className="nt-sub__row">
                <Input label="Correo" name="correo" type="email" autoComplete="email" placeholder={data.correo || 'usuario@correo.com'}
                  value={correo} onChange={(e) => { setCorreo(e.target.value); setErr('') }} />
                <Button type="submit" loading={busy}>Suscribirme</Button>
              </div>
            </form>
          )}
      </div>
    </section>
  )
}
