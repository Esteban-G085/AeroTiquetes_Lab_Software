import FlightCard from './FlightCard.jsx'
import EmptyState from '../../../components/ui/EmptyState.jsx'

export default function FlightResults({ vuelos, huboBusqueda }) {
  if (!huboBusqueda) return null

  if (!vuelos?.length) {
    return (
      <EmptyState
        icono="✈️"
        titulo="No se encontraron vuelos"
        mensaje="Prueba con otros criterios o amplía el rango de fechas."
      />
    )
  }

  return (
    <>
      <p className="texto-suave mb-2">{vuelos.length} vuelo(s) encontrado(s)</p>
      <div className="row g-3">
        {vuelos.map((v) => (
          <div className="col-12 col-lg-6" key={v.id ?? v.codigo}>
            <FlightCard vuelo={v} />
          </div>
        ))}
      </div>
    </>
  )
}
