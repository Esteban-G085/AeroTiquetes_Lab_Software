import { useState } from 'react'
import { ORDEN_BUSQUEDA, CLASE_OPCIONES } from '../../../domain/estados.js'
import { hoyISO } from '../../../utils/fecha.js'

const VACIO = {
  origen: '',
  destino: '',
  fecha: '',
  clase: '',
  precio_min: '',
  precio_max: '',
  duracion_max: '',
  orden: 'fecha_asc',
}

/**
 * Formulario de búsqueda combinada de vuelos (HU05, RF01–RF15 del módulo Búsqueda).
 */
export default function SearchForm({ ciudades, valoresIniciales, onBuscar, cargando }) {
  const [filtros, setFiltros] = useState({ ...VACIO, ...valoresIniciales })
  const [error, setError] = useState(null)

  const nacionales = ciudades.filter((c) => c.tipo === 'nacional')
  const internacionales = ciudades.filter((c) => c.tipo === 'internacional')

  function set(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }))
  }

  function enviar(e) {
    e.preventDefault()
    if (filtros.origen && filtros.destino && filtros.origen === filtros.destino) {
      setError('El origen y el destino no pueden ser la misma ciudad.')
      return
    }
    if (filtros.precio_min && filtros.precio_max && Number(filtros.precio_min) > Number(filtros.precio_max)) {
      setError('El precio mínimo no puede ser mayor que el máximo.')
      return
    }
    setError(null)
    onBuscar(filtros)
  }

  function limpiar() {
    setFiltros({ ...VACIO })
    setError(null)
    onBuscar({ ...VACIO })
  }

  return (
    <form className="at-card p-3 p-md-4" onSubmit={enviar}>
      <div className="row g-3">
        <div className="col-12 col-md-6 col-lg-3">
          <label className="form-label" htmlFor="origen">Origen</label>
          <select id="origen" className="form-select" value={filtros.origen} onChange={(e) => set('origen', e.target.value)}>
            <option value="">Cualquiera</option>
            <optgroup label="Colombia (nacional)">
              {nacionales.map((c) => (
                <option key={c.codigo} value={c.codigo}>{c.nombre} ({c.codigo})</option>
              ))}
            </optgroup>
            <optgroup label="Internacional">
              {internacionales.map((c) => (
                <option key={c.codigo} value={c.codigo}>{c.nombre} ({c.codigo})</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="col-12 col-md-6 col-lg-3">
          <label className="form-label" htmlFor="destino">Destino</label>
          <select id="destino" className="form-select" value={filtros.destino} onChange={(e) => set('destino', e.target.value)}>
            <option value="">Cualquiera</option>
            <optgroup label="Colombia (nacional)">
              {nacionales.map((c) => (
                <option key={c.codigo} value={c.codigo}>{c.nombre} ({c.codigo})</option>
              ))}
            </optgroup>
            <optgroup label="Internacional">
              {internacionales.map((c) => (
                <option key={c.codigo} value={c.codigo}>{c.nombre} ({c.codigo})</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="col-6 col-md-3 col-lg-2">
          <label className="form-label" htmlFor="fecha">Fecha de salida</label>
          <input
            id="fecha"
            type="date"
            className="form-control"
            min={hoyISO()}
            value={filtros.fecha}
            onChange={(e) => set('fecha', e.target.value)}
          />
        </div>

        <div className="col-6 col-md-3 col-lg-2">
          <label className="form-label" htmlFor="clase">Clase</label>
          <select id="clase" className="form-select" value={filtros.clase} onChange={(e) => set('clase', e.target.value)}>
            <option value="">Cualquiera</option>
            {CLASE_OPCIONES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="col-6 col-md-3 col-lg-2">
          <label className="form-label" htmlFor="orden">Ordenar por</label>
          <select id="orden" className="form-select" value={filtros.orden} onChange={(e) => set('orden', e.target.value)}>
            {ORDEN_BUSQUEDA.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="col-6 col-md-3 col-lg-3">
          <label className="form-label" htmlFor="precio_min">Precio mínimo (COP)</label>
          <input
            id="precio_min"
            type="number"
            min="0"
            step="10000"
            className="form-control"
            placeholder="0"
            value={filtros.precio_min}
            onChange={(e) => set('precio_min', e.target.value)}
          />
        </div>

        <div className="col-6 col-md-3 col-lg-3">
          <label className="form-label" htmlFor="precio_max">Precio máximo (COP)</label>
          <input
            id="precio_max"
            type="number"
            min="0"
            step="10000"
            className="form-control"
            placeholder="Sin límite"
            value={filtros.precio_max}
            onChange={(e) => set('precio_max', e.target.value)}
          />
        </div>

        <div className="col-6 col-md-3 col-lg-3">
          <label className="form-label" htmlFor="duracion_max">Duración máxima (min)</label>
          <input
            id="duracion_max"
            type="number"
            min="0"
            step="15"
            className="form-control"
            placeholder="Sin límite"
            value={filtros.duracion_max}
            onChange={(e) => set('duracion_max', e.target.value)}
          />
        </div>
      </div>

      {error && <div className="alert alert-warning mt-3 mb-0 py-2">{error}</div>}

      <div className="d-flex gap-2 mt-3">
        <button type="submit" className="btn btn-primary" disabled={cargando}>
          {cargando ? 'Buscando…' : 'Buscar vuelos'}
        </button>
        <button type="button" className="btn btn-outline-secondary" onClick={limpiar} disabled={cargando}>
          Limpiar
        </button>
      </div>
    </form>
  )
}
