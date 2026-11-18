import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorState, LoadingState, useToast } from '@/components/feedback'
import { Button, ConfirmDialog } from '@/components/ui'
import { BackLink, PageHeader } from '@/components/layout'
import { ROLES } from '@/config/roles'
import { useAuth } from '@/context/AuthContext'
import { formatDate, formatPrice, formatTime } from '@/utils/format'
import { eliminarNoticia, obtenerNoticia } from '../api'
import '../noticias.css'

/** HU11 — Detalle de una noticia, pública en `/noticias/:id`. */
export default function NoticiaDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { rol } = useAuth()
  const [noticia, setNoticia] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [confirmar, setConfirmar] = useState({ open: false, loading: false })

  const cargar = useCallback(async () => {
    setStatus('loading')
    try {
      setNoticia(await obtenerNoticia(id))
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [id])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function confirmarEliminar() {
    setConfirmar((prev) => ({ ...prev, loading: true }))
    try {
      await eliminarNoticia(noticia.id)
      toast.success('La noticia fue eliminada.')
      navigate('/noticias')
    } catch (err) {
      toast.error(err?.message ?? 'No se pudo eliminar la noticia.')
      setConfirmar({ open: false, loading: false })
    }
  }

  if (status === 'loading') {
    return <div className="not-page"><LoadingState /></div>
  }

  if (status === 'error' || !noticia) {
    return (
      <div className="not-page">
        <BackLink to="/noticias">Volver a noticias</BackLink>
        <ErrorState
          title="No encontramos la noticia"
          message="Puede que ya no esté vigente o que el enlace no sea válido."
          onRetry={cargar}
        />
      </div>
    )
  }

  const zona = noticia.salida_zona || 'America/Bogota'
  const origen = noticia.origen?.ciudad || noticia.origen?.codigo || ''
  const destino = noticia.destino?.ciudad || noticia.destino?.codigo || ''
  const ruta = origen && destino ? `${origen} → ${destino}` : ''

  return (
    <div className="not-page">
      <BackLink to="/noticias">Volver a noticias</BackLink>

      <PageHeader
        eyebrow={noticia.tipo === 'promocion' ? 'Promoción' : 'Noticia'}
        title={noticia.titulo || 'Noticia de vuelo'}
        subtitle={`Publicada el ${formatDate(noticia.publicada_en, 'America/Bogota')}`}
      />

      <article className="at-card at-card--padded not-detalle">
        {noticia.imagen_url && <img src={noticia.imagen_url} alt="" className="not-card__imagen" />}

        <div className="not-card__meta">
          {ruta && <span className="not-card__ruta">{ruta}</span>}
          {noticia.tipo === 'promocion' && noticia.descuento_pct != null && (
            <span className="not-card__descuento">{noticia.descuento_pct}% de descuento</span>
          )}
        </div>

        {noticia.contenido && <p className="not-detalle__contenido">{noticia.contenido}</p>}

        <dl className="not-detalle__datos">
          {origen && (
            <div>
              <dt>Origen</dt>
              <dd>{noticia.origen?.ciudad}{noticia.origen?.codigo ? ` (${noticia.origen.codigo})` : ''}</dd>
            </div>
          )}
          {destino && (
            <div>
              <dt>Destino</dt>
              <dd>{noticia.destino?.ciudad}{noticia.destino?.codigo ? ` (${noticia.destino.codigo})` : ''}</dd>
            </div>
          )}
          {noticia.vuelo_id != null && (
            <>
              <div>
                <dt>Salida</dt>
                <dd>{formatDate(noticia.salida, zona)} · {formatTime(noticia.salida, zona)}</dd>
              </div>
              <div>
                <dt>Precio por persona</dt>
                <dd>
                  {formatPrice(noticia.precio, noticia.moneda)}
                  {noticia.precio_original != null && <> (antes {formatPrice(noticia.precio_original, noticia.moneda)})</>}
                </dd>
              </div>
            </>
          )}
          <div>
            <dt>Vigente hasta</dt>
            <dd>{formatDate(noticia.vigente_hasta, 'America/Bogota')}</dd>
          </div>
        </dl>

        {(rol === ROLES.ADMIN || (rol === ROLES.CLIENTE && noticia.vuelo_id != null)) && (
          <div className="not-detalle__acciones">
            {rol === ROLES.CLIENTE && noticia.vuelo_id != null && (
              <Link className="btn btn-primary" to={`/comprar/${noticia.vuelo_id}`}>
                Reservar o comprar {ruta}
              </Link>
            )}
            {rol === ROLES.ADMIN && (
              <Button variant="danger" onClick={() => setConfirmar({ open: true, loading: false })}>
                Eliminar noticia
              </Button>
            )}
          </div>
        )}
      </article>

      <ConfirmDialog
        open={confirmar.open}
        danger
        loading={confirmar.loading}
        title="Eliminar noticia"
        confirmLabel="Eliminar"
        message={`¿Seguro que quieres eliminar «${noticia.titulo || 'esta noticia'}»? Desaparecerá del listado y no se volverá a publicar. Esta acción no se puede deshacer.`}
        onConfirm={confirmarEliminar}
        onCancel={() => !confirmar.loading && setConfirmar({ open: false, loading: false })}
      />
    </div>
  )
}
