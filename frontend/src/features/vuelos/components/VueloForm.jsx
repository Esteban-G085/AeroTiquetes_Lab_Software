import { useMemo, useState } from 'react'
import { clasificarVuelo, getCiudad } from '../../../domain/ciudades.js'
import { TIPO_LABEL } from '../../../domain/estados.js'
import { formatFechaHora, formatDuracion, hoyISO } from '../../../utils/fecha.js'
import { formatCOP } from '../../../utils/moneda.js'
import { extraerError } from '../../../utils/errores.js'

const INICIAL = {
  origen: '',
  destino: '',
  fecha: '',
  hora: '08:00',
  horas: '1',
  minutos: '30',
  precio: '',
  cupos_economica: '100',
  cupos_primera: '10',
}

/** Instante de salida en UTC a partir de fecha/hora local de Colombia. */
function calcularSalida(fecha, hora) {
  if (!fecha || !hora) return null
  const salida = new Date(`${fecha}T${hora}:00-05:00`)
  return Number.isNaN(salida.getTime()) ? null : salida
}

function calcularLlegada(salida, duracionMin) {
  if (!salida || !Number.isFinite(duracionMin) || duracionMin <= 0) return null
  return new Date(salida.getTime() + duracionMin * 60 * 1000)
}

export default function VueloForm({ ciudades, onSubmit, enviando = false }) {
  const [valores, setValores] = useState(INICIAL)
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState(null)

  const nacionales = ciudades.filter((c) => c.tipo === 'nacional')
  const internacionales = ciudades.filter((c) => c.tipo === 'internacional')

  const duracionMin = (Number(valores.horas) || 0) * 60 + (Number(valores.minutos) || 0)
  const tipo = useMemo(() => clasificarVuelo(valores.origen, valores.destino), [valores.origen, valores.destino])
  const origenCiudad = getCiudad(valores.origen)
  const destinoCiudad = getCiudad(valores.destino)

  const salida = valores.fecha && valores.hora ? new Date(`${valores.fecha}T${valores.hora}:00-05:00`) : null
  const llegada = salida && duracionMin > 0 ? new Date(salida.getTime() + duracionMin * 60000) : null

  function set(campo, valor) {
    setValores((v) => ({ ...v, [campo]: valor }))
    setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  const invalido = (campo) => (errores[campo] ? 'is-invalid' : '')

  function validar() {
    const e = {}
    if (!valores.origen) e.origen = 'Selecciona el origen.'
    if (!valores.destino) e.destino = 'Selecciona el destino.'
    if (valores.origen && valores.destino && valores.origen === valores.destino) {
      e.destino = 'El destino debe ser distinto del origen.'
    }
    if (valores.origen && valores.destino && valores.origen !== valores.destino && !tipo) {
      e.destino = 'Combinación no permitida: los vuelos internacionales salen solo desde Pereira, Bogotá, Medellín, Cali o Cartagena.'
    }
    if (!valores.fecha) e.fecha = 'Selecciona la fecha.'
    if (!valores.hora) e.hora = 'Selecciona la hora.'
    if (!(duracionMin > 0)) e.duracion = 'La duración debe ser mayor a 0.'
    if (!(Number(valores.precio) > 0)) e.precio = 'Ingresa un precio válido (mayor a 0).'
    if (valores.cupos_economica === '' || Number(valores.cupos_economica) < 0) e.cupos_economica = 'Cupos inválidos.'
    if (valores.cupos_primera === '' || Number(valores.cupos_primera) < 0) e.cupos_primera = 'Cupos inválidos.'
    return e
  }

  async function manejarEnvio(ev) {
    ev.preventDefault()
    setErrorGeneral(null)
    const e = validar()
    if (Object.keys(e).length > 0) {
      setErrores(e)
      return
    }
    const payload = {
      tipo,
      origen: valores.origen,
      destino: valores.destino,
      fecha: valores.fecha,
      hora: valores.hora,
      duracion_min: duracionMin,
      precio: Number(valores.precio),
      cupos: {
        economica: Number(valores.cupos_economica),
        primera: Number(valores.cupos_primera),
      },
    }
    try {
      await onSubmit(payload)
    } catch (err) {
      const { message, fields } = extraerError(err)
      setErrorGeneral(message)
      if (fields) setErrores(fields)
    }
  }

  return (
    <form className="at-card p-4" onSubmit={manejarEnvio} noValidate>
      {errorGeneral && <div className="alert alert-danger py-2">{errorGeneral}</div>}

      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="v-origen">Origen *</label>
          <select
            id="v-origen"
            className={`form-select ${invalido('origen')}`}
            value={valores.origen}
            onChange={(e) => set('origen', e.target.value)}
          >
            <option value="">Selecciona una ciudad…</option>
            <optgroup label="Colombia (nacional)">
              {nacionales.map((c) => (
                <option key={c.codigo} value={c.codigo}>{c.nombre} ({c.codigo})</option>
              ))}
            </optgroup>
          </select>
          {errores.origen && <div className="invalid-feedback d-block">{errores.origen}</div>}
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="v-destino">Destino *</label>
          <select
            id="v-destino"
            className={`form-select ${invalido('destino')}`}
            value={valores.destino}
            onChange={(e) => set('destino', e.target.value)}
          >
            <option value="">Selecciona una ciudad…</option>
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
          {errores.destino && <div className="invalid-feedback d-block">{errores.destino}</div>}
        </div>

        <div className="col-12">
          <div className="texto-suave small">
            Tipo de vuelo:{' '}
            {tipo ? <span className="badge text-bg-light border">{TIPO_LABEL[tipo]}</span> : <em>por determinar (según origen y destino)</em>}
          </div>
        </div>

        <div className="col-6 col-md-3">
          <label className="form-label" htmlFor="v-fecha">Fecha *</label>
          <input
            id="v-fecha"
            type="date"
            min={hoyISO()}
            className={`form-control ${invalido('fecha')}`}
            value={valores.fecha}
            onChange={(e) => set('fecha', e.target.value)}
          />
          {errores.fecha && <div className="invalid-feedback d-block">{errores.fecha}</div>}
        </div>

        <div className="col-6 col-md-3">
          <label className="form-label" htmlFor="v-hora">Hora de salida *</label>
          <input
            id="v-hora"
            type="time"
            className={`form-control ${invalido('hora')}`}
            value={valores.hora}
            onChange={(e) => set('hora', e.target.value)}
          />
          {errores.hora && <div className="invalid-feedback d-block">{errores.hora}</div>}
        </div>

        <div className="col-6 col-md-3">
          <label className="form-label" htmlFor="v-horas">Duración (horas)</label>
          <input
            id="v-horas"
            type="number"
            min="0"
            max="30"
            className={`form-control ${invalido('duracion')}`}
            value={valores.horas}
            onChange={(e) => set('horas', e.target.value)}
          />
        </div>

        <div className="col-6 col-md-3">
          <label className="form-label" htmlFor="v-minutos">Duración (minutos)</label>
          <input
            id="v-minutos"
            type="number"
            min="0"
            max="59"
            className={`form-control ${invalido('duracion')}`}
            value={valores.minutos}
            onChange={(e) => set('minutos', e.target.value)}
          />
          {errores.duracion && <div className="invalid-feedback d-block">{errores.duracion}</div>}
        </div>

        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor="v-precio">Costo por persona (COP) *</label>
          <input
            id="v-precio"
            type="number"
            min="0"
            step="10000"
            className={`form-control ${invalido('precio')}`}
            value={valores.precio}
            onChange={(e) => set('precio', e.target.value)}
          />
          {errores.precio && <div className="invalid-feedback d-block">{errores.precio}</div>}
        </div>

        <div className="col-6 col-md-4">
          <label className="form-label" htmlFor="v-cupos-econ">Cupos clase económica *</label>
          <input
            id="v-cupos-econ"
            type="number"
            min="0"
            className={`form-control ${invalido('cupos_economica')}`}
            value={valores.cupos_economica}
            onChange={(e) => set('cupos_economica', e.target.value)}
          />
          {errores.cupos_economica && <div className="invalid-feedback d-block">{errores.cupos_economica}</div>}
        </div>

        <div className="col-6 col-md-4">
          <label className="form-label" htmlFor="v-cupos-prim">Cupos primera clase *</label>
          <input
            id="v-cupos-prim"
            type="number"
            min="0"
            className={`form-control ${invalido('cupos_primera')}`}
            value={valores.cupos_primera}
            onChange={(e) => set('cupos_primera', e.target.value)}
          />
          {errores.cupos_primera && <div className="invalid-feedback d-block">{errores.cupos_primera}</div>}
        </div>
      </div>

      {tipo && salida && llegada && (
        <div className="alert alert-info mt-3 mb-0">
          <div className="fw-semibold mb-1">
            Vista previa · {origenCiudad?.nombre} ({origenCiudad?.codigo}) → {destinoCiudad?.nombre} ({destinoCiudad?.codigo})
          </div>
          <div className="small">
            Salida: {formatFechaHora(salida, origenCiudad?.zona_horaria)}
          </div>
          <div className="small">
            Llegada (hora local del destino): {formatFechaHora(llegada, destinoCiudad?.zona_horaria)}
          </div>
          <div className="small">
            Duración: {formatDuracion(duracionMin)} · Precio: {formatCOP(Number(valores.precio) || 0)}
          </div>
        </div>
      )}

      <div className="d-flex gap-2 mt-3">
        <button type="submit" className="btn btn-primary" disabled={enviando}>
          {enviando ? 'Programando…' : 'Programar vuelo'}
        </button>
      </div>
    </form>
  )
}
