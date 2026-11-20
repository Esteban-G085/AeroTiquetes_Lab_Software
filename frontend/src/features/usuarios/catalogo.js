/** Reglas compartidas de la cadena geográfica de facturación.
 *
 * Colombia es el único país con departamentos propios. Cualquier otro país
 * habilitado utiliza las regiones del exterior (`EXT-*`), para poder inscribir
 * a alguien que viva fuera de Colombia sin importar si su país tiene una región
 * asignada de fábrica.
 */
const esColombia = (pais) => !!pais && (
  String(pais.codigo_iso2 || '').toUpperCase() === 'CO'
  || String(pais.nombre || '').trim().toLowerCase() === 'colombia'
)

export const departamentosParaPais = (paises, departamentos, nombrePais) => {
  const pais = paises.find((p) => p.nombre === nombrePais)
  if (!pais) return []
  return esColombia(pais)
    ? departamentos.filter((d) => d.id_pais === pais.id)
    : departamentos.filter((d) => String(d.codigo || '').startsWith('EXT-'))
}
