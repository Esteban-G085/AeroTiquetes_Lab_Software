import { describe, expect, it } from 'vitest'
import { clasificarVuelo, getCiudad, CIUDADES_NACIONALES } from '../ciudades.js'

describe('reglas de ciudades y vuelos', () => {
  it('cataloga 32 capitales nacionales y 5 internacionales', () => {
    expect(CIUDADES_NACIONALES).toHaveLength(32)
  })

  it('clasifica vuelo nacional entre capitales colombianas', () => {
    expect(clasificarVuelo('BOG', 'MDE')).toBe('nacional')
  })

  it('permite internacional solo desde las 5 ciudades autorizadas', () => {
    expect(clasificarVuelo('PEI', 'MAD')).toBe('internacional')
    expect(clasificarVuelo('BOG', 'MIA')).toBe('internacional')
  })

  it('rechaza internacional desde una ciudad no autorizada', () => {
    expect(clasificarVuelo('LET', 'MAD')).toBeNull()
  })

  it('rechaza mismo origen y destino', () => {
    expect(clasificarVuelo('BOG', 'BOG')).toBeNull()
  })

  it('getCiudad es insensible a mayúsculas', () => {
    expect(getCiudad('bog')?.nombre).toBe('Bogotá')
  })
})
