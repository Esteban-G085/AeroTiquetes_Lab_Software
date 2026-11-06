import { useNavigate, useParams } from 'react-router-dom'
import { useToast } from '@/components/feedback'
import { BackLink, PageHeader } from '@/components/layout'
import { useCiudades } from '@/utils/useCiudades'
import VueloForm from '../components/VueloForm'
import useVueloAdmin from '../hooks/useVueloAdmin'
import { actualizarVuelo } from '../api'
import '../vuelos.css'

/** HU12 — Editar un vuelo programado (solo administrador). */
export default function EditarVueloPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { ciudades } = useCiudades()
  const { vuelo, status, error, recargar } = useVueloAdmin(id)

  const volver = <BackLink to="/admin/vuelos">Volver al panel</BackLink>

  if (status === 'loading') {
    return (
      <div className="vu-page">
        {volver}
        <div className="at-skeleton" />
      </div>
    )
  }

  if (status === 'error') {
    if (error?.status === 404) {
      return (
        <div className="vu-page">
          {volver}
          <div className="at-card at-card--empty">
            <p>Vuelo no encontrado</p>
            <p>El vuelo consultado no existe o fue retirado del sistema.</p>
          </div>
        </div>
      )
    }
    return (
      <div className="vu-page">
        {volver}
        <div className="at-card at-card--empty">
          <p>{error?.message ?? 'Error al cargar el vuelo.'}</p>
          <button className="btn btn-primary" onClick={recargar}>Reintentar</button>
        </div>
      </div>
    )
  }

  async function guardar(payload) {
    const actualizado = await actualizarVuelo(id, payload)
    toast.success(`Vuelo ${actualizado?.codigo ?? ''} actualizado correctamente.`.replace('  ', ' '))
    navigate(`/admin/vuelos/${actualizado.id ?? id}`, { replace: true })
  }

  return (
    <div className="vu-page">
      {volver}

      <PageHeader
        eyebrow="Administración"
        title={`Editar vuelo ${vuelo.codigo}`}
        subtitle="Modifica fecha, hora, origen, destino, duración y costo. El sistema recalcula la llegada."
      />

      <VueloForm ciudades={ciudades} vuelo={vuelo} onGuardar={guardar} />
    </div>
  )
}
