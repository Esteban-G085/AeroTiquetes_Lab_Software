import { Switch } from '@/components/ui'

/**
 * Matriz activa roles × módulos (P2). Las columnas salen de lo que devuelva el backend,
 * así un módulo nuevo aparece sin tocar el front. En móvil la misma tabla se transforma en tarjetas (CSS).
 * Los roles con `editable: false` (root) se muestran bloqueados para que nadie pierda su propio acceso.
 */
export default function RolesMatrix({ modulos, roles, isChecked, onToggle }) {
  return (
    <div className="us-roles__scroll">
      <table className="us-roles__table" role="table">
        <caption className="visually-hidden">Permisos por rol y módulo</caption>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">Rol</th>
            {modulos.map((m) => <th key={m.id} scope="col" role="columnheader">{m.nombre}</th>)}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {roles.map((r) => (
            <tr key={r.id} role="row">
              <th scope="row" role="rowheader" className="us-roles__role">
                <span className="us-roles__name">{r.nombre}</span>
                {r.descripcion && <span className="us-roles__desc">{r.descripcion}</span>}
                {!r.editable && <span className="us-roles__lock">No editable</span>}
              </th>
              {modulos.map((m) => (
                <td key={m.id} role="cell" data-label={m.nombre}>
                  <Switch
                    label={`${r.nombre}: ${m.nombre}`}
                    checked={isChecked(r, m.id)}
                    disabled={!r.editable}
                    onChange={(value) => onToggle(r.id, m.id, value)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
