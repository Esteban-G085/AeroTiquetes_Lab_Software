import { Link, useParams } from 'react-router-dom'
import VueloDetalle from '../../../components/vuelo/VueloDetalle.jsx'
import Spinner from '../../../components/ui/Spinner.jsx'
import ErrorAlert from '../../../components/ui/ErrorAlert.jsx'
import EmptyState from '../../../components/ui/EmptyState.jsx'
import useVuelo from '../../../hooks/useVuelo.js'
import { useAuth } from '../../../context/AuthContext.jsx'

export default function VueloDetallePage() {
  const { id } = useParams()
  const { vuelo, cargando, error, recargar } = useVuelo(id)
  const { autenticado, rol } = useAuth()

  if (cargando) return <Spinner texto="Cargando vuelo…" />

  if (error) {
    const noEncontrado = error?.response?.status === 404
    if (noEncontrado) {
      return (
        <EmptyState
          icono="✈️"
          titulo="Vuelo no encontrado"
          mensaje="El vuelo que buscas no existe o fue retirado."
        >
          <Link className="btn btn-primary" to="/buscar">Volver a la búsqueda</Link>
        </EmptyState>
      )
    }
    return <ErrorAlert error={error} onReintentar={recargar} />
  }

  const esCliente = autenticado && rol === 'cliente'

  return (
    <div>
      <Link className="btn btn-link px-0 mb-2" to="/buscar">← Volver a resultados</Link>
      <VueloDetalle
        vuelo={vuelo}
        acciones={
          <>
            {rol === 'cliente' && (
              <button className="btn btn-primary" disabled>
                Reservar / Comprar (próximo sprint)
              </button>
            )}
            {!autenticado && (
              <Link className="btn btn-primary" to="/login">
                Inicia sesión para reservar
              </Link>
            )}
            {autenticado && rol !== 'cliente' && (
              <span className="texto-suave small align-self-center">
                Tu rol actual ({rol}) no puede reservar ni comprar tiquetes.
              </span>
            )}
          </>
        }
      />
    </div>
  )
}
