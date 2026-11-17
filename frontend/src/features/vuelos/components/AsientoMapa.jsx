import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/components/feedback'
import { obtenerAsientosVuelo } from '../api'
import '../vuelos.css'

const COLUMNAS = ['A', 'B', 'C', 'D', 'E']

/**
 * AsientoMapa — Mapa de asientos para seleccionar silla.
 *
 * - `idVuelo`: id del vuelo (requerido para cargar asientos).
 * - `clase`: 'economica' | 'primera' para filtrar asientos de esa clase.
 * - `asientosSeleccionados`: IDs de asientos ya seleccionados por este usuario (en sesión).
 * - `onCambio(seleccionados)`: callback con la lista de IDs de asientos seleccionados.
 * - `maxSelecciones`: cantidad máxima de asientos que se pueden seleccionar (cantidad de viajeros).
 */
export default function AsientoMapa({
  idVuelo,
  clase,
  asientosSeleccionados = [],
  onCambio,
  maxSelecciones = 1,
}) {
  const toast = useToast()
  const [asientos, setAsientos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [seleccionados, setSeleccionados] = useState(new Set(asientosSeleccionados))

  const cargarAsientos = useCallback(async () => {
    setCargando(true)
    try {
      const datos = await obtenerAsientosVuelo(idVuelo)
      const filtrados = clase
        ? datos.filter((a) => a.clase === clase)
        : datos
      setAsientos(filtrados)
    } catch (err) {
      toast.error('No se pudieron cargar los asientos del vuelo.')
    } finally {
      setCargando(false)
    }
  }, [idVuelo, clase, toast])

  useEffect(() => {
    cargarAsientos()
  }, [cargarAsientos])

  const estaSeleccionado = (idAsiento) => seleccionados.has(idAsiento)
  const estaOcupado = (a) => a.estado === 'OCUPADO' || a.estado === 'ocupado'

  const toggleAsiento = (idAsiento, asiento) => {
    if (estaOcupado(asiento)) return

    const yaSeleccionado = estaSeleccionado(idAsiento)
    if (yaSeleccionado) {
      setSeleccionados((prev) => {
        const siguiente = new Set(prev)
        siguiente.delete(idAsiento)
        onCambio?.([...siguiente])
        return siguiente
      })
    } else {
      if (seleccionados.size >= maxSelecciones) {
        toast.warning(`Solo puedes seleccionar ${maxSelecciones} asiento${maxSelecciones !== 1 ? 's' : ''}.`)
        return
      }
      setSeleccionados((prev) => {
        const siguiente = new Set(prev)
        siguiente.add(idAsiento)
        onCambio?.([...siguiente])
        return siguiente
      })
    }
  }

  if (cargando) {
    return (
      <div className="asiento-mapa asiento-mapa--cargando">
        <div className="at-skeleton" />
      </div>
    )
  }

  // Agrupar asientos por fila
  const porFila = {}
  asientos.forEach((a) => {
    if (!porFila[a.fila]) porFila[a.fila] = []
    porFila[a.fila].push(a)
  })
  const filas = Object.keys(porFila).sort((a, b) => Number(a) - Number(b))

  return (
    <div className="asiento-mapa">
      <div className="asiento-mapa__leyenda">
        <div className="asiento-mapa__item">
          <span className="asiento-mapa__dot disponible" /> Disponible
        </div>
        <div className="asiento-mapa__item">
          <span className="asiento-mapa__dot ocupado" /> Ocupado
        </div>
        <div className="asiento-mapa__item">
          <span className="asiento-mapa__dot seleccionado" /> Tu selección
        </div>
      </div>

      <div className="asiento-mapa__grid">
        {filas.map((fila) => (
          <div key={fila} className="asiento-mapa__fila">
            <span className="asiento-mapa__numero-fila">{fila}</span>
            {COLUMNAS.map((columna) => {
              const asiento = porFila[fila].find((a) => a.columna === columna)
              if (!asiento) return <span key={columna} className="asiento-mapa__vacio" />
              const ocupado = estaOcupado(asiento)
              const seleccionado = estaSeleccionado(asiento.id)
              return (
                <button
                  key={asiento.id}
                  type="button"
                  className={`asiento-mapa__silla ${
                    seleccionado ? 'seleccionado' : ''
                  } ${ocupado ? 'ocupado' : 'disponible'}`}
                  disabled={ocupado}
                  onClick={() => !ocupado && toggleAsiento(asiento.id, asiento)}
                  title={`Silla ${asiento.numero} (${asiento.clase})`}
                >
                  {asiento.numero}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {seleccionados.size > 0 && (
        <div className="asiento-mapa__resumen">
          Asientos seleccionados: {[...seleccionados].map((id) => {
            const a = asientos.find((x) => x.id === id)
            return a ? a.numero : id
          }).join(', ')}
        </div>
      )}
    </div>
  )
}
