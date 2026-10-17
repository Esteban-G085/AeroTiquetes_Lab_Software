import { cn } from '@/utils/cn'

/** Insignia de estado. tone: success (ACTIVO) | warning (PENDIENTE) | danger | neutral */
export default function Badge({ tone = 'neutral', className, children }) {
  return <span className={cn('at-badge', `at-badge--${tone}`, className)}>{children}</span>
}
