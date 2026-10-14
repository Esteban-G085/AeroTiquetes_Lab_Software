import { describe, expect, it } from 'vitest'
import { crearVuelo, listarVuelos } from '../services/vuelosService.js'

describe('vuelosService (con mocks MSW)', () => {
  it('lista vuelos para el panel admin', async () => {
    const data = await listarVuelos()
    expect(data.total).toBeGreaterThan(0)
  })

  it('programa un vuelo nacional y genera código consecutivo', async () => {
    const creado = await crearVuelo({
      origen: 'BOG',
      destino: 'MDE',
      fecha: '2030-01-15',
      hora: '08:00',
      duracion_min: 65,
      precio: 300000,
      cupos: { economica: 100, primera: 10 },
    })
    expect(creado.codigo).toMatch(/^AT-\d{4}$/)
    expect(creado.tipo).toBe('nacional')
  })

  it('rechaza una combinación internacional inválida', async () => {
    await expect(
      crearVuelo({
        origen: 'LET',
        destino: 'MAD',
        fecha: '2030-01-15',
        hora: '08:00',
        duracion_min: 600,
        precio: 2000000,
        cupos: { economica: 10, primera: 2 },
      }),
    ).rejects.toMatchObject({ response: { status: 422 } })
  })
})
