import { decodeJwt, isExpired, getExpiryMs } from './jwt'
import { makeJwt } from '@/test/helpers'

describe('jwt utils', () => {
  it('decodifica sub y rol', () => {
    expect(decodeJwt(makeJwt({ rol: 'root', sub: '7' }))).toMatchObject({ rol: 'root', sub: '7' })
  })
  it('token inválido devuelve null, sin lanzar', () => {
    expect(decodeJwt('basura')).toBeNull()
  })
  it('detecta expiración', () => {
    expect(isExpired(decodeJwt(makeJwt({ expInSeconds: -5 })))).toBe(true)
    expect(isExpired(decodeJwt(makeJwt({ expInSeconds: 60 })))).toBe(false)
    expect(getExpiryMs({})).toBeNull()
  })
})
