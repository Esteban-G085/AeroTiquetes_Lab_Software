import { CATALOGO_UBICACION } from '@/test/helpers'
import { departamentosParaPais } from './catalogo'

const { paises, departamentos } = CATALOGO_UBICACION
const codigos = (lista) => lista.map((d) => d.codigo)

describe('departamentosParaPais', () => {
  it('Colombia solo ofrece sus departamentos', () => {
    expect(codigos(departamentosParaPais(paises, departamentos, 'Colombia'))).toEqual(['CO-BDC', 'CO-RIS'])
  })

  it('China solo ofrece sus propias regiones', () => {
    expect(codigos(departamentosParaPais(paises, departamentos, 'China'))).toEqual(['CN-BJ', 'CN-SH'])
  })

  it('un país sin geografía curada ofrece solo su región', () => {
    expect(codigos(departamentosParaPais(paises, departamentos, 'Dinamarca'))).toEqual(['DK-GE'])
  })

  it('un país desconocido no ofrece nada', () => {
    expect(departamentosParaPais(paises, departamentos, 'Inventado')).toEqual([])
  })
})
