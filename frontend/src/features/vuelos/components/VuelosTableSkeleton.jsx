import { Skeleton } from '@/components/ui'

/**
 * Esqueleto de la tabla de vuelos programados (HU19) mientras responde la API (DISENO.md §4).
 * Conserva la superficie de la tabla (.at-card) para que el contenido no salte al llegar.
 */
export default function VuelosTableSkeleton({ label = 'Cargando vuelos…' }) {
  return (
    <div className="at-card vu-skeleton" role="status" aria-label={label}>
      {[0, 1, 2, 3].map((i) => (
        <div className="vu-skeleton__row" key={i} aria-hidden="true">
          <Skeleton width="4.5rem" height="1rem" />
          <Skeleton width="9rem" height="1rem" />
          <Skeleton width="7rem" height="1rem" />
          <Skeleton width="5rem" height="1rem" />
          <Skeleton width="5.5rem" height="1.6rem" />
        </div>
      ))}
    </div>
  )
}
