import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui'
import { useCart } from '@/context'

/**
 * Carrito de la cabecera (solo cliente). Es un enlace a /carrito; la cifra aparece solo si hay tiquetes
 * (nunca un número inventado) y el texto accesible la dice en palabras.
 */
export default function CartButton() {
  const { count } = useCart()
  const label = count === 0 ? 'Carrito, vacío' : `Carrito, ${count} ${count === 1 ? 'tiquete' : 'tiquetes'}`
  return (
    <Link to="/carrito" className="at-icon-btn at-cart" aria-label={label}>
      <Icon name="cart" size={24} />
      {count > 0 && <span className="at-cart__count" aria-hidden="true">{count}</span>}
    </Link>
  )
}
