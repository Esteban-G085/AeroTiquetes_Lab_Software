import { CIUDADES, CIUDADES_EXTERIOR, CIUDADES_NACIONALES, clasificarVuelo, getCiudad, origenesInternacionales } from './ciudades'

describe('catálogo de ciudades', () => {
  it('trae las 32 capitales de departamento y las 5 ciudades del exterior', () => {
    expect(CIUDADES_NACIONALES).toHaveLength(32)
    expect(CIUDADES_EXTERIOR).toHaveLength(5)
    expect(CIUDADES).toHaveLength(37)
  })

  it('marca como grupo `colombia` solo los 5 orígenes internacionales del PO', () => {
    expect(origenesInternacionales(CIUDADES_NACIONALES).map((c) => c.codigo).sort())
      .toEqual(['BOG', 'CLO', 'CTG', 'MDE', 'PEI'])
  })

  it('getCiudad es insensible a mayúsculas y devuelve null si no existe', () => {
    expect(getCiudad('bog')?.nombre).toBe('Bogotá')
    expect(getCiudad('XXX')).toBeNull()
    expect(getCiudad(undefined)).toBeNull()
  })
})

describe('clasificarVuelo (RF04–RF06, HU18)', () => {
  it('nacional entre capitales de departamento', () => {
    expect(clasificarVuelo('BOG', 'MDE')).toBe('nacional')
    expect(clasificarVuelo('LET', 'MZL')).toBe('nacional')
  })

  it('internacional desde una ciudad autorizada hacia el exterior (y al revés)', () => {
    expect(clasificarVuelo('PEI', 'MAD')).toBe('internacional')
    expect(clasificarVuelo('BOG', 'MIA')).toBe('internacional')
    expect(clasificarVuelo('NYC', 'CLO')).toBe('internacional')
  })

  it('rechaza el exterior desde una ciudad no autorizada', () => {
    expect(clasificarVuelo('LET', 'MAD')).toBeNull()
  })

  it('rechaza exterior con exterior y mismo origen y destino', () => {
    expect(clasificarVuelo('MAD', 'MIA')).toBeNull()
    expect(clasificarVuelo('BOG', 'BOG')).toBeNull()
  })

  it('acepta las ciudades ya resueltas por la API (no solo códigos)', () => {
    expect(clasificarVuelo(getCiudad('BOG'), getCiudad('MAD'))).toBe('internacional')
  })

  it('una ciudad desconocida no se puede clasificar', () => {
    expect(clasificarVuelo('BOG', 'ZZZ')).toBeNull()
  })
})
