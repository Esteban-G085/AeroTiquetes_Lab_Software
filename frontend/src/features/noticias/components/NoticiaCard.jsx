import { Link } from 'react-router-dom'
import { Badge, Icon } from '@/components/ui'
import { formatDate, formatPrice } from '@/utils/format'
import { resolveMediaUrl } from '@/utils/media'

/**
 * Noticia de un vuelo o promoción (SRS Noticias RF03): imagen alusiva, origen, destino, fecha y precio unitario.
 * Sin imagen del backend se dibuja una portada vectorial con los códigos de la ruta (sin fotos inventadas).
 * El precio tachado y el descuento solo se muestran si el backend los envía (nada de ofertas falsas).
 */
export default function NoticiaCard({ noticia, comprar }) {
  const n = noticia
  const img = resolveMediaUrl(n.imagen_url)
  const promo = n.tipo === 'promocion'
  return (
    <article className="nt-card" aria-label={n.titulo ?? `${n.origen.ciudad} a ${n.destino.ciudad}`}>
      <div className="nt-card__media">
        {img
          ? <img src={img} alt={`Destino ${n.destino.ciudad}`} loading="lazy" />
          : (
            <div className="nt-card__art" aria-hidden="true">
              <span>{n.origen.codigo}</span><Icon name="plane" size={22} /><span>{n.destino.codigo}</span>
            </div>
          )}
        <Badge tone={promo ? 'warning' : 'neutral'} className="nt-card__badge">{promo ? 'Promoción' : 'Nuevo vuelo'}</Badge>
      </div>
      <div className="nt-card__body">
        <h3 className="nt-card__title">{n.origen.ciudad} a {n.destino.ciudad}</h3>
        {n.titulo && <p className="nt-card__sub">{n.titulo}</p>}
        <p className="nt-card__when"><Icon name="calendar" size={15} /> {formatDate(n.salida, n.salida_zona)}</p>
        <p className="nt-card__price">
          {n.precio_original != null && <s className="nt-card__old">{formatPrice(n.precio_original, n.moneda)}</s>}
          <strong>{formatPrice(n.precio, n.moneda)}</strong> <span>por persona</span>
          {n.descuento_pct != null && <Badge tone="success">{n.descuento_pct}% de descuento</Badge>}
        </p>
        {n.vigente_hasta && <p className="nt-card__until">Publicada hasta el {formatDate(n.vigente_hasta)}</p>}
        {comprar && n.vuelo_id != null && (
          <Link to={`/comprar/${n.vuelo_id}`} className="btn btn-primary btn-sm" aria-label={`Reservar o comprar ${n.origen.ciudad} a ${n.destino.ciudad}`}>Reservar o comprar</Link>
        )}
      </div>
    </article>
  )
}
