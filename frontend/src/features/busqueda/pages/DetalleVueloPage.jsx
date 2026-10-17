import { Link, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '@/components/feedback'
import { Button } from '@/components/ui'
import { VueloDetalle } from '@/components/travel'
import { ROLES } from '@/config/roles'
import { useAuth } from '@/context'
import useVuelo from '../hooks/useVuelo'
import '../busqueda.css'

/** HU5 — Detalle de un vuelo (visitante y cliente). La compra es de la Iteración 2. */
export default function DetalleVueloPage() {
  const { id } = useParams()
  const { vuelo, status, error, recargar } = useVuelo(id)
  const { rol, isAuthenticated } = useAuth()

  if (status === 'loading') return <LoadingState label="Cargando vuelo…" />

  if (status === 'error') {
    if (error?.status === 404) {
      return (
        <EmptyState
          title="Vuelo no encontrado"
          message="El vuelo que buscas no existe o ya no está disponible."
          action={<Link className="btn btn-primary" to="/">Volver a la búsqueda</Link>}
        />
      )
    }
    return <ErrorState message={error?.message} onRetry={recargar} />
  }

  const esCliente = isAuthenticated && rol === ROLES.CLIENTE

  return (
    <div className="bu-detail">
      <Link className="bu-detail__back" to="/">
        <span aria-hidden="true">←</span> Volver a los resultados
      </Link>

      <VueloDetalle
        vuelo={vuelo}
        acciones={
          <>
            {esCliente && <Button disabled>Reservar / Comprar (próximo sprint)</Button>}
            {!isAuthenticated && <Link className="btn btn-primary" to="/login">Inicia sesión para reservar</Link>}
            {isAuthenticated && !esCliente && (
              <span className="bu-detail__note">
                Tu rol actual ({rol}) no puede reservar ni comprar tiquetes.
              </span>
            )}
          </>
        }
      />
    </div>
  )
}
