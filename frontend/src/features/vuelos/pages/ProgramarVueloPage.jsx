import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import VueloForm from '../components/VueloForm.jsx'
import useCiudades from '../../../hooks/useCiudades.js'
import { crearVuelo } from '../services/vuelosService.js'

export default function ProgramarVueloPage() {
  const { ciudades } = useCiudades()
  const navigate = useNavigate()
  const [enviando, setEnviando] = useState(false)

  async function programar(payload) {
    setEnviando(true)
    try {
      const creado = await crearVuelo(payload)
      navigate(`/admin/vuelos/${creado.id}`, { state: { recienCreado: true } })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div>
      <div className="mb-3">
        <Link className="btn btn-sm btn-outline-secondary" to="/admin/vuelos">← Volver al panel</Link>
      </div>

      <h1 className="h3 mb-1">Programar vuelo</h1>
      <p className="texto-suave">
        El sistema genera el código consecutivo y calcula la hora de llegada según la zona horaria del destino.
      </p>

      <div className="mt-3">
        <VueloForm ciudades={ciudades} onSubmit={programar} enviando={enviando} />
      </div>
    </div>
  )
}
