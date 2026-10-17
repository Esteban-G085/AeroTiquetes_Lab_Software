import { Skeleton } from '@/components/ui'

/**
 * Esqueleto de los resultados (HU5): dos tarjetas con la SILUETA de FlightCard mientras responde
 * la API (DISENO.md §4). El estado lo anuncia el contenedor; cada tarjeta es decorativa.
 */
export default function ResultadosSkeleton() {
  return (
    <div className="bu-results bu-skeleton" role="status" aria-label="Buscando vuelos…">
      <div className="bu-results__list">
        {[0, 1].map((i) => (
          <div className="at-flight" key={i} aria-hidden="true">
            <div className="at-flight__main">
              <div className="at-flight__meta"><Skeleton width="7rem" height="1rem" /></div>

              <div className="at-flight__route">
                <div className="at-flight__stop">
                  <Skeleton width="4rem" height="1.6rem" />
                  <Skeleton width="6rem" height="1rem" />
                </div>
                <div className="at-flight__path">
                  <Skeleton width="5.5rem" height=".8rem" />
                  <Skeleton width="100%" height=".15rem" />
                </div>
                <div className="at-flight__stop at-flight__stop--end">
                  <Skeleton width="4rem" height="1.6rem" />
                  <Skeleton width="6rem" height="1rem" />
                </div>
              </div>
            </div>

            <div className="at-flight__buy">
              <Skeleton width="100%" height="1.9rem" />
              <Skeleton width="100%" height="2.4rem" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
