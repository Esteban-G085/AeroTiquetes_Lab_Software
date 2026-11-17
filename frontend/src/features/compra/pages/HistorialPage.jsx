import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ConfirmDialog, Skeleton } from '@/components/ui'
import { EmptyState, ErrorState, useToast } from '@/components/feedback'
import { PageHeader } from '@/components/layout'
import { formatPrice } from '@/utils/format'
import { useAsyncData } from '@/utils/useAsyncData'
import { cancelarCompra, cancelarReserva, obtenerHistorial, pagarReserva } from '../api'
import { ESTADOS_COMPRA, ESTADOS_RESERVA, precioParaClase } from '../rules'
import { useNow } from '../hooks/useNow'
import HistorialCard from '../components/HistorialCard'
import TiqueteDetalleModal from '../components/TiqueteDetalleModal'
import '../compra.css'

const FILTROS = [['todas', 'Todas'], ['activas', 'Activas'], ['canceladas', 'Canceladas']]

const grupoDe = (kind, item, now) => {
  if (kind === 'reserva' && item.estado === 'activa' && Date.parse(item.expira_en) <= now) return 'canceladas'
  return (kind === 'compra' ? ESTADOS_COMPRA : ESTADOS_RESERVA)[item.estado]?.grupo ?? 'activas'
}

function ListSkeleton() {
  return (
    <div role="status" aria-label="Cargando tu historial" className="d-grid gap-3">
      <Skeleton height="9rem" /><Skeleton height="9rem" />
    </div>
  )
}

/** HU9 — Historial de compras y reservas (activas y canceladas), con detalle y cancelación. */
export default function HistorialPage() {
  const toast = useToast()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const tab = params.get('ver') === 'reservas' ? 'reservas' : 'compras'
  const [filtro, setFiltro] = useState('todas')
  const { status, data, error, reload, refresh } = useAsyncData(obtenerHistorial)

  const [detalle, setDetalle] = useState(null)   // { item, tiquete, esCompra }
  const [accion, setAccion] = useState(null)     // { tipo: 'cancelar' | 'pagar', kind, item }
  const [working, setWorking] = useState(false)

  const setTab = (t) => setParams(t === 'reservas' ? { ver: 'reservas' } : {}, { replace: true })

  async function confirmar() {
    const { tipo, kind, item } = accion
    setWorking(true)
    try {
      if (tipo === 'pagar') {
        await pagarReserva(item.id)
        toast.success('Pagaste tu reserva. Ahora está en tus compras.')
      } else if (kind === 'compra') {
        const r = await cancelarCompra(item.id)
        toast.success(`Compra cancelada. Reintegramos ${formatPrice(r?.reintegro ?? item.total)} a tu billetera.`)
      } else {
        await cancelarReserva(item.id)
        toast.success('Reserva cancelada. Liberamos tus cupos.')
      }
      setAccion(null)
      refresh()
    } catch (err) {
      toast.error(err.message)
      setAccion(null)
    } finally {
      setWorking(false)
    }
  }

  const lista = status === 'ready' ? (tab === 'compras' ? data.compras : data.reservas) : []
  const kind = tab === 'compras' ? 'compra' : 'reserva'
  const visibles = lista.filter((it) => filtro === 'todas' || grupoDe(kind, it, now) === filtro)

  const textoAccion = accion && (accion.tipo === 'pagar'
    ? { title: 'Pagar reserva', label: 'Pagar', back: 'Volver', danger: false,
      msg: `Se descontarán ${formatPrice(accion.item.total ?? precioParaClase(accion.item.vuelo, accion.item.clase) * accion.item.tiquetes.length)} de tu billetera de inmediato.` }
    : accion.kind === 'compra'
      ? { title: 'Cancelar compra', label: 'Cancelar compra', back: 'Mantener compra', danger: true,
        msg: `Se cancelará la compra de ${accion.item.tiquetes.length} ${accion.item.tiquetes.length === 1 ? 'tiquete' : 'tiquetes'} de ${accion.item.vuelo.origen.ciudad} a ${accion.item.vuelo.destino.ciudad}. Te reintegramos ${formatPrice(accion.item.total ?? 0)} a tu billetera de inmediato.` }
      : { title: 'Cancelar reserva', label: 'Cancelar reserva', back: 'Mantener reserva', danger: true,
        msg: 'Se liberarán el cupo y los tiquetes de esta reserva. Esta acción no se puede deshacer.' })

  return (
    <div className="co-page">
      <PageHeader eyebrow="Mi cuenta" title="Mis viajes" subtitle="Tus compras y reservas, activas y canceladas." />

      <div className="at-tabs" role="tablist" aria-label="Tipo de viaje">
        {[['compras', 'Compras', data?.compras.length], ['reservas', 'Reservas', data?.reservas.length]].map(([id, label, n]) => (
          <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls="hist-panel"
            className={`at-tabs__tab${tab === id ? ' is-active' : ''}`} onClick={() => setTab(id)}>
            {label}{n !== undefined && <span className="at-tabs__n">{n}</span>}
          </button>
        ))}
      </div>

      <div id="hist-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mt-3">
        <div className="at-filters" role="group" aria-label="Filtrar por estado">
          {FILTROS.map(([id, label]) => (
            <button key={id} type="button" className={`at-filters__btn${filtro === id ? ' is-active' : ''}`} aria-pressed={filtro === id} onClick={() => setFiltro(id)}>{label}</button>
          ))}
        </div>

        {status === 'loading' && <ListSkeleton />}
        {status === 'error' && <ErrorState message={error?.message} onRetry={reload} />}
        {status === 'ready' && visibles.length === 0 && (
          <EmptyState icon="ticket"
            title={lista.length === 0 ? `Aún no tienes ${tab === 'compras' ? 'compras' : 'reservas'}` : 'No hay resultados con este filtro'}
            message={lista.length === 0 ? 'Cuando compres o reserves un tiquete, aparecerá aquí.' : 'Prueba con otro estado.'}
            action={lista.length === 0 ? <Link to="/" className="btn btn-primary">Buscar vuelos</Link> : undefined} />
        )}
        {status === 'ready' && visibles.length > 0 && (
          <div className="d-grid gap-3">
            {visibles.map((it) => (
              <HistorialCard key={`${kind}-${it.id}`} kind={kind} item={it} now={now}
                onDetalle={(item, tiquete) => setDetalle({ item, tiquete })}
                onCancelar={(item) => setAccion({ tipo: 'cancelar', kind, item })}
                onPagar={(item) => setAccion({ tipo: 'pagar', kind, item })} />
            ))}
          </div>
        )}
      </div>

      <TiqueteDetalleModal item={detalle?.item} tiquete={detalle?.tiquete} onClose={() => setDetalle(null)} />

      <ConfirmDialog open={Boolean(accion)} title={textoAccion?.title} message={textoAccion?.msg} confirmLabel={textoAccion?.label}
        cancelLabel={textoAccion?.back} danger={textoAccion?.danger} loading={working}
        onConfirm={confirmar} onCancel={() => !working && setAccion(null)} />
    </div>
  )
}
