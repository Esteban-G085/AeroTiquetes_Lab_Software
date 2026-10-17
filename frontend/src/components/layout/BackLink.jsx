import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui'
import { cn } from '@/utils/cn'

/**
 * Botón «Volver» compartido por toda la app (mismas flecha, texto y jerarquía en F1 y F2).
 * Usa la variante secundaria a propósito: la acción principal de la pantalla es otra (DISENO.md §4).
 *
 *  - `to`      → navega a una ruta conocida (enlace real: se puede abrir en otra pestaña)
 *  - `onClick` → vuelve a donde estaba el usuario (ver utils/useGoBack)
 */
export default function BackLink({ to, onClick, children = 'Volver', className }) {
  const clases = cn('btn btn-outline-secondary at-back', className)
  const contenido = (
    <>
      <Icon name="arrow-left" size={18} />
      {children}
    </>
  )

  return to
    ? <Link to={to} className={clases}>{contenido}</Link>
    : <button type="button" className={clases} onClick={onClick}>{contenido}</button>
}
