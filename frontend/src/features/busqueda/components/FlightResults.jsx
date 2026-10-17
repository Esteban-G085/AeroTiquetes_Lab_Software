import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/feedback'
import { FlightCard } from '@/components/travel'
import { TIPO_LABEL } from '@/domain/estados'
import { disponibilidadTexto } from '@/domain/vuelo'

/**
 * Resultados de la búsqueda (HU5). Muestra TODOS los vuelos programados con salida futura
 * —la falta de cupo no los oculta, solo se advierte en la tarjeta (D13)— con la información
 * completa que exige la historia: código, ruta, salida, llegada en hora local, duración,
 * costo y disponibilidad por clase.
 */
export default function FlightResults({ vuelos = [], huboBusqueda = false }) {
  if (!huboBusqueda) return null

  if (vuelos.length === 0) {
    return (
      <EmptyState
        title="No se encontraron vuelos"
        message="Prueba con otros criterios, amplía el rango de fechas o cambia el precio máximo."
      />
    )
  }

  return (
    <section className="bu-results" aria-label="Resultados de la búsqueda">
      <p className="bu-results__count">
        {vuelos.length} {vuelos.length === 1 ? 'vuelo encontrado' : 'vuelos encontrados'}
      </p>

      <div className="bu-results__list">
        {vuelos.map((vuelo) => (
          <FlightCard
            key={vuelo.id ?? vuelo.codigo}
            codigo={vuelo.codigo}
            origen={{ ciudad: vuelo.origen?.nombre, codigo: vuelo.origen?.codigo }}
            destino={{ ciudad: vuelo.destino?.nombre, codigo: vuelo.destino?.codigo }}
            salida={vuelo.salida_utc}
            llegada={vuelo.llegada_utc}
            salidaZona={vuelo.origen?.zona_horaria}
            llegadaZona={vuelo.destino?.zona_horaria}
            duracionMin={vuelo.duracion_min}
            precio={vuelo.costo}
            detalles={`Vuelo ${TIPO_LABEL[vuelo.tipo] ?? vuelo.tipo}`}
            disponibilidad={disponibilidadTexto(vuelo)}
            action={<Link className="btn btn-outline-primary" to={`/vuelos/${vuelo.id}`}>Ver detalle</Link>}
          />
        ))}
      </div>
    </section>
  )
}
