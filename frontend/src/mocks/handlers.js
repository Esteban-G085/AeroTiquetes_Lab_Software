import { http, HttpResponse, delay } from 'msw'
import { CIUDADES_MOCK, VUELOS_MOCK, getVueloMock } from './data.js'
import { clasificarVuelo, getCiudad } from '../domain/ciudades.js'

const API = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')
const url = (path) => `${API}${path}`

function respuestaError(code, message, fields = null, status = 400) {
  return HttpResponse.json({ error: { code, message, fields } }, { status })
}

/** Fecha (yyyy-mm-dd) de un instante ISO en la zona horaria de Colombia. */
function fechaEnColombia(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(iso))
}

function ordenar(items, orden) {
  const copia = [...items]
  switch (orden) {
    case 'precio_asc':
      return copia.sort((a, b) => a.precio - b.precio)
    case 'precio_desc':
      return copia.sort((a, b) => b.precio - a.precio)
    case 'duracion_asc':
      return copia.sort((a, b) => a.duracion_min - b.duracion_min)
    case 'duracion_desc':
      return copia.sort((a, b) => b.duracion_min - a.duracion_min)
    case 'fecha_asc':
    default:
      return copia.sort((a, b) => new Date(a.fecha_hora_salida) - new Date(b.fecha_hora_salida))
  }
}

function filtrar(lista, params) {
  const origen = params.get('origen')
  const destino = params.get('destino')
  const fecha = params.get('fecha')
  const clase = params.get('clase')
  const precioMin = params.get('precio_min')
  const precioMax = params.get('precio_max')
  const duracionMax = params.get('duracion_max')
  const estado = params.get('estado')

  return lista.filter((v) => {
    if (origen && v.origen.codigo !== origen) return false
    if (destino && v.destino.codigo !== destino) return false
    if (fecha && fechaEnColombia(v.fecha_hora_salida) !== fecha) return false
    if (clase && (v.cupos?.[clase] ?? 0) <= 0) return false
    if (precioMin && v.precio < Number(precioMin)) return false
    if (precioMax && v.precio > Number(precioMax)) return false
    if (duracionMax && v.duracion_min > Number(duracionMax)) return false
    if (estado && v.estado !== estado) return false
    return true
  })
}

let siguienteConsecutivo = VUELOS_MOCK.length

function validarCreacion(body) {
  const fields = {}
  const origenCodigo = body.origen?.codigo ?? body.origen
  const destinoCodigo = body.destino?.codigo ?? body.destino

  if (!origenCodigo) fields.origen = 'El origen es obligatorio.'
  if (!destinoCodigo) fields.destino = 'El destino es obligatorio.'
  if (origenCodigo && destinoCodigo && !clasificarVuelo(origenCodigo, destinoCodigo)) {
    fields.destino = 'Combinación origen/destino no permitida (revisa las reglas de vuelos nacionales e internacionales).'
  }
  if (!body.fecha) fields.fecha = 'La fecha es obligatoria.'
  if (!body.hora) fields.hora = 'La hora es obligatoria.'
  if (!body.duracion_min || Number(body.fecha && body.hora ? body.duracion_min : 0) <= 0) {
    fields.duracion_min = 'La duración debe ser mayor a cero.'
  }
  if (body.precio === undefined || Number(body.precio) <= 0) {
    fields.precio = 'El costo por persona debe ser mayor que cero.'
  }
  if (body.cupos_economica != null && Number(body.cupos_economica) < 0) {
    fields.cupos_economica = 'Los cupos no pueden ser negativos.'
  }
  if (body.cupos_primera && Number(body.cupos_primera) < 0) {
    fields.cupos_primera = 'Los cupos no pueden ser negativos.'
  }
  if (body.cupos?.economica != null && Number(body.cupos.economica) < 0) {
    fields.cupos_economica = 'Los cupos no pueden ser negativos.'
  }
  if (body.cupos?.primera != null && Number(body.cupos.primera) < 0) {
    fields.cupos_primera = 'Los cupos no pueden ser negativos.'
  }
  return fields
}

export const handlers = [
  // Catálogo de ciudades (semilla)
  http.get(url('/ciudades'), async () => {
    await delay(150)
    return HttpResponse.json({ total: CIUDADES_MOCK.length, items: CIUDADES_MOCK })
  }),

  // HU05 — Búsqueda combinada de vuelos
  http.get(url('/vuelos/busqueda'), async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const encontrados = ordenar(filtrar(VUELOS_MOCK, searchParams), searchParams.get('orden'))
    await delay(250)
    return HttpResponse.json({ total: encontrados.length, items: encontrados })
  }),

  // HU19 — Listado para el panel de administración
  http.get(url('/vuelos'), async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const encontrados = ordenar(filtrar(VUELOS_MOCK, searchParams), searchParams.get('orden') ?? 'fecha_asc')
    await delay(250)
    return HttpResponse.json({ total: encontrados.length, items: encontrados })
  }),

  // HU05 / HU19 — Detalle de un vuelo
  http.get(url('/vuelos/:id'), async ({ params }) => {
    const vuelo = getVueloMock(params.id)
    await delay(200)
    if (!vuelo) return respuestaError('NO_ENCONTRADO', 'El vuelo no existe.', null, 404)
    return HttpResponse.json(vuelo)
  }),

  // HU18 — Programar vuelo
  http.post(url('/vuelos'), async ({ request }) => {
    const body = await request.json()
    const fields = validarCreacion(body)

    if (Object.keys(fields).length > 0) {
      return respuestaError('VALIDACION', 'Revisa los campos del formulario.', fields, 422)
    }

    const origenCodigo = body.origen?.codigo ?? body.origen
    const destinoCodigo = body.destino?.codigo ?? body.destino
    const salida = new Date(`${body.fecha}T${body.hora}:00-05:00`)
    const duracion = Number(body.duracion_min)
    const llegada = new Date(salida.getTime() + duracion * 60 * 1000)

    siguienteConsecutivo += 1
    const nuevo = {
      id: `vuelo-${siguienteConsecutivo}`,
      codigo: `AT-${String(siguienteConsecutivo).padStart(4, '0')}`,
      tipo: clasificarVuelo(origenCodigo, destinoCodigo),
      origen: getCiudad(origenCodigo),
      destino: getCiudad(destinoCodigo),
      duracion_min: duracion,
      fecha_hora_salida: salida.toISOString(),
      fecha_hora_llegada: llegada.toISOString(),
      precio: Number(body.precio),
      cupos: {
        economica: Number(body.cupos?.economica ?? body.cupos_economica ?? 0),
        primera: Number(body.cupos?.primera ?? body.cupos_primera ?? 0),
      },
      estado: 'programado',
      promocion: null,
    }

    VUELOS_MOCK.push(nuevo)
    await delay(300)
    return HttpResponse.json(nuevo, { status: 201 })
  }),
]
