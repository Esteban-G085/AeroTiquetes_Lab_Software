import { http } from '@/services/http'

// Cliente de API del módulo Usuarios. Los nombres de campo del formulario coinciden
// 1 a 1 con los del backend, de modo que ApiError.fields se pinta directo en cada input.
// Contrato acordado con B1: ver docs/CONTRATO_USUARIOS.md

// Estos campos son secretos: nunca se recortan (los espacios cuentan).
const NO_TRIM = ['password', 'password_actual', 'password_nueva']

/** multipart/form-data: campos de texto (+ `imagen` opcional). Todo se recorta salvo contraseñas. */
export function buildFormData(values, imagen) {
  const form = new FormData()
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue
    form.append(key, NO_TRIM.includes(key) ? value : String(value).trim())
  }
  if (imagen) form.append('imagen', imagen)
  return form
}
export const buildPersonalDataFormData = buildFormData

/**
 * Catálogo de países habilitados para `lugar_nacimiento` (HU4 / HU23).
 * El backend es la autoridad: rechaza cualquier valor que no esté en esta lista.
 */
export async function listarPaises() {
  const { data } = await http.get('/catalogos/paises')
  return Array.isArray(data) ? data : []
}

/** HU4 — POST /auth/registro */
export async function registrarCliente(values, imagen) {
  const { data } = await http.post('/auth/registro', buildFormData(values, imagen))
  return data
}

/** HU2 — GET /me. Root recibe solo { id, rol, ... } (sin datos personales). */
export async function obtenerPerfil() {
  const { data } = await http.get('/me')
  return data
}

/** HU2 — PUT /me con los datos editables y/o la foto. El documento nunca se envía. */
export async function actualizarPerfil(values, imagen) {
  const { data } = await http.put('/me', buildFormData(values, imagen))
  return data
}

/**
 * HU2 / D8 — Cambio de correo: el backend manda un enlace al correo NUEVO y exige la contraseña actual.
 * El correo no cambia hasta confirmar el enlace (el perfil trae `correo_pendiente` mientras tanto).
 */
export async function solicitarCambioCorreo({ correo_nuevo, password_actual }) {
  const { data } = await http.put('/me', buildFormData({ correo_nuevo, password_actual }))
  return data
}

/**
 * HU2 / D8 — Confirmación del cambio de correo: POST /auth/verificar-correo { token }.
 * El enlace llega al correo NUEVO, que puede no ser el de la sesión, así que el backend
 * no exige token. Falla (400) si el token venció, ya se usó o no hay un cambio pendiente.
 */
export async function verificarCorreo(token) {
  const { data } = await http.post('/auth/verificar-correo', { token })
  return data
}

/** HU3 — PUT /me/password */
export async function cambiarPassword({ password_actual, password_nueva }) {
  const { data } = await http.put('/me/password', { password_actual, password_nueva })
  return data
}

// ---- Root: administradores (HU23) ----

const asList = (data) => (Array.isArray(data) ? data : data?.items ?? [])

/** GET /root/administradores -> [{ id, nombre, correo, estado: 'activo' | 'pendiente', imagen_url }] */
export async function listarAdministradores() {
  const { data } = await http.get('/root/administradores')
  return asList(data)
}

/** POST /root/administradores { nombre, correo } -> el backend envía el enlace de primer ingreso (48 h, un solo uso). */
export async function crearAdministrador({ nombre, correo }) {
  const { data } = await http.post('/root/administradores', { nombre: nombre.trim(), correo: correo.trim() })
  return data
}

/** DELETE /root/administradores/{id}. No hay edición (R21). */
export async function eliminarAdministrador(id) {
  await http.delete(`/root/administradores/${encodeURIComponent(id)}`)
}

// ---- Primer ingreso del administrador (HU23 / D6) ----

/** GET /auth/completar-registro?token= -> { correo, nombre }. Falla (404/410) si el enlace venció o ya se usó. */
export async function validarInvitacion(token) {
  const { data } = await http.get('/auth/completar-registro', { params: { token } })
  return data
}

/** POST /auth/completar-registro (multipart): mismos campos del registro + token. Activa al administrador. */
export async function completarRegistro(token, values, imagen) {
  const form = buildFormData(values, imagen)
  form.append('token', token)
  const { data } = await http.post('/auth/completar-registro', form)
  return data
}

// ---- Root: matriz de roles (HU24 / P2) ----

/**
 * GET /root/roles ->
 *   { modulos: [{ id, nombre }],
 *     roles:   [{ id, nombre, descripcion?, editable, modulos: { [moduloId]: boolean } }] }
 */
export async function obtenerRoles() {
  const { data } = await http.get('/root/roles')
  return { modulos: data?.modulos ?? [], roles: data?.roles ?? [] }
}

/** PUT /root/roles { roles: [{ id, modulos: { [moduloId]: boolean } }] } — solo los roles que cambiaron. */
export async function guardarRoles(roles) {
  const { data } = await http.put('/root/roles', { roles })
  return data
}
