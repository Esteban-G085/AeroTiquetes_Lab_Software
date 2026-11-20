// Validaciones de la billetera simulada (SRS 3.2.6). Son espejo de las del backend (B1): este solo da respuesta inmediata.

export const TIPOS_TARJETA = [
  { value: 'credito', label: 'Crédito' },
  { value: 'debito', label: 'Débito' },
]
export const tipoLabel = (v) => TIPOS_TARJETA.find((t) => t.value === v)?.label ?? v

export const MONTO_MAX = 100_000_000
export const MONTOS_RAPIDOS = [50_000, 100_000, 200_000, 500_000]
export const TARJETA_VACIA = Object.freeze({ tipo: '', numero: '', titular: '', vencimiento: '', codigo: '' })

const REQUIRED = 'Este campo es obligatorio.'
const text = (v) => String(v ?? '').trim()
const NAME_RE = /^[\p{L}][\p{L}\s'’.-]*$/u

/** "1234 5678-9012" → "123456789012" */
export const soloDigitos = (v) => String(v ?? '').replace(/\D/g, '')

/** Algoritmo de Luhn (mod 10): espejo de la validación del backend al dar de alta la tarjeta. */
export function validarLuhn(valor) {
  const digitos = soloDigitos(valor)
  if (!/^\d{13,19}$/.test(digitos)) return false
  let total = 0
  const duplicarPrimero = digitos.length % 2 === 0
  for (let i = 0; i < digitos.length; i += 1) {
    let n = Number(digitos[i])
    if ((i % 2 === 0) === duplicarPrimero) {
      n *= 2
      if (n > 9) n -= 9
    }
    total += n
  }
  return total % 10 === 0
}

/** Monto escrito por la persona ("1.500.000" o "1500000") → entero, o NaN. */
export const parseMonto = (v) => {
  const d = soloDigitos(v)
  return d ? Number(d) : Number.NaN
}

/** Recarga (RF02): debe ser > 0. No hay operacion de "establecer saldo". */
export function validarMonto(valor) {
  if (!text(valor)) return REQUIRED
  const n = parseMonto(valor)
  if (Number.isNaN(n)) return 'Escribe solo números.'
  if (n <= 0) return 'El monto debe ser mayor a 0.'
  if (n > MONTO_MAX) return 'El monto máximo por operación es $100.000.000.'
  return null
}

/** "MM/AA" (o "MMAA") vigente: el mes actual todavía es válido. */
export function vencimientoVigente(v, ahora = new Date()) {
  const m = /^(\d{2})\s*\/?\s*(\d{2})$/.exec(text(v))
  if (!m) return false
  const mes = Number(m[1])
  const anio = 2000 + Number(m[2])
  if (mes < 1 || mes > 12) return false
  return anio > ahora.getFullYear() || (anio === ahora.getFullYear() && mes >= ahora.getMonth() + 1)
}

const campos = {
  tipo: (v) => (!text(v) ? 'Selecciona una opción.' : TIPOS_TARJETA.some((t) => t.value === v) ? null : 'Selecciona una opción válida.'),
  numero: (v) => {
    if (!text(v)) return REQUIRED
    if (!/^[\d\s-]+$/.test(text(v)) || soloDigitos(v).length < 13 || soloDigitos(v).length > 19) {
      return 'Entre 13 y 19 dígitos.'
    }
    return validarLuhn(v) ? null : 'El número de tarjeta no es válido (verificación de Luhn).'
  },
  titular: (v) => (!text(v) ? REQUIRED : !NAME_RE.test(text(v)) || text(v).length > 60 ? 'Usa solo letras (máximo 60).' : null),
  vencimiento: (v, ahora) => (!text(v) ? REQUIRED : !/^\d{2}\s*\/?\s*\d{2}$/.test(text(v)) ? 'Usa el formato MM/AA.' : !vencimientoVigente(v, ahora) ? 'La tarjeta está vencida o la fecha no es válida.' : null),
  codigo: (v) => (!text(v) ? REQUIRED : !/^\d{3,4}$/.test(text(v)) ? 'Son 3 o 4 dígitos.' : null),
}

/** { campo: mensaje } solo de los campos inválidos. */
export function validarTarjeta(values, ahora = new Date()) {
  const errors = {}
  for (const [campo, regla] of Object.entries(campos)) {
    const msg = regla(values[campo], ahora)
    if (msg) errors[campo] = msg
  }
  return errors
}

/** Normaliza a "MM/AA" para enviar al backend. */
export const normalizarVencimiento = (v) => {
  const d = soloDigitos(v)
  return `${d.slice(0, 2)}/${d.slice(2, 4)}`
}
