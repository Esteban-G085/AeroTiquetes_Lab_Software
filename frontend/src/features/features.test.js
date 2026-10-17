import { features, allRoutes, getNavItems, getRouteMeta, canAccessPath } from '@/features'
import { ROLES } from '@/config/roles'

describe('registro de features', () => {
  it('cada feature cumple el contrato (name + routes con path y Component)', () => {
    for (const f of features) {
      expect(f.name).toBeTruthy()
      for (const r of f.routes) {
        expect(r.path).toMatch(/^\//)
        expect(r.Component).toBeDefined()
      }
    }
  })

  it('cada ruta declara título y un layout válido', () => {
    for (const r of allRoutes) {
      expect(r.title, r.path).toBeTruthy()
      expect([undefined, 'bare']).toContain(r.layout)
    }
  })

  it('no hay rutas duplicadas entre módulos (clave al unir el trabajo de 4 personas)', () => {
    const paths = allRoutes.map((r) => r.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('el menú se arma según el rol', () => {
    const visitante = getNavItems(ROLES.VISITANTE).map((i) => i.to)
    expect(visitante).toContain('/login')
    expect(visitante).not.toContain('/root/roles')
    expect(getNavItems(ROLES.ROOT).map((i) => i.to)).toContain('/root/roles')
    expect(getNavItems(ROLES.ADMIN, 'main').map((i) => i.to)).toEqual(['/admin/vuelos'])
  })
})

describe('helpers de rutas', () => {
  it('getRouteMeta resuelve rutas con parámetros', () => {
    expect(getRouteMeta('/vuelos/12').title).toBe('Detalle del vuelo')
    expect(getRouteMeta('/no-existe')).toBeUndefined()
  })
  it('canAccessPath respeta roles', () => {
    expect(canAccessPath('/perfil', ROLES.CLIENTE)).toBe(true)
    expect(canAccessPath('/admin/vuelos', ROLES.CLIENTE)).toBe(false)
    expect(canAccessPath('/perfil', ROLES.VISITANTE)).toBe(false)
  })
})
