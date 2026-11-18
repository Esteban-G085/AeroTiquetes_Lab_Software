import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState, useToast } from '@/components/feedback'
import { Button, ConfirmDialog, Input, Notice } from '@/components/ui'
import { PageHeader, BackLink } from '@/components/layout'
import { ROLES } from '@/config/roles'
import { useAuth } from '@/context/AuthContext'
import { formatDate, formatPrice, formatTime } from '@/utils/format'
import {
  listarNoticias,
  estadoSuscripcion,
  suscribirseNoticias,
  cancelarSuscripcionNoticias,
  eliminarNoticia,
} from '../api'
import '../noticias.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const TAMANO_NOTICIAS = 6

/** "Bogotá a Medellín" con la forma de ciudad/código que envía el backend. */
const rutaDe = (n) => {
  const origen = n.origen?.ciudad || n.origen?.codigo || ''
  const destino = n.destino?.ciudad || n.destino?.codigo || ''
  return origen && destino ? `${origen} a ${destino}` : ''
}

const tituloDe = (n) => {
  if (n.titulo) return n.titulo
  return rutaDe(n) ? `Nuevo vuelo ${n.origen?.ciudad || n.origen?.codigo} → ${n.destino?.ciudad || n.destino?.codigo}` : 'Noticia'
}

/** HU11 — Consultar noticias y gestionar la suscripción por correo (solo clientes). */
export default function NoticiasPage() {
  const { rol } = useAuth()
  const toast = useToast()
  const [noticias, setNoticias] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(0)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [suscrito, setSuscrito] = useState(false)
  const [correo, setCorreo] = useState('')
  const [errorCorreo, setErrorCorreo] = useState('')
  const [suscripcionStatus, setSuscripcionStatus] = useState('idle') // idle | saving
  const [confirmar, setConfirmar] = useState({ target: null, loading: false })

  const esCliente = rol === ROLES.CLIENTE
  const esAdmin = rol === ROLES.ADMIN

  const cargarNoticias = useCallback(async () => {
    setStatus('loading')
    try {
      const respuesta = await listarNoticias({ pagina: 1, tamano: TAMANO_NOTICIAS })
      setNoticias(respuesta.items)
      setTotal(respuesta.total)
      setPagina(1)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  const cargarMas = useCallback(async () => {
    if (cargandoMas || noticias.length >= total) return
    setCargandoMas(true)
    try {
      const respuesta = await listarNoticias({ pagina: pagina + 1, tamano: TAMANO_NOTICIAS })
      setNoticias((prev) => {
        const vistos = new Set(prev.map((n) => n.id))
        return [...prev, ...respuesta.items.filter((n) => !vistos.has(n.id))]
      })
      setTotal(respuesta.total)
      setPagina((p) => p + 1)
    } catch {
      toast.error('No se pudieron cargar más noticias.')
    } finally {
      setCargandoMas(false)
    }
  }, [cargandoMas, noticias.length, total, pagina, toast])

  const cargarSuscripcion = useCallback(async () => {
    if (!esCliente) return
    try {
      const estado = await estadoSuscripcion()
      setSuscrito(Boolean(estado?.suscrito))
      setCorreo(estado?.correo ?? '')
    } catch {
      setSuscrito(false)
    }
  }, [esCliente])

  useEffect(() => {
    cargarNoticias()
    cargarSuscripcion()
  }, [cargarNoticias, cargarSuscripcion])

  async function suscribirse(e) {
    e.preventDefault()
    setErrorCorreo('')
    const valor = correo.trim()
    if (!EMAIL_RE.test(valor)) {
      setErrorCorreo('Escribe un correo válido.')
      return
    }
    setSuscripcionStatus('saving')
    try {
      await suscribirseNoticias(valor)
      setSuscrito(true)
      setCorreo(valor)
      toast.success('Te has suscrito a las noticias de vuelos.')
    } catch (err) {
      setErrorCorreo(err?.fields?.correo ?? err?.message ?? 'No se pudo completar la suscripción.')
    } finally {
      setSuscripcionStatus('idle')
    }
  }

  async function cancelar() {
    setSuscripcionStatus('saving')
    setErrorCorreo('')
    try {
      await cancelarSuscripcionNoticias()
      setSuscrito(false)
      toast.success('Te has dado de baja de las noticias.')
    } catch (err) {
      toast.error(err?.message ?? 'No se pudo cancelar la suscripción.')
    } finally {
      setSuscripcionStatus('idle')
    }
  }

  async function confirmarEliminar() {
    setConfirmar((prev) => ({ ...prev, loading: true }))
    try {
      await eliminarNoticia(confirmar.target.id)
      toast.success('La noticia fue eliminada.')
      setConfirmar({ target: null, loading: false })
      await cargarNoticias()
    } catch (err) {
      toast.error(err?.message ?? 'No se pudo eliminar la noticia.')
      setConfirmar({ target: null, loading: false })
    }
  }

  const acciones = esAdmin ? (
    <Link to="/noticias/crear" className="btn btn-primary">Crear noticia</Link>
  ) : null

  return (
    <div className="not-page">
      <a href="#contenido-principal" className="skip-link">Saltar al contenido principal</a>

      <BackLink to="/">Volver al inicio</BackLink>

      <PageHeader
        eyebrow="Noticias"
        title="Noticias de vuelos"
        subtitle="Mantente al tanto de los nuevos vuelos y novedades de AeroTiquetes."
        actions={acciones}
      />

      <main id="contenido-principal" tabIndex={-1}>
        {status === 'loading' && (
          <div className="not-skeleton" role="status" aria-label="Cargando noticias" aria-live="polite">
            <div className="not-card-skeleton" />
            <div className="not-card-skeleton" />
            <div className="not-card-skeleton" />
          </div>
        )}

        {status === 'error' && (
          <ErrorState
            message="No se pudieron cargar las noticias. Intenta de nuevo más tarde."
            onRetry={cargarNoticias}
          />
        )}

        {status === 'ready' && noticias.length === 0 && (
          <EmptyState
            title="No hay noticias por ahora"
            message="Pronto publicaremos novedades sobre nuevos vuelos y destinos."
          />
        )}

        {status === 'ready' && noticias.length > 0 && (
          <section aria-label="Lista de noticias">
            <div className="not-grid">
              {noticias.map((n) => {
                const ruta = rutaDe(n)
                const zona = n.salida_zona || 'America/Bogota'
                return (
                  <article key={n.id} className="not-card" aria-labelledby={`noticia-titulo-${n.id}`}>
                    {n.imagen_url ? (
                      <img src={n.imagen_url} alt="" className="not-card__imagen" />
                    ) : (
                      <div className="not-card__portada" aria-hidden="true">
                        <span>{n.origen?.codigo || 'AT'}</span>
                        <span>→</span>
                        <span>{n.destino?.codigo || '✈'}</span>
                      </div>
                    )}
                    <div className="not-card__contenido">
                      <div className="not-card__meta">
                        <span className="not-card__fecha">{formatDate(n.publicada_en, 'America/Bogota')}</span>
                        {ruta && <span className="not-card__ruta">{ruta}</span>}
                        {n.tipo === 'promocion' && <span className="not-card__tipo">Promoción</span>}
                      </div>

                      <h3 id={`noticia-titulo-${n.id}`} className="not-card__titulo">{tituloDe(n)}</h3>

                      {n.tipo === 'promocion' && n.descuento_pct != null && (
                        <p className="not-card__descuento">{n.descuento_pct}% de descuento</p>
                      )}

                      {n.contenido && <p className="not-card__resumen">{n.contenido}</p>}

                      {n.vuelo_id != null && (
                        <p className="not-card__salida">
                          Sale el {formatDate(n.salida, zona)} a las {formatTime(n.salida, zona)}
                        </p>
                      )}

                      {n.precio > 0 && (
                        <p className="not-card__precio">
                          Desde {formatPrice(n.precio, n.moneda)} por persona
                          {n.precio_original != null && <> · antes {formatPrice(n.precio_original, n.moneda)}</>}
                        </p>
                      )}

                      <div className="not-card__acciones">
                        <Link className="not-card__detalle" to={`/noticias/${n.id}`}>Ver detalle</Link>
                        {esCliente && n.vuelo_id != null && (
                          <Link
                            className="not-card__comprar"
                            to={`/comprar/${n.vuelo_id}`}
                            aria-label={`Reservar o comprar ${ruta}`}
                          >
                            Reservar o comprar
                          </Link>
                        )}
                        {esAdmin && (
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            className="not-card__eliminar"
                            onClick={() => setConfirmar({ target: n, loading: false })}
                          >
                            Eliminar
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
            {noticias.length < total && (
              <div className="not-mas">
                <Button
                  type="button"
                  variant="outline-secondary"
                  loading={cargandoMas}
                  onClick={cargarMas}
                >
                  Cargar más noticias
                </Button>
              </div>
            )}
          </section>
        )}

        {esCliente && (
          <section className="not-suscripcion at-card at-card--padded mt-4" aria-label="Suscripción a noticias">
            <PageHeader
              eyebrow="Suscripción"
              title="Recibe noticias por correo"
              subtitle="Te avisaremos cuando publiquemos una noticia nueva."
            />
            <p className="not-suscripcion__estado">
              {suscrito
                ? `Estás suscrito a las noticias de vuelos en ${correo}.`
                : 'No estás suscrito a las noticias.'}
            </p>
            <form className="not-suscripcion__form" onSubmit={suscribirse} noValidate>
              <Input
                label="Correo"
                name="correo"
                type="email"
                autoComplete="email"
                placeholder="usuario@correo.com"
                value={correo}
                onChange={(e) => { setCorreo(e.target.value); setErrorCorreo('') }}
                error={errorCorreo}
              />
              <div className="not-suscripcion__acciones">
                <Button type="submit" loading={suscripcionStatus === 'saving'}>
                  {suscrito ? 'Actualizar correo' : 'Suscribirme'}
                </Button>
                {suscrito && (
                  <Button type="button" variant="danger" onClick={cancelar} disabled={suscripcionStatus === 'saving'}>
                    Cancelar suscripción
                  </Button>
                )}
              </div>
            </form>
          </section>
        )}

        {!esCliente && !esAdmin && (
          <Notice tone="info" className="not-suscripcion__aviso mt-4">
            Inicia sesión como cliente para suscribirte a las noticias y recibir avisos por correo.
          </Notice>
        )}
      </main>

      <ConfirmDialog
        open={Boolean(confirmar.target)}
        danger
        loading={confirmar.loading}
        title="Eliminar noticia"
        confirmLabel="Eliminar"
        message={
          confirmar.target
            ? `¿Seguro que quieres eliminar «${tituloDe(confirmar.target)}»? La noticia desaparecerá del listado y no se volverá a publicar. Esta acción no se puede deshacer.`
            : ''
        }
        onConfirm={confirmarEliminar}
        onCancel={() => !confirmar.loading && setConfirmar({ target: null, loading: false })}
      />
    </div>
  )
}
