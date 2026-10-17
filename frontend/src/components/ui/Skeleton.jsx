import { cn } from '@/utils/cn'

/** Marcador de carga con forma de contenido. Decorativo (aria-hidden): el estado lo anuncia quien lo usa. */
export default function Skeleton({ width = '100%', height = '1rem', circle = false, className }) {
  return (
    <span
      className={cn('at-skeleton', circle && 'at-skeleton--circle', className)}
      style={{ width, height: circle ? width : height }} aria-hidden="true"
    />
  )
}
