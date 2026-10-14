// Formato de moneda (COP). El backend envía valores numéricos; el front solo los formatea.

const formatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

export function formatCOP(valor) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return '—'
  return formatter.format(Number(valor))
}
