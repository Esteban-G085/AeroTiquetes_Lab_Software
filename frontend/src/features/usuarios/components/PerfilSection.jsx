import { Icon } from '@/components/ui'

/** Tarjeta de sección del perfil: icono + título + descripción opcional. */
export default function PerfilSection({ id, icon, title, description, children }) {
  return (
    <section className="at-card us-card at-enter-2" aria-labelledby={id}>
      <header className="us-card__head">
        <span className="us-card__icon"><Icon name={icon} size={20} /></span>
        <div>
          <h2 id={id} className="us-card__title">{title}</h2>
          {description && <p className="us-card__desc">{description}</p>}
        </div>
      </header>
      {children}
    </section>
  )
}
