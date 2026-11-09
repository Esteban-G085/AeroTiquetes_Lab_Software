import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState } from '@/components/feedback'
import { Button, Notice } from '@/components/ui'
import { PageHeader, BackLink } from '@/components/layout'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/feedback'
import {
  listarNoticias,
  suscribirseNoticias,
  cancelarSuscripcionNoticias,
} from '../api'
import '../noticias.css'

/** HU11 — Noticias de vuelos: consultar, suscribirse y cancelar suscripción (cliente). */
export default function NoticiasPage() {
  const { rol, isAuthenticated } = useAuth()
  const toast = useToast()
  const [noticias, setNoticias] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [suscrito, setSuscrito] = useState(null) // null | true | false
  const [suscripcionStatus, setSuscripcionStatus] = useState('idle') // idle | saving | success | error

  const cargarNoticias = useCallback(async () => {
    setStatus('loading')
    try {
      const { items } = await listarNoticias()
      setNoticias(items)
      setStatus('ready')
    } catch (err) {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    cargarNoticias()
  }, [cargarNoticias])

  async function manejarSuscripcion() {
    if (!isAuthenticated) {
      toast.info('Debes iniciar sesión para suscribirte a las noticias.')
      return
    }
    setSuscripcionStatus('saving')
    try {
      if (suscrito) {
        await cancelarSuscripcionNoticias()
        setSuscrito(false)
        toast.success('Te has dado de baja de las noticias.')
      } else {
        await suscribirseNoticias()
        setSuscrito(true)
        toast.success('Te has suscrito a las noticias de vuelos.')
      }
      setSuscripcionStatus('success')
    } catch (err) {
      setSuscripcionStatus('error')
      toast.error(err?.message ?? 'No se pudo actualizar tu suscripción.')
    }
  }

  const esAdmin = rol === 'administrador' || rol === 'root'

  return (
    <div className="not-page">
      <BackLink to="/">Volver al inicio</BackLink>

      <PageHeader
        eyebrow="Noticias"
        title="Noticias de vuelos"
        subtitle="Mantente al tanto de los nuevos vuelos y novedades de AeroTiquetes."
      />

      {status === 'loading' && (
        <div className="not-skeleton">
          <div className="not-card-skeleton" />
          <div className="not-card-skeleton" />
          <div className="not-card-skeleton" />
        </div>
      )}

      {status === 'error' && (
        <ErrorState
          message="No se pudieron cargar las noticias. Intenta de nuevo más tarde."
          onRetry={() => cargarNoticias()}
        />
      )}

      {status === 'ready' && noticias.length === 0 && (
        <EmptyState
          title="No hay noticias por ahora"
          message="Pronto publicaremos novedades sobre nuevos vuelos y destinos."
        />
      )}

      {status === 'ready' && noticias.length > 0 && (
        <>
          <div className="not-grid">
            {noticias.map((n) => (
              <article key={n.id ?? n.codigo ?? n.titulo} className="not-card">
                {n.imagen && <img src={n.imagen} alt={n.titulo} className="not-card__imagen" />}
                <div className="not-card__contenido">
                  <div className="not-card__meta">
                    <span className="not-card__fecha">{n.fecha_publicacion || n.fecha || ''}</span>
                    {n.origen && n.destino && (
                      <span className="not-card__ruta">
                        {typeof n.origen === 'object' ? n.origen.codigo ?? n.origen : n.origen}
                        {' → '}
                        {typeof n.destino === 'object' ? n.destino.codigo ?? n.destino : n.destino}
                      </span>
                    )}
                  </div>
                  <h3 className="not-card__titulo">{n.titulo}</h3>
                  <p className="not-card__resumen">{n.resumen || n.descripcion || ''}</p>
                  {n.precio !== undefined && (
                    <span className="not-card__precio">
                      Desde {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(n.precio)}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="not-suscripcion at-card at-card--padded mt-4">
            <PageHeader eyebrow="Suscripción" title="Recibe noticias por correo" subtitle="¿Quieres recibir avisos cuando publiquemos una nueva noticia?" />
            <p className="not-suscripcion__estado">
              {suscrito === null
                ? 'Estado de suscripción: por definir.'
                : suscrito
                ? 'Estás suscrito a las noticias de vuelos.'
                : 'No estás suscrito a las noticias.'}
            </p>
            {isAuthenticated ? (
              <Button
                onClick={manejarSuscripcion}
                loading={suscripcionStatus === 'saving'}
                variant={suscrito ? 'danger' : 'primary'}
                className="not-suscripcion__boton"
              >
                {suscrito ? 'Cancelar suscripción' : 'Suscribirse a las noticias'}
              </Button>
            ) : (
              <Notice tone="info" className="not-suscripcion__aviso">
                Inicia sesión para poder suscribirte a las noticias y recibir avisos por correo.
              </Notice>
            )}
            {esAdmin && (
              <Notice tone="neutral" className="not-suscripcion__aviso mt-2">
                Como administrador también puedes gestionar noticias desde el panel de administración.
              </Notice>
            )}
          </div>
        </>
      )}
    </div>
  )
}
