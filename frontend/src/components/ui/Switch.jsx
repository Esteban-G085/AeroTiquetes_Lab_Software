import { useId } from 'react'
import { cn } from '@/utils/cn'

/** Interruptor accesible (checkbox con role="switch"). `label` es obligatorio para lectores de pantalla. */
export default function Switch({ label, checked, onChange, disabled, className }) {
  const id = useId()
  return (
    <div className={cn('form-check form-switch at-switch', className)}>
      <input
        id={id} type="checkbox" role="switch" className="form-check-input"
        checked={checked} disabled={disabled} aria-label={label}
        onChange={(e) => onChange?.(e.target.checked)}
      />
    </div>
  )
}
