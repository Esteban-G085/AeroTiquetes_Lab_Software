import { Skeleton } from '@/components/ui'
import { EmptyState, ErrorState } from '@/components/feedback'
import { PageHeader } from '@/components/layout'
import { useAuth } from '@/context'
import { ROLES } from '@/config/roles'
import { useAsyncData } from '@/utils/useAsyncData'
import { listarNoticias } from '../api'
import NoticiaCard from '../components/NoticiaCard'
import Suscripcion from '../components/Suscripcion'
import '../noticias.css'

/** HU12 — Noticias de vuelos y promociones. Cada vuelo programado aparece solo; se retira a los 8 días o al realizarse. */
export default function NoticiasPage() {
  const { rol } = useAuth()
  const esCliente = rol === ROLES.CLIENTE
  const { status, data, error, reload } = useAsyncData(listarNoticias)

  return (
    <div className="nt-page">
      <PageHeader eyebrow="Novedades" title="Noticias y promociones" subtitle="Vuelos recién programados y ofertas vigentes." />
      {esCliente && <div className="mb-4"><Suscripcion /></div>}

      {status === 'loading' && (
        <div role="status" aria-label="Cargando noticias" className="nt-grid"><Skeleton height="16rem" /><Skeleton height="16rem" /><Skeleton height="16rem" /></div>
      )}
      {status === 'error' && <ErrorState message={error?.message} onRetry={reload} />}
      {status === 'ready' && data.length === 0 && <EmptyState icon="news" title="No hay noticias por ahora" message="Cuando se programen vuelos nuevos aparecerán aquí." />}
      {status === 'ready' && data.length > 0 && (
        <div className="nt-grid">
          {data.map((n) => <NoticiaCard key={n.id} noticia={n} comprar={esCliente} />)}
        </div>
      )}
    </div>
  )
}
