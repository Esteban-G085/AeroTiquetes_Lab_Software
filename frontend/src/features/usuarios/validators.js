// Reglas de validación del formulario de datos personales (HU4 y HU23 "completar registro").
// Son espejo de las del backend para dar respuesta inmediata; el backend sigue siendo la autoridad.
// Si B1 ajusta una regla, se cambia SOLO aquí.

export const GENEROS = [
  { value: 'femenino', label: 'Femenino' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'otro', label: 'Otro' },
]

export const IMAGE_MAX_BYTES = 2 * 1024 * 1024 // D10: JPG/PNG ≤ 2 MB
export const IMAGE_TYPES = ['image/jpeg', 'image/png']

export const EMPTY_PERSONAL_DATA = Object.freeze({
  dni: '', nombres: '', apellidos: '', fecha_nacimiento: '', lugar_nacimiento: '',
  direccion_facturacion: '', genero: '', correo: '', usuario: '', password: '',
})

const REQUIRED = 'Este campo es obligatorio.'
const text = (v) => String(v ?? '').trim()

/** Fecha local de hoy como YYYY-MM-DD (para comparar con <input type="date">). */
export function todayISO(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

const NAME_RE = /^[\p{L}][\p{L}\s'’.-]*$/u
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const USER_RE = /^[A-Za-z0-9._]{4,20}$/

export const rules = {
  dni: (v) => !text(v) ? REQUIRED
    : !/^\d{5,15}$/.test(text(v)) ? 'Solo números, entre 5 y 15 dígitos.' : null,
  nombres: (v) => !text(v) ? REQUIRED
    : !NAME_RE.test(text(v)) || text(v).length > 60 ? 'Usa solo letras (máximo 60).' : null,
  apellidos: (v) => !text(v) ? REQUIRED
    : !NAME_RE.test(text(v)) || text(v).length > 60 ? 'Usa solo letras (máximo 60).' : null,
  fecha_nacimiento: (v, { today = todayISO() } = {}) => !text(v) ? REQUIRED
    : !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v)) ? 'Fecha no válida.'
    : v > today ? 'La fecha de nacimiento no puede ser futura.'
    : v < '1900-01-01' ? 'Fecha no válida.' : null,
  lugar_nacimiento: (v) => !text(v) ? REQUIRED : text(v).length > 80 ? 'Máximo 80 caracteres.' : null,
  direccion_facturacion: (v) => !text(v) ? REQUIRED : text(v).length > 150 ? 'Máximo 150 caracteres.' : null,
  genero: (v) => !text(v) ? 'Selecciona una opción.'
    : !GENEROS.some((g) => g.value === v) ? 'Selecciona una opción válida.' : null,
  correo: (v) => !text(v) ? REQUIRED
    : !EMAIL_RE.test(text(v)) || text(v).length > 120 ? 'Escribe un correo válido.' : null,
  usuario: (v) => !text(v) ? REQUIRED
    : !USER_RE.test(text(v)) ? 'De 4 a 20 caracteres: letras, números, punto o guion bajo.' : null,
  // La contraseña no se recorta (los espacios cuentan)
  password: (v) => !v ? REQUIRED
    : v.length < 8 || v.length > 64 ? 'Debe tener entre 8 y 64 caracteres.'
    : !/[A-Za-z]/.test(v) || !/\d/.test(v) ? 'Combina letras y números.' : null,
}

/** Devuelve { campo: mensaje } solo con los campos inválidos. `skip` omite campos (ej. correo ya fijado). */
export function validatePersonalData(values, { skip = [], today } = {}) {
  const errors = {}
  for (const [field, rule] of Object.entries(rules)) {
    if (skip.includes(field)) continue
    const message = rule(values[field], { today })
    if (message) errors[field] = message
  }
  return errors
}

/** La foto es opcional: sin archivo no hay error. */
export function validateImagen(file) {
  if (!file) return null
  if (!IMAGE_TYPES.includes(file.type)) return 'La foto debe ser JPG o PNG.'
  if (file.size > IMAGE_MAX_BYTES) return 'La foto no puede pesar más de 2 MB.'
  return null
}

// ---- Perfil (HU2) y cambio de contraseña (HU3) ----

/** Campos que el usuario puede editar en su perfil. Documento, usuario y correo NO (el correo va por verificación, D8). */
export const PROFILE_EDITABLE = [
  'nombres', 'apellidos', 'fecha_nacimiento', 'lugar_nacimiento', 'direccion_facturacion', 'genero',
]

export function validateProfile(values) {
  const skip = Object.keys(rules).filter((field) => !PROFILE_EDITABLE.includes(field))
  return validatePersonalData(values, { skip })
}

export function validateCambioCorreo({ correo_nuevo, password_actual }, correoActual) {
  const errors = {}
  const nuevo = rules.correo(correo_nuevo)
  if (nuevo) errors.correo_nuevo = nuevo
  else if (text(correo_nuevo).toLowerCase() === String(correoActual ?? '').toLowerCase()) {
    errors.correo_nuevo = 'Es el mismo correo que ya tienes.'
  }
  if (!password_actual) errors.password_actual = 'Escribe tu contraseña actual para confirmar.'
  return errors
}

/**
 * La confirmación existe porque no hay "olvidé mi contraseña" (D9): si el usuario se equivoca
 * al teclear la nueva, quedaría fuera de su cuenta.
 */
export function validateCambioPassword({ password_actual, password_nueva, confirmar }) {
  const errors = {}
  if (!password_actual) errors.password_actual = 'Escribe tu contraseña actual.'
  const nueva = rules.password(password_nueva)
  if (nueva) errors.password_nueva = nueva
  else if (password_nueva === password_actual) errors.password_nueva = 'La nueva contraseña debe ser distinta a la actual.'
  if (!errors.password_nueva && password_nueva !== confirmar) errors.confirmar = 'Las contraseñas no coinciden.'
  return errors
}

// ---- Administradores (HU23) ----

/** El root solo ingresa nombre y correo; el resto lo completa el administrador (R21–R22). */
export function validateNuevoAdmin({ nombre, correo }) {
  const errors = {}
  if (!text(nombre)) errors.nombre = REQUIRED
  else if (!NAME_RE.test(text(nombre)) || text(nombre).length > 80) errors.nombre = 'Usa solo letras (máximo 80).'
  const mail = rules.correo(correo)
  if (mail) errors.correo = mail
  return errors
}
