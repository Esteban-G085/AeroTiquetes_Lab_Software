import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import SearchForm from '../components/SearchForm.jsx'
import FlightResults from '../components/FlightResults.jsx'
import Spinner from '../../../components/ui/Spinner.jsx'
import ErrorAlert from '../../../components/ui/ErrorAlert.jsx'
import useCiudades from '../../../hooks/useCiudades.js'
import { buscarVuelos } from '../services/busquedaService.js'

function leerFiltros(searchParams) {
  return Object.fromEntries(searchParams.entries())
}

export default function BuscarVuelosPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { ciudades } = useCiudades()

  const [vuelos, setVuelos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [huboBusqueda, setHuboBusqueda] = useState(false)
  const [reintento, setReintento] = useState(0)

  const clave = searchParams.toString()

  useEffect(() => {
    let vivo = true
    const filtros = leerFiltros(new URLSearchParams(clave))
    setError(null)
    buscarVuelos(filtros)
      .then((data) => {
        if (!vivo) return
        setVuelos(data.items ?? [])
        setHuboBusqueda(true)
      })
      .catch((e) => {
        if (vivo) setError(e)
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
  }, [clave, reintento])

  function buscar(filtros) {
    const limpio = Object.fromEntries(
      Object.entries(filtros).filter(([, v]) => v !== '' && v !== null && v !== undefined),
    )
    setSearchParams(limpio)
  }

  const filtrosIniciales = leerFiltros(new URLSearchParams(clave))

  return (
    <div>
      <div className="at-hero p-4 p-md-5 mb-4">
        <h1 className="h3 mb-1">Busca tu vuelo</h1>
        <p className="mb-0 text-white-50">
          Encuentra vuelos nacionales e internacionales combinando origen, destino, fecha, precio, duración y clase.
        </p>
      </div>

      <SearchForm
        ciudades={ciudades}
        valoresIniciales={filtrosIniciales}
        onBuscar={buscar}
        cargando={cargando}
      />

      <div className="mt-4">
        {cargando && <Spinner texto="Buscando vuelos…" />}
        {!cargando && error && (
          <ErrorAlert error={error} onReintentar={() => setReintento((n) => n + 1)} />
        )}
        {!cargando && !error && <FlightResults vuelos={vuelos} huboBusqueda={huboBusqueda} />}
      </div>
    </div>
  )
}
