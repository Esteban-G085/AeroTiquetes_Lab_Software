import { Link } from 'react-router-dom'
import EmptyState from '../../../components/ui/EmptyState.jsx'

export default function NoEncontradoPage() {
  return (
    <EmptyState icono="🧭" titulo="Página no encontrada" mensaje="La ruta que buscas no existe.">
      <Link className="btn btn-primary" to="/buscar">Ir a buscar vuelos</Link>
    </EmptyState>
  )
}
