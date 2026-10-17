import { Card, Skeleton } from '@/components/ui'

/**
 * Esqueleto con la MISMA forma que VueloDetalle (DISENO.md §4: se carga con la silueta del
 * contenido, no con un spinner), para el detalle público (HU5) y la consulta del panel (HU19).
 * El anuncio lo da `role="status"`; los bloques son decorativos (Skeleton ya es aria-hidden).
 */
export default function VueloDetalleSkeleton({ label = 'Cargando vuelo…' }) {
  return (
    <Card className="at-detail" role="status" aria-label={label}>
      <div className="at-detail__head">
        <div>
          <Skeleton width="6rem" height=".7rem" />
          <Skeleton width="8rem" height="1.75rem" />
        </div>
        <div className="at-detail__flags">
          <Skeleton width="5rem" height="1.6rem" />
          <Skeleton width="5.5rem" height="1.6rem" />
        </div>
      </div>

      <div className="at-detail__route">
        {[0, 1].map((i) => (
          <div className="at-detail__block" key={i}>
            <Skeleton width="4.5rem" height=".7rem" />
            <Skeleton width="3.5rem" height="1.6rem" />
            <Skeleton width="11rem" height=".9rem" />
          </div>
        ))}
      </div>

      <div className="at-detail__grid">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div className="at-detail__item" key={i}>
            <Skeleton width="5.5rem" height=".7rem" />
            <Skeleton width="6rem" height="1.05rem" />
          </div>
        ))}
      </div>
    </Card>
  )
}
