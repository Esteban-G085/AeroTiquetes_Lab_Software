import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import VuelosTable from '../components/VuelosTable.jsx'
import Spinner from '../../../components/ui/Spinner.jsx'
import ErrorAlert from '../../../components/ui/ErrorAlert.jsx'
import EmptyState from '../../../components/ui/EmptyState.jsx'
import useCiudades from '../../../hooks/useCiudades.js'
import { listarVuelos } from '../services/vuelosService.js'
import { ESTADO_OPCIONES } from '../../../domain/estados.js'

export default function VuelosAdminPage() {
  const { ciudades } = useCiudades()
  const [filtros, setFiltros] = useState({ estado: '', origen: '', destino: '' })
  const [vuelos, setVuelos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [reintento, setReintento] = useState(0)

  const clave = JSON.stringify(filtros)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    setError(null)
    listarVuelos(JSON.parse(clave))
      .then((data) => {
        if (vivo) setVuelos(data.items ?? [])
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

  function set(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }))
  }

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h1 className="h3 mb-0">Panel de vuelos</h1>
          <p className="texto-suave mb-0">Consulta de vuelos programados (solo lectura).</p>
        </div>
        <Link className="btn btn-primary" to="/admin/vuelos/nuevo">+ Programar vuelo</Link>
      </div>

      <div className="at-card p-3 mb-3">
        <div className="row g-3">
          <div className="col-12 col-md-4">
            <label className="form-label" htmlFor="f-estado">Estado</label>
            <select id="f-estado" className="form-select" value={filtros.estado} onChange={(e) => set('estado', e.target.value)}>
              <option value="">Todos</option>
              {ESTADO_OPCIONES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label" htmlFor="f-origen">Origen</label>
            <select id="f-origen" className="form-select" value={filtros.origen} onChange={(e) => set('origen', e.target.value)}>
              <option value="">Cualquiera</option>
              {ciudades.map((c) => (
                <option key={c.codigo} value={c.codigo}>{c.nombre} ({c.codigo})</option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label" htmlFor="f-destino">Destino</label>
            <select id="f-destino" className="form-select" value={filtros.destino} onChange={(e) => set('destino', e.target.value)}>
              <option value="">Cualquiera</option>
              {ciudades.map((c) => (
                <option key={c.codigo} value={c.codigo}>{c.nombre} ({c.codigo})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {cargando && <Spinner texto="Cargando vuelos…" />}
      {!cargando && error && <ErrorAlert error={error} onReintentar={() => setReintento((n) => n + 1)} />}
      {!cargando && !error && vuelos.length === 0 && (
        <EmptyState icono="🗂️" titulo="No hay vuelos" mensaje="No se encontraron vuelos con los filtros seleccionados." />
      )}
      {!cargando && !error && vuelos.length > 0 && <VuelosTable vuelos={vuelos} />}
    </div>
  )
}
