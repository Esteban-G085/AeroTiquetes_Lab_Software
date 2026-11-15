import { Icon } from '@/components/ui'
import { maskCard } from '@/utils/format'
import { tipoLabel } from '../validators'

/** Tarjeta simulada. Nunca muestra el número completo ni el código: solo los últimos 4 dígitos. */
export default function TarjetaVisual({ tarjeta, onEdit, onDelete }) {
  return (
    <article className={`fi-card fi-card--${tarjeta.tipo}`} aria-label={`Tarjeta ${tipoLabel(tarjeta.tipo)} ${maskCard(tarjeta.numero)}`}>
      <header className="fi-card__top">
        <span className="fi-card__type">{tipoLabel(tarjeta.tipo)}</span>
        <Icon name="card" size={26} />
      </header>
      <p className="fi-card__num at-mono">{maskCard(tarjeta.numero)}</p>
      <footer className="fi-card__bottom">
        <span className="fi-card__holder">{tarjeta.titular}</span>
        <span className="fi-card__exp at-mono">{tarjeta.vencimiento}</span>
      </footer>
      <span className="fi-card__tools">
        <button type="button" className="fi-card__btn" aria-label={`Editar tarjeta ${maskCard(tarjeta.numero)}`} onClick={() => onEdit(tarjeta)}><Icon name="pencil" size={18} /></button>
        <button type="button" className="fi-card__btn" aria-label={`Eliminar tarjeta ${maskCard(tarjeta.numero)}`} onClick={() => onDelete(tarjeta)}><Icon name="trash" size={18} /></button>
      </span>
    </article>
  )
}
