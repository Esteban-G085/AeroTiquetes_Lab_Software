// Utilidades de presentación del módulo Usuarios.

/** Cambios de la matriz de roles: devuelve solo los roles cuyo mapa de módulos difiere de la base. */
export function diffRoles(base, draft) {
  const changed = []
  for (const role of base) {
    const mine = draft[role.id] ?? role.modulos
    const differs = Object.keys({ ...role.modulos, ...mine }).some((m) => Boolean(role.modulos[m]) !== Boolean(mine[m]))
    if (differs && role.editable) changed.push({ id: role.id, modulos: mine })
  }
  return changed
}
