/** Regla compartida de la cadena geográfica de facturación.
 *
 * Cada país ofrece solo sus propias regiones/departamentos. Colombia tiene sus
 * 32 departamentos; los demás países tienen los suyos (reales o una región
 * genérica con su capital), así que nunca aparece una región de otro país.
 */
export const departamentosParaPais = (paises, departamentos, nombrePais) => {
  const pais = paises.find((p) => p.nombre === nombrePais)
  if (!pais) return []
  return departamentos.filter((d) => d.id_pais === pais.id)
}
