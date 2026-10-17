import { diffRoles } from './utils'

const base = [
  { id: 'root', editable: false, modulos: { a: true, b: true } },
  { id: 'cliente', editable: true, modulos: { a: false, b: true } },
  { id: 'visitante', editable: true, modulos: { a: false, b: false } },
]

describe('diffRoles', () => {
  it('sin cambios devuelve vacío', () => {
    expect(diffRoles(base, {})).toEqual([])
    expect(diffRoles(base, { cliente: { a: false, b: true } })).toEqual([])
  })
  it('devuelve solo los roles que cambiaron, con su mapa completo', () => {
    expect(diffRoles(base, { cliente: { a: true, b: true } })).toEqual([{ id: 'cliente', modulos: { a: true, b: true } }])
  })
  it('volver al valor original deja de contar como cambio', () => {
    expect(diffRoles(base, { visitante: { a: true, b: false } })).toHaveLength(1)
    expect(diffRoles(base, { visitante: { a: false, b: false } })).toHaveLength(0)
  })
  it('un rol no editable nunca se envía, aunque se manipule el borrador', () => {
    expect(diffRoles(base, { root: { a: false, b: false } })).toEqual([])
  })
})
