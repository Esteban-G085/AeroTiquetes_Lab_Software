import { useState, useCallback, useEffect, useRef, Fragment } from 'react'
import { useToast } from '@/components/feedback'
import { obtenerAsientosVuelo } from '../api'
import '../vuelos.css'

const COLUMNAS = ['A', 'B', 'C', 'D', 'E', 'F']
const GLIFOS = { ventana: 'V', medio: 'M', pasillo: 'P' }

/**
 * Posición de cada columna. Con 6 columnas es un 3-3: A/F ventana, B/E medio y C/D pasillo.
 * Los vuelos creados antes del cambio a 3-3 traen A-E; en ese caso E sigue siendo ventana.
 */
function posicionesPara(columnasPresentes) {
  if (columnasPresentes.includes('F')) {
    return { A: 'ventana', B: 'medio', C: 'pasillo', D: 'pasillo', E: 'medio', F: 'ventana' }
  }
  return { A: 'ventana', B: 'medio', C: 'pasillo', D: 'pasillo', E: 'ventana' }
}

const capitalizar = (texto) => texto[0].toUpperCase() + texto.slice(1)

/**
 * AsientoMapa — Mapa de asientos para seleccionar silla.
 *
 * - `idVuelo`: id del vuelo (requerido para cargar asientos).
 * - `clase`: 'economica' | 'primera' para filtrar asientos de esa clase.
 * - `asientosSeleccionados`: IDs de asientos ya seleccionados por este usuario (en sesión).
 * - `onCambio(seleccionados)`: callback con la lista de IDs de asientos seleccionados.
 * - `maxSelecciones`: cantidad máxima de asientos que se pueden seleccionar (cantidad de viajeros).
 *
 * El mapa dibuja el pasillo entre C y D (antes de D, no antes de C), con cabecera fija
 * de columnas, scroll propio y un contador de filas. Marca ventana/medio/pasillo con un
 * glifo, leyenda y tooltip, como hacen las aerolíneas. El estado (libre/ocupado/elegido)
 * se mantiene en colores aparte. La posición se deriva de `columna`: el contrato
 * de la API no cambia.
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
  const onCambioRef = useRef(onCambio)
  useEffect(() => { onCambioRef.current = onCambio })

  const cargarAsientos = useCallback(async () => {
    setCargando(true)
    try {
      const datos = await obtenerAsientosVuelo(idVuelo)
      const filtrados = clase
        ? datos.filter((a) => a.clase === clase)
        : datos
      setAsientos(filtrados)
    } catch {
      toast.error('No se pudieron cargar los asientos del vuelo.')
    } finally {
      setCargando(false)
    }
  }, [idVuelo, clase, toast])

  useEffect(() => {
    cargarAsientos()
  }, [cargarAsientos])

  // El padre puede cambiar la selección (otro tramo, cambio de clase, carrito restaurado, etc.).
  // Comparamos por valor: el array por defecto `[]` es una referencia distinta en cada render.
  const claveSeleccion = JSON.stringify(asientosSeleccionados)
  useEffect(() => {
    setSeleccionados(new Set(JSON.parse(claveSeleccion)))
  }, [claveSeleccion])

  // Revalidación al entrar al paso: una silla guardada en el carrito pudo ser tomada
  // mientras el usuario estaba en otro paso. La quitamos y lo avisamos una sola vez.
  useEffect(() => {
    if (cargando || asientos.length === 0 || seleccionados.size === 0) return
    const porId = new Map(asientos.map((a) => [a.id, a]))
    const validos = [...seleccionados].filter((id) => {
      const a = porId.get(id)
      return a && a.estado !== 'OCUPADO' && a.estado !== 'ocupado'
    })
    if (validos.length === seleccionados.size) return

    setSeleccionados(new Set(validos))
    onCambioRef.current?.(validos)
    const perdidas = [...seleccionados].filter((id) => !validos.includes(id))
      .map((id) => porId.get(id)?.numero ?? id)
    toast.error(`La silla ${perdidas.join(', ')} ya no está disponible. Elige otra.`)
  }, [asientos, cargando, seleccionados, toast])

  const estaSeleccionado = (idAsiento) => seleccionados.has(idAsiento)
  const estaOcupado = (a) => a.estado === 'OCUPADO' || a.estado === 'ocupado'

  const toggleAsiento = (idAsiento, asiento) => {
    if (estaOcupado(asiento)) return

    const siguiente = new Set(seleccionados)
    if (siguiente.has(idAsiento)) {
      siguiente.delete(idAsiento)
    } else {
      if (seleccionados.size >= maxSelecciones) {
        toast.info(`Solo puedes seleccionar ${maxSelecciones} asiento${maxSelecciones !== 1 ? 's' : ''}.`)
        return
      }
      siguiente.add(idAsiento)
    }
    setSeleccionados(siguiente)
    onCambio?.([...siguiente])
  }

  if (cargando) {
    return (
      <div className="asiento-mapa asiento-mapa--cargando">
        <div className="at-skeleton" />
      </div>
    )
  }

  // Agrupar asientos por fila y usar solo las columnas que realmente existen en este vuelo.
  const porFila = {}
  asientos.forEach((a) => {
    if (!porFila[a.fila]) porFila[a.fila] = []
    porFila[a.fila].push(a)
  })
  const filas = Object.keys(porFila).sort((a, b) => Number(a) - Number(b))
  const columnasPresentes = COLUMNAS.filter((columna) => asientos.some((a) => a.columna === columna))
  const posiciones = posicionesPara(columnasPresentes)
  // El pasillo va ANTES de D: A B C | D E F. En vuelos A-E viejos queda A B C | D E.
  const indicePasillo = columnasPresentes.indexOf('D')
  const nombreClase = clase === 'primera' ? 'primera clase' : clase === 'economica' ? 'económica' : 'todas las clases'

  return (
    <div className="asiento-mapa">
      <div className="asiento-mapa__leyenda">
        <div className="asiento-mapa__leyenda-grupo">
          <span className="asiento-mapa__leyenda-titulo">Estado</span>
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
        <div className="asiento-mapa__leyenda-grupo">
          <span className="asiento-mapa__leyenda-titulo">Posición</span>
          {Object.entries(GLIFOS).map(([posicion, glifo]) => (
            <div className="asiento-mapa__item" key={posicion}>
              <span className={`asiento-mapa__glifo ${posicion}`} aria-hidden="true">{glifo}</span>
              {capitalizar(posicion)}
            </div>
          ))}
        </div>
      </div>

      <p className="asiento-mapa__contador" aria-live="polite">
        {filas.length
          ? `${asientos.length} sillas · ${nombreClase} · filas ${filas[0]}–${filas[filas.length - 1]}`
          : 'No hay sillas disponibles en esta clase.'}
      </p>

      <div className="asiento-mapa__viewport">
        <div className="asiento-mapa__cabecera" aria-hidden="true">
          <span className="asiento-mapa__numero-fila" />
          {columnasPresentes.map((columna, indice) => (
            <Fragment key={columna}>
              {indice === indicePasillo && (
                <span className="asiento-mapa__pasillo"><span>Pasillo</span></span>
              )}
              <span className="asiento-mapa__letra">{columna}</span>
            </Fragment>
          ))}
        </div>

        <div className="asiento-mapa__grid">
          {filas.map((fila) => (
            <div key={fila} className="asiento-mapa__fila">
              <span className="asiento-mapa__numero-fila">{fila}</span>
              {columnasPresentes.map((columna, indice) => {
                const asiento = porFila[fila].find((a) => a.columna === columna)
                const posicion = posiciones[columna] ?? 'medio'
                const ocupado = asiento ? estaOcupado(asiento) : false
                const seleccionado = asiento ? estaSeleccionado(asiento.id) : false
                const estadoTexto = ocupado ? 'ocupada' : seleccionado ? 'tu selección' : 'disponible'
                return (
                  <Fragment key={columna}>
                    {indice === indicePasillo && (
                      <span className="asiento-mapa__pasillo" aria-hidden="true" />
                    )}
                    {asiento ? (
                      <>
                        <button
                          type="button"
                          className={`asiento-mapa__silla ${
                            seleccionado ? 'seleccionado' : ''
                          } ${ocupado ? 'ocupado' : 'disponible'}`}
                          disabled={ocupado}
                          onClick={() => !ocupado && toggleAsiento(asiento.id, asiento)}
                          title={`Silla ${asiento.numero} · ${capitalizar(posicion)} · ${asiento.clase} · ${capitalizar(estadoTexto)}`}
                          aria-describedby={`asiento-desc-${asiento.id}`}
                        >
                          {asiento.numero}
                          <span className={`asiento-mapa__glifo ${posicion}`} aria-hidden="true">
                            {GLIFOS[posicion]}
                          </span>
                        </button>
                        <span id={`asiento-desc-${asiento.id}`} className="asiento-mapa__sr-only">
                          {`Silla ${asiento.numero}, ${posicion}, ${asiento.clase}, ${estadoTexto}`}
                        </span>
                      </>
                    ) : (
                      <span className="asiento-mapa__vacio" />
                    )}
                  </Fragment>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {seleccionados.size > 0 && (
        <div className="asiento-mapa__resumen">
          Asientos seleccionados: {[...seleccionados].map((id) => {
            const a = asientos.find((x) => x.id === id)
            if (!a) return id
            const posicion = posiciones[a.columna] ?? 'medio'
            return `${a.numero} (${posicion})`
          }).join(', ')}
        </div>
      )}
    </div>
  )
}
