import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'

/**
 * Carrito de compras (HU7 / F1-12). Es del cliente y vive en sessionStorage: se pierde al cerrar la pestaña
 * y se vacía al cerrar sesión, igual que el token. El backend no guarda carritos: recibe el contenido en POST /compras.
 *
 * Un ítem = un VUELO (un tramo) con sus viajeros:
 *   { vuelo: { id, codigo, origen, destino, salida, llegada, ..., precio }, clase, viajeros: [...], tramo: 'ida' | 'vuelta' }
 * Un trayecto completo (ida y vuelta) son dos ítems independientes (cada uno con su check-in y su silla, SRS 3.2.7 RF10).
 */
const CartContext = createContext(null)
const KEY = 'at.cart'

const safe = (fn, fallback) => { try { return fn() } catch { return fallback } }
const read = () => safe(() => {
  const list = JSON.parse(sessionStorage.getItem(KEY))
  return Array.isArray(list) ? list : []
}, [])
const write = (items) => safe(() => sessionStorage.setItem(KEY, JSON.stringify(items)))

/** Total del carrito: precio del vuelo × cantidad de viajeros (valor único por persona, sin distinción de clase: RF03). */
export const subtotal = (item) => Number(item.vuelo?.precio ?? 0) * (item.viajeros?.length ?? 0)
export const cartTotal = (items) => items.reduce((sum, it) => sum + subtotal(it), 0)
export const cartCount = (items) => items.reduce((sum, it) => sum + (it.viajeros?.length ?? 0), 0)

export function CartProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [items, setItems] = useState(read)

  useEffect(() => { write(items) }, [items])
  // Sin sesión no hay carrito (cierre manual, por inactividad o por vencimiento)
  useEffect(() => { if (!isAuthenticated) setItems([]) }, [isAuthenticated])

  /** Agrega o reemplaza (por vuelo) uno o varios ítems. Un vuelo no puede aparecer dos veces. */
  const upsertItems = useCallback((nuevos) => {
    const list = Array.isArray(nuevos) ? nuevos : [nuevos]
    setItems((prev) => {
      const ids = new Set(list.map((i) => String(i.vuelo.id)))
      const kept = prev.filter((i) => !ids.has(String(i.vuelo.id)))
      return [...kept, ...list]
    })
  }, [])

  const removeItem = useCallback((vueloId) => {
    setItems((prev) => prev.filter((i) => String(i.vuelo.id) !== String(vueloId)))
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const value = useMemo(() => ({
    items,
    count: cartCount(items),
    total: cartTotal(items),
    upsertItems,
    removeItem,
    clear,
    getItem: (vueloId) => items.find((i) => String(i.vuelo.id) === String(vueloId)) ?? null,
  }), [items, upsertItems, removeItem, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>')
  return ctx
}
