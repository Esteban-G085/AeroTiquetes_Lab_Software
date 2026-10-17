import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '@/components/feedback'
import { Notice } from '@/components/ui'
import { PageHeader } from '@/components/layout'
import { useCiudades } from '@/utils/useCiudades'
import FlightResults from '../components/FlightResults'
import SearchForm from '../components/SearchForm'
import { buscarVuelos, FILTROS_VACIOS } from '../api'
import '../busqueda.css'

const filtrosDeLaUrl = (searchParams) => Object.fromEntries(searchParams.entries())

const sinVaciar = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined))

/** HU5 — Buscar y consultar vuelos (visitante y cliente). */
export default function BuscadorPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { ciudades, status: ciudadesStatus } = useCiudades()

  const [resultado, setResultado] = useState({ status: 'loading', vuelos: [], error: null })
  const [huboBusqueda, setHuboBusqueda] = useState(false)
  const [intento, setIntento] = useState(0)

  // Los criterios viven en la URL: el resultado se puede compartir o recargar sin perderse.
  const clave = searchParams.toString()

  useEffect(() => {
    let vivo = true
    const filtros = filtrosDeLaUrl(new URLSearchParams(clave))
    setResultado((r) => ({ ...r, status: 'loading', error: null }))
    buscarVuelos(filtros)
      .then(({ items }) => {
        if (!vivo) return
        setResultado({ status: 'ready', vuelos: items, error: null })
        setHuboBusqueda(true)
      })
      .catch((error) => { if (vivo) setResultado({ status: 'error', vuelos: [], error }) })
    return () => { vivo = false }
  }, [clave, intento])

  function buscar(filtros) {
    const limpio = sinVaciar(filtros)
    const siguiente = new URLSearchParams(limpio).toString()
    if (siguiente === clave) setIntento((n) => n + 1) // mismos criterios: reintentar la búsqueda
    else setSearchParams(limpio)
  }

  return (
    <div className="bu-page">
      <PageHeader
        eyebrow="Búsqueda de vuelos"
        title="Buscar vuelos"
        subtitle="Encuentra vuelos nacionales e internacionales combinando origen, destino, fecha, precio, duración y clase."
      />

      {ciudadesStatus === 'fallback' && (
        <Notice tone="info" className="mb-3">
          No pudimos actualizar el catálogo de ciudades con el servidor; mostramos el catálogo local.
        </Notice>
      )}

      <SearchForm
        ciudades={ciudades}
        valoresIniciales={{ ...FILTROS_VACIOS, ...filtrosDeLaUrl(searchParams) }}
        onBuscar={buscar}
        cargando={resultado.status === 'loading'}
      />

      <div className="bu-page__results">
        {resultado.status === 'loading' && <LoadingState label="Buscando vuelos…" />}
        {resultado.status === 'error' && (
          <ErrorState message={resultado.error?.message} onRetry={() => setIntento((n) => n + 1)} />
        )}
        {resultado.status === 'ready' && <FlightResults vuelos={resultado.vuelos} huboBusqueda={huboBusqueda} />}
      </div>
    </div>
  )
}
