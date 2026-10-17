import { cn } from '@/utils/cn'
import Spinner from './Spinner'

/**
 * Botón base. variant: primary | dark | outline-primary | outline-secondary | danger | link
 * loading: deshabilita y muestra spinner (evita doble envío en formularios).
 */
export default function Button({
  variant = 'primary',
  size,
  loading = false,
  disabled = false,
  type = 'button',
  className,
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      className={cn('btn', `btn-${variant}`, size && `btn-${size}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <><Spinner label="Procesando" />{' '}</>}
      {children}
    </button>
  )
}
