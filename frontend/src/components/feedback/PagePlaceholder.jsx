import { Icon } from '@/components/ui'
import { env } from '@/config/env'

/**
 * Pantalla provisional de una sección que otro módulo aún no entrega.
 * Para el usuario final solo comunica que la sección está en preparación; el código de la tarea
 * (útil para el equipo) se muestra únicamente en desarrollo. Se elimina al implementar la tarea.
 */
export default function PagePlaceholder({ title, task, children }) {
  return (
    <section className="at-placeholder at-enter">
      <span className="at-placeholder__icon"><Icon name="plane" size={30} /></span>
      <p className="at-placeholder__eyebrow">Próximamente</p>
      <h1 className="at-placeholder__title">{title}</h1>
      <p className="at-placeholder__text">Estamos preparando esta sección. Vuelve pronto.</p>
      {env.isDev && task && <p className="at-placeholder__dev">Pendiente en el plan: <code>{task}</code></p>}
      {children}
    </section>
  )
}
