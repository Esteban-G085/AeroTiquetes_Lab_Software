import { describe, expect, it } from 'vitest'
import { buscarVuelos, obtenerVuelo } from '../services/busquedaService.js'

describe('busquedaService (con mocks MSW)', () => {
  it('devuelve vuelos al buscar sin filtros', async () => {
    const data = await buscarVuelos()
    expect(data.total).toBeGreaterThan(0)
    expect(Array.isArray(data.items)).toBe(true)
  })

  it('filtra por origen', async () => {
    const data = await buscarVuelos({ origen: 'BOG' })
    expect(data.items.every((v) => v.origen.codigo === 'BOG')).toBe(true)
  })

  it('filtra por rango de precio', async () => {
    const data = await buscarVuelos({ precio_max: 300000 })
    expect(data.items.every((v) => v.precio <= 300000)).toBe(true)
  })

  it('ordena por precio ascendente', async () => {
    const data = await buscarVuelos({ orden: 'precio_asc' })
    const precios = data.items.map((v) => v.precio)
    expect([...precios].sort((a, b) => a - b)).toEqual(precios)
  })

  it('obtiene el detalle de un vuelo existente', async () => {
    const { items } = await buscarVuelos()
    const detalle = await obtenerVuelo(items[0].id)
    expect(detalle.codigo).toBe(items[0].codigo)
  })

  it('lanza error 404 si el vuelo no existe', async () => {
    await expect(obtenerVuelo('no-existe')).rejects.toMatchObject({
      response: { status: 404 },
    })
  })
})
