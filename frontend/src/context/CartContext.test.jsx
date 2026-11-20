import { act, screen } from '@testing-library/react'
import { renderWithProviders, seedSession, VUELO_EJEMPLO } from '@/test/helpers'
import { useCart } from './CartContext'

const viajero = (doc) => ({ documento: doc, nombres: 'Ana', apellidos: 'Gómez' })
const item = (id, n, precio = 100000) => ({ vuelo: { ...VUELO_EJEMPLO, id, precio }, clase: 'economica', tramo: 'ida', viajeros: Array.from({ length: n }, (_, i) => viajero(`D${id}${i}`)) })

let cart
const Probe = () => { cart = useCart(); return <p>{cart.count} tiquetes · ${cart.total}</p> }

describe('CartContext (carrito del cliente)', () => {
  beforeEach(() => seedSession({ rol: 'cliente' }))

  it('empieza vacío', () => {
    renderWithProviders(<Probe />)
    expect(screen.getByText('0 tiquetes · $0')).toBeInTheDocument()
  })

  it('cuenta tiquetes y suma precio × viajeros de cada vuelo', () => {
    renderWithProviders(<Probe />)
    act(() => cart.upsertItems([item(1, 2, 100000), item(2, 1, 50000)]))
    expect(screen.getByText('3 tiquetes · $250000')).toBeInTheDocument()
  })

  it('un vuelo no se repite: agregarlo de nuevo reemplaza el ítem', () => {
    renderWithProviders(<Probe />)
    act(() => cart.upsertItems(item(1, 2)))
    act(() => cart.upsertItems(item(1, 1)))
    expect(cart.items).toHaveLength(1)
    expect(cart.count).toBe(1)
  })

  it('quita un vuelo y vacía el carrito', () => {
    renderWithProviders(<Probe />)
    act(() => cart.upsertItems([item(1, 1), item(2, 1)]))
    act(() => cart.removeItem(1))
    expect(cart.items.map((i) => i.vuelo.id)).toEqual([2])
    act(() => cart.clear())
    expect(cart.count).toBe(0)
  })

  it('se guarda en sessionStorage y se recupera al recargar', () => {
    const { unmount } = renderWithProviders(<Probe />)
    act(() => cart.upsertItems(item(1, 2)))
    unmount()
    renderWithProviders(<Probe />)
    expect(cart.count).toBe(2)
  })
})

describe('CartContext sin sesión', () => {
  it('un visitante nunca conserva un carrito', () => {
    sessionStorage.setItem('at.cart.v3', JSON.stringify([item(1, 2)]))
    renderWithProviders(<Probe />)
    expect(screen.getByText('0 tiquetes · $0')).toBeInTheDocument()
  })
})
