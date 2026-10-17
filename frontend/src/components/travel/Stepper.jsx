import { Icon } from '@/components/ui'

/**
 * Indicador de pasos para procesos largos (reserva → pasajeros → pago → confirmación).
 * `current` es el índice (0…) del paso actual. Los anteriores se marcan como completados.
 */
export default function Stepper({ steps, current = 0, label = 'Progreso' }) {
  return (
    <nav aria-label={label}>
      <ol className="at-stepper">
        {steps.map((step, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'todo'
          return (
            <li key={step} className={`at-stepper__item at-stepper__item--${state}`} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="at-stepper__dot" aria-hidden="true">{state === 'done' ? <Icon name="check" size={14} /> : i + 1}</span>
              <span className="at-stepper__label">
                {step}
                {state === 'done' && <span className="visually-hidden"> (completado)</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
