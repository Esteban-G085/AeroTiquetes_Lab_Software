import { Link, useNavigate } from 'react-router-dom'
import { useToast } from '@/components/feedback'
import { SkyArt } from '@/components/brand'
import RegistroForm from '../components/RegistroForm'
import { registrarCliente } from '../api'
import '../usuarios.css'

/** HU4 — Registro de cliente. */
export default function RegistroPage() {
  const navigate = useNavigate()
  const toast = useToast()

  async function handleSubmit({ values, imagen }) {
    await registrarCliente(values, imagen)
    toast.success('Cuenta creada. Ya puedes iniciar sesión.')
    navigate('/login', { replace: true })
  }

  return (
    <div className="us-reg at-sky at-sky--fixed">
      <SkyArt />
      <RegistroForm
        onSubmit={handleSubmit}
        footer={<p className="us-reg__alt">¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>}
      />
    </div>
  )
}
