import { http } from '@/services/http'

// Cliente de API de Compra y reserva (B1-12 … B1-15). Contrato real del backend: docs/CONTRATO_COMPRAS.md
//
// Las pantallas (F1) se construyeron contra la forma de docs/CONTRATO_SPRINT2.md: "un ítem = un vuelo", una compra o reserva
// por vuelo, ids numéricos, vuelo con `salida`/`precio`/`origen.ciudad`. El backend de B1 responde distinto
// (una operación con tiquetes de varios vuelos, `salida_utc`, `costo`…). Este archivo es el ÚNICO lugar que traduce entre
// las dos formas: las pantallas no cambian. Si el backend cambia, se toca aquí.

const trim = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]))

// ───────────────────────────── vuelos ─────────────────────────────

/** Vuelo del backend (VueloOut de B2 o VueloResumen de B1) → vuelo con la forma que usan las pantallas. */
export function adaptarVuelo(v, extra = {}) {
  const cupos = v.cupos_economica != null && v.cupos_primera != null ? v.cupos_economica + v.cupos_primera : undefined
  return {
    id: v.id,
    codigo: v.codigo,
    tipo: v.tipo,
    estado: v.estado,
    origen: { ciudad: v.origen?.nombre, codigo: v.origen?.codigo },
    destino: { ciudad: v.destino?.nombre, codigo: v.destino?.codigo },
    salida: v.salida_utc,
    llegada: v.llegada_utc,
    salida_zona: v.origen?.zona_horaria,
    llegada_zona: v.destino?.zona_horaria,
    duracion_min: v.duracion_min ?? Math.round((Date.parse(v.llegada_utc) - Date.parse(v.salida_utc)) / 60_000),
    precio: v.costo ?? extra.precio ?? 0,
    precio_primera: v.costo_primera ?? extra.precio_primera ?? v.costo ?? extra.precio ?? 0,
    moneda: 'COP',
    cupos_disponibles: cupos,
    tiquetes_cliente: v.tiquetes_cliente ?? 0,
    ...extra,
  }
}

/** GET /vuelos/{id} (B2) + GET /vuelos/{id}/mis-tiquetes (B1) → vuelo con `tiquetes_cliente` (activos de este cliente en ese vuelo). */
export async function obtenerVuelo(id) {
  const ruta = encodeURIComponent(id)
  const [vuelo, mios] = await Promise.all([
    http.get(`/vuelos/${ruta}`),
    http.get(`/vuelos/${ruta}/mis-tiquetes`).then((r) => r.data?.activos ?? 0).catch(() => 0),
  ])
  return adaptarVuelo(vuelo.data, { tiquetes_cliente: mios })
}

/** GET /vuelos/{id}/regreso → vuelos directos destino→origen posteriores a la llegada (trayecto completo). */
export async function listarVuelosRegreso(id) {
  const { data } = await http.get(`/vuelos/${encodeURIComponent(id)}/regreso`)
  return (Array.isArray(data) ? data : data?.items ?? []).map((v) => adaptarVuelo(v))
}

/** GET /mi-billetera → { saldo, moneda }. Solo se usa para validar el saldo antes de pagar. */
export async function obtenerSaldo() {
  const { data } = await http.get('/mi-billetera')
  return { saldo: data.saldo, moneda: 'COP' }
}

/** GET /me → datos del propio cliente, para el botón "Usar mis datos" del primer viajero. */
export async function obtenerMisDatos() {
  const { data } = await http.get('/me')
  return data
}

// ───────────────────────────── cuerpo de la solicitud ─────────────────────────────

const viajeroAlBackend = (v) => {
  const { contacto_nombre, contacto_telefono, ...resto } = trim(v)
  return { ...resto, nombre_contacto: contacto_nombre, telefono_contacto: contacto_telefono }
}

/** Ítems del carrito (uno por vuelo) → cuerpo de POST /reservas y POST /compras. */
const toPayload = (items) => ({
  items: items.map((i) => ({
    trayecto: 'unico',
    vuelo_id: i.vuelo.id,
    clase: i.clase,
    viajeros: i.viajeros.map(viajeroAlBackend),
    ...(i.asientos && i.asientos.length ? { asientos: i.asientos } : {}),
  })),
})

const CAMPOS_DEL_FORMULARIO = { nombre_contacto: 'contacto_nombre', telefono_contacto: 'contacto_telefono' }
const normalizarDocumento = (d) => String(d ?? '').replace(/[\s.-]/g, '').toUpperCase()

/**
 * Los errores por campo del backend llegan como `items.0.viajeros.1.correo` o `documento`; las pantallas esperan
 * `viajeros.1.correo`. Solo se reescriben cuando la solicitud tenía un ítem (si hay varios no se sabe de cuál habla).
 */
export function adaptarError(err, items) {
  if (!err || typeof err !== 'object' || !err.fields || items.length !== 1) return err
  const viajeros = items[0].viajeros ?? []
  const campos = {}
  for (const [clave, mensaje] of Object.entries(err.fields)) {
    const m = /^items\.\d+\.viajeros\.(\d+)\.(\w+)$/.exec(clave)
    if (m) {
      campos[`viajeros.${m[1]}.${CAMPOS_DEL_FORMULARIO[m[2]] ?? m[2]}`] = mensaje
    } else if (clave === 'documento') {
      const buscado = normalizarDocumento(String(mensaje).split(' ')[0])
      const idx = viajeros.findIndex((v) => normalizarDocumento(v.documento) === buscado)
      campos[idx >= 0 ? `viajeros.${idx}.documento` : clave] = mensaje
    } else {
      campos[clave] = mensaje
    }
  }
  err.fields = campos
  return err
}

// ───────────────────────────── respuestas ─────────────────────────────

/** id de un grupo: `${idOperación}:${idsTiquetes}`. Permite cancelar solo los tiquetes de ese vuelo sin guardar estado. */
const idGrupo = (op, tiquetes) => `${op.id}:${tiquetes.map((t) => t.id).join(',')}`
const idOperacion = (id) => Number.parseInt(String(id), 10)
const idsTiquetes = (id) => (String(id).split(':')[1] ?? '').split(',').filter(Boolean).map(Number)

/**
 * Una operación del backend (reserva o compra, con tiquetes de uno o varios vuelos) → lista de "grupos", uno por vuelo,
 * que es lo que muestran las pantallas como una compra o una reserva.
 */
export function agruparOperacion(op) {
  const porVuelo = new Map()
  for (const t of op.tiquetes ?? []) {
    const clave = `${t.vuelo.id}|${t.clase}`
    if (!porVuelo.has(clave)) porVuelo.set(clave, [])
    porVuelo.get(clave).push(t)
  }
  const esCompra = op.tipo === 'compra'
  return [...porVuelo.values()].map((todos) => {
    const activos = todos.filter((t) => t.estado !== 'cancelado' && t.estado !== 'vencido')
    const mostrados = activos.length ? activos : todos
    const primero = todos[0]
    // El precio del tiquete ya corresponde a su clase: se replica en ambos campos para que
    // `precioParaClase` no vuelva a consultar la tarifa general del vuelo en el historial.
    const vuelo = adaptarVuelo(primero.vuelo, { precio: primero.precio, precio_primera: primero.precio })
    let estado
    if (esCompra) {
      estado = !activos.length ? 'cancelada' : ['sucedido', 'realizado'].includes(vuelo.estado) ? 'realizada' : 'confirmada'
    } else {
      estado = op.estado === 'comprada' ? 'cancelada' : op.estado
    }
    const total = mostrados.reduce((suma, t) => suma + t.precio, 0)
    return {
      id: idGrupo(op, mostrados),
      vuelo,
      clase: primero.clase,
      estado,
      creada_en: op.creada_en,
      expira_en: op.expira_en,
      total,
      ...(esCompra && estado === 'cancelada' ? { reintegro: total } : {}),
      tiquetes: mostrados.map((t) => ({
        id: t.id,
        codigo_reserva: t.codigo_reserva,
        silla: t.numero_silla ?? undefined,
        viajero: t.viajero,
      })),
    }
  })
}

const correosDe = (op) => [...new Set((op.tiquetes ?? []).map((t) => t.viajero?.correo).filter(Boolean))].join(', ')

// ───────────────────────────── llamadas ─────────────────────────────

/**
 * POST /reservas (una por ítem: cada vuelo se reserva, se paga y se cancela por separado) → { reservas: [...] }.
 * Si falla una de varias, se cancelan las ya creadas para no dejar reservas sueltas.
 */
export async function crearReserva(items) {
  const creadas = []
  try {
    for (const item of items) {
      const { data } = await http.post('/reservas', toPayload([item]))
      creadas.push(data)
    }
  } catch (err) {
    await Promise.allSettled(creadas.map((r) => http.post(`/reservas/${r.id}/cancelar`)))
    throw adaptarError(err, items)
  }
  return { reservas: creadas.flatMap(agruparOperacion) }
}

/** POST /compras (todo el carrito en una sola operación atómica) → { compras: [...], total, saldo, correo }. */
export async function crearCompra(items) {
  let data
  try {
    ;({ data } = await http.post('/compras', toPayload(items)))
  } catch (err) {
    throw adaptarError(err, items)
  }
  const { saldo } = await obtenerSaldo()
  return { compras: agruparOperacion(data), total: data.total, saldo, correo: correosDe(data) }
}

const TAMANO_PAGINA = 50
const MAX_PAGINAS = 20

async function todasLasOperaciones(tipo) {
  const items = []
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina += 1) {
    const { data } = await http.get('/mi-historial', { params: { tipo, pagina, tamano: TAMANO_PAGINA } })
    items.push(...(data?.items ?? []))
    if (!data?.items?.length || items.length >= (data?.total ?? 0)) break
  }
  return items
}

/** GET /mi-historial (compras y reservas por separado, todas las páginas) → { compras: [...], reservas: [...] }. */
export async function obtenerHistorial() {
  const [compras, reservas] = await Promise.all([todasLasOperaciones('compra'), todasLasOperaciones('reserva')])
  return { compras: compras.flatMap(agruparOperacion), reservas: reservas.flatMap(agruparOperacion) }
}

/** POST /compras/{id}/cancelar con los tiquetes de ese vuelo → { reintegro, saldo }. Hasta 1 h antes; reintegra a la billetera. */
export async function cancelarCompra(id) {
  const { data } = await http.post(`/compras/${idOperacion(id)}/cancelar`, { tiquete_ids: idsTiquetes(id) })
  return { reintegro: data.reintegro, saldo: data.saldo }
}

/** POST /reservas/{id}/cancelar. Solo dentro de las 24 h de vigencia. */
export async function cancelarReserva(id) {
  const { data } = await http.post(`/reservas/${idOperacion(id)}/cancelar`)
  return data
}

/** POST /reservas/{id}/comprar → { compra, saldo }. Convierte la reserva en compra (mismos tiquetes y códigos). */
export async function pagarReserva(id) {
  const { data } = await http.post(`/reservas/${idOperacion(id)}/comprar`)
  const { saldo } = await obtenerSaldo()
  return { compra: agruparOperacion(data)[0], saldo }
}
