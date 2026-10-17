import { useState } from 'react'
import { Button, Card, Input, Notice, Select } from '@/components/ui'
import { ApiError } from '@/services/apiError'
import { TZ_COLOMBIA, clasificarVuelo, getCiudad } from '@/domain/ciudades'
import { CAPACIDAD_POR_TIPO, TIPO_LABEL } from '@/domain/estados'
import { ciudadesDeColombia, gruposDeCiudades } from '@/utils/ciudadesOpciones'
import { formatDateTime, formatDuration, formatPrice, timeToMinutes, todayISO } from '@/utils/format'

const INICIAL = { origen: '', destino: '', fecha: '', hora: '08:00', horas: '1', minutos: '30', costo: '' }

const duracionDe = (horas, minutos) => {
  const h = Number(horas)
  const m = Number(minutos)
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

/** Instante de salida: fecha y hora LOCALES de Colombia (el backend guarda UTC). */
function salidaISO(fecha, hora) {
  if (!fecha || timeToMinutes(hora) === null) return null
  const salida = new Date(`${fecha}T${hora}:00-05:00`)
  return Number.isNaN(salida.getTime()) ? null : salida.toISOString()
}

function validar(f) {
  const errores = {}
  if (!f.origen) errores.origen = 'Selecciona la ciudad de origen.'
  if (!f.destino) errores.destino = 'Selecciona la ciudad de destino.'
  else if (f.origen && f.origen === f.destino) errores.destino = 'El destino debe ser distinto del origen.'

  if (!f.fecha) errores.fecha = 'Indica la fecha de salida.'
  else if (f.fecha < todayISO()) errores.fecha = 'La fecha no puede ser anterior a hoy.'

  if (timeToMinutes(f.hora) === null) errores.hora = 'Indica una hora válida.'
  if (duracionDe(f.horas, f.minutos) <= 0) errores.horas = 'La duración debe ser mayor que cero.'

  const costo = Number(f.costo)
  if (!f.costo || !Number.isFinite(costo) || costo <= 0) errores.costo = 'El costo por persona debe ser mayor que cero.'

  // RF04–RF06: nacional entre capitales; internacional solo con una ciudad autorizada y una del exterior.
  if (f.origen && f.destino && f.origen !== f.destino && !errores.destino && clasificarVuelo(f.origen, f.destino) === null) {
    errores.destino = 'Combinación no permitida: un vuelo internacional solo une una ciudad autorizada de Colombia (Pereira, Bogotá, Medellín, Cali o Cartagena) con una ciudad del exterior.'
  }
  return errores
}

/**
 * HU18 — Programar un vuelo. El administrador solo digita origen, destino, fecha, hora,
 * duración y costo: el sistema genera el código consecutivo, la hora de llegada y los
 * cupos por clase (D3, D4). Los errores del backend (ApiError.fields) se pintan en cada campo.
 */
export default function VueloForm({ ciudades = [], onProgramar }) {
  const [f, setF] = useState(INICIAL)
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [enviando, setEnviando] = useState(false)

  const set = (campo) => (e) => setF((prev) => ({ ...prev, [campo]: e.target.value }))

  const origen = getCiudad(f.origen)
  const destino = getCiudad(f.destino)
  const tipo = clasificarVuelo(f.origen, f.destino)
  const salida = salidaISO(f.fecha, f.hora)
  const dur = duracionDe(f.horas, f.minutos)
  const llegada = salida && dur > 0 ? new Date(Date.parse(salida) + dur * 60_000).toISOString() : null

  async function enviar(e) {
    e.preventDefault()
    const problemas = validar(f)
    setErrores(problemas)
    setErrorGeneral('')
    if (Object.keys(problemas).length > 0) return

    setEnviando(true)
    try {
      await onProgramar({
        tipo,
        origen: f.origen,
        destino: f.destino,
        fecha: f.fecha,
        hora: f.hora,
        duracion: dur,
        costo: Number(f.costo),
      })
    } catch (err) {
      if (err instanceof ApiError) {
        setErrores(err.fields ?? {})
        setErrorGeneral(err.fields && Object.keys(err.fields).length > 0 ? '' : err.message)
      } else {
        setErrorGeneral(err.message)
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card as="form" className="vu-form" onSubmit={enviar} noValidate>
      <div className="vu-form__grid">
        <Select label="Origen" value={f.origen} onChange={set('origen')} error={errores.origen}
          options={ciudadesDeColombia(ciudades).map((c) => ({ value: c.codigo, label: `${c.nombre} (${c.codigo})` }))}
          placeholder="Selecciona una ciudad" />
        <Select label="Destino" value={f.destino} onChange={set('destino')} error={errores.destino}
          groups={gruposDeCiudades(ciudades)} placeholder="Selecciona una ciudad" />

        <Input label="Fecha de salida" type="date" min={todayISO()} value={f.fecha} onChange={set('fecha')} error={errores.fecha} />
        <Input label="Hora de salida (Colombia)" type="time" value={f.hora} onChange={set('hora')} error={errores.hora} />

        <Input label="Duración (horas)" type="number" min="0" max="23" value={f.horas} onChange={set('horas')} error={errores.horas} />
        <Input label="Duración (minutos)" type="number" min="0" max="59" step="5" value={f.minutos} onChange={set('minutos')} />

        <Input label="Costo por persona (COP)" type="number" min="1" step="1000" value={f.costo} onChange={set('costo')} error={errores.costo} />
      </div>

      {errorGeneral && <Notice tone="danger" className="mt-2">{errorGeneral}</Notice>}

      <div className="vu-form__preview" aria-live="polite">
        <p className="vu-form__preview-title">Vista previa</p>
        <dl className="vu-form__preview-grid">
          <div><dt>Tipo de vuelo</dt><dd>{tipo ? TIPO_LABEL[tipo] : '—'}</dd></div>
          <div><dt>Ruta</dt><dd>{origen && destino ? `${origen.nombre} → ${destino.nombre}` : '—'}</dd></div>
          <div><dt>Salida</dt><dd>{salida ? `${formatDateTime(salida, TZ_COLOMBIA)} (COT)` : '—'}</dd></div>
          <div><dt>Llegada estimada</dt><dd>{llegada ? `${formatDateTime(llegada, destino?.zona_horaria ?? TZ_COLOMBIA)} (hora local)` : '—'}</dd></div>
          <div><dt>Duración</dt><dd>{dur > 0 ? formatDuration(dur) : '—'}</dd></div>
          <div><dt>Costo</dt><dd>{f.costo ? formatPrice(Number(f.costo)) : '—'}</dd></div>
          <div>
            <dt>Cupos asignados por el sistema</dt>
            <dd>
              {tipo
                ? `Económica: ${CAPACIDAD_POR_TIPO[tipo].economica} · Primera: ${CAPACIDAD_POR_TIPO[tipo].primera}`
                : '—'}
            </dd>
          </div>
        </dl>
        <p className="vu-form__hint">
          El código consecutivo, la hora de llegada y los cupos por clase los genera AeroTiquetes al guardar.
        </p>
      </div>

      <div className="vu-form__actions">
        <Button type="submit" loading={enviando}>Programar vuelo</Button>
      </div>
    </Card>
  )
}
