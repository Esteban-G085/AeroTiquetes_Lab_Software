import { CATALOGO_UBICACION } from '@/test/helpers'
import { departamentosParaPais } from './catalogo'

const { paises, departamentos } = CATALOGO_UBICACION
const codigos = (lista) => lista.map((d) => d.codigo)

describe('departamentosParaPais', () => {
  it('Colombia solo ofrece sus departamentos', () => {
    expect(codigos(departamentosParaPais(paises, departamentos, 'Colombia'))).toEqual(['CO-BDC', 'CO-RIS'])
  })

  it('cualquier país del exterior ofrece las regiones EXT', () => {
    for (const pais of ['España', 'Perú']) {
      expect(codigos(departamentosParaPais(paises, departamentos, pais))).toEqual(['EXT-EU'])
    }
  })

  it('un país desconocido no ofrece nada', () => {
    expect(departamentosParaPais(paises, departamentos, 'Inventado')).toEqual([])
  })
})
