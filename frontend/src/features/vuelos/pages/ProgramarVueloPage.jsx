import { Link, useNavigate } from 'react-router-dom'
import { useToast } from '@/components/feedback'
import { PageHeader } from '@/components/layout'
import { useCiudades } from '@/utils/useCiudades'
import VueloForm from '../components/VueloForm'
import { crearVuelo } from '../api'
import '../vuelos.css'

/** HU18 — Programar un vuelo (solo administrador). */
export default function ProgramarVueloPage() {
  const { ciudades } = useCiudades()
  const navigate = useNavigate()
  const toast = useToast()

  // Sin try/catch: el formulario muestra los errores del backend en cada campo (ApiError.fields).
  async function programar(payload) {
    const creado = await crearVuelo(payload)
    toast.success(`Vuelo ${creado?.codigo ?? ''} programado correctamente.`.replace('  ', ' '))
    navigate(`/admin/vuelos/${creado.id}`, { replace: true })
  }

  return (
    <div className="vu-page">
      <Link className="vu-back" to="/admin/vuelos">
        <span aria-hidden="true">←</span> Volver al panel
      </Link>

      <PageHeader
        eyebrow="Administración"
        title="Programar vuelo"
        subtitle="El código consecutivo, la hora de llegada y los cupos por clase los genera el sistema."
      />

      <VueloForm ciudades={ciudades} onProgramar={programar} />
    </div>
  )
}
