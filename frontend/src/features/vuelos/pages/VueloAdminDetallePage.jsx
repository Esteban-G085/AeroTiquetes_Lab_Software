import { Link, useLocation, useParams } from 'react-router-dom'
import VueloDetalle from '../../../components/vuelo/VueloDetalle.jsx'
import Spinner from '../../../components/ui/Spinner.jsx'
import ErrorAlert from '../../../components/ui/ErrorAlert.jsx'
import EmptyState from '../../../components/ui/EmptyState.jsx'
import useVuelo from '../../../hooks/useVuelo.js'

export default function VueloAdminDetallePage() {
  const { id } = useParams()
  const location = useLocation()
  const { vuelo, cargando, error, recargar } = useVuelo(id)

  if (cargando) return <Spinner texto="Cargando vuelo…" />

  if (error) {
    if (error?.response?.status === 404) {
      return (
        <EmptyState icono="🗂️" titulo="Vuelo no encontrado">
          <Link className="btn btn-primary" to="/admin/vuelos">Volver al panel</Link>
        </EmptyState>
      )
    }
    return <ErrorAlert error={error} onReintentar={recargar} />
  }

  return (
    <div>
      <div className="mb-3">
        <Link className="btn btn-sm btn-outline-secondary" to="/admin/vuelos">← Volver al panel</Link>
      </div>

      {location.state?.recienCreado && (
        <div className="alert alert-success">
          Vuelo <strong>{vuelo?.codigo}</strong> programado correctamente.
        </div>
      )}

      <VueloDetalle vuelo={vuelo} />
    </div>
  )
}
