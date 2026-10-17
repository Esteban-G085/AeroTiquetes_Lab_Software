import { cn } from '@/utils/cn'

/** Superficie base. `tone="night"` para el estilo oscuro de marca; `padded={false}` si el contenido trae su propio espaciado. */
export default function Card({ as: Tag = 'section', tone, padded = true, className, children, ...rest }) {
  return (
    <Tag className={cn('at-card', tone === 'night' && 'at-card--night', !padded && 'at-card--flush', className)} {...rest}>
      {children}
    </Tag>
  )
}
