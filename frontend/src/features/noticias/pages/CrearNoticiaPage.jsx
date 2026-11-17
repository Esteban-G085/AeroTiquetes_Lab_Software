import { useNavigate, useState, useEffect, useCallback } from 'react'
import { useToast } from '@/components/feedback'
import { BackLink, PageHeader } from '@/components/layout'
import { Button, Card, Input, Notice } from '@/components/ui'
import { crearNoticia } from '../api'
import '../noticias.css'

/** HU11 (admin) — Crear una noticia manualmente (solo administrador/root). */
export default function CrearNoticiaPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')
  const [imagen, setImagen] = useState(null)
  const [idVuelo, setIdVuelo] = useState('')
  const [vigenteHasta, setVigenteHasta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState('')

  // Detectar cambios sin guardar para confirmar antes de salir
  const [formTouched, setFormTouched] = useState(false)

  const hayCambiosSinGuardar =
    formTouched &&
    (titulo.trim() !== '' ||
      contenido.trim() !== '' ||
      imagen !== null ||
      idVuelo !== '' ||
      vigenteHasta !== '')

  const limpiarErrores = useCallback(() => {
    setErrores({})
    setErrorGeneral('')
  }, [])

  async function enviar(e) {
    e.preventDefault()
    limpiarErrores()
    setEnviando(true)
    try {
      const payload = {
        tipo: 'vuelo',
        titulo: titulo.trim() || null,
        contenido: contenido.trim() || null,
        imagen,
        id_vuelo: idVuelo ? Number(idVuelo) : null,
        vigente_hasta: vigenteHasta || null,
      }
      await crearNoticia(payload)
      toast.success('Noticia creada correctamente.')
      navigate('/noticias', { replace: true })
    } catch (err) {
      if (err?.fields) {
        setErrores(err.fields)
      }
      setErrorGeneral(err?.message ?? 'No se pudo crear la noticia.')
    } finally {
      setEnviando(false)
    }
  }

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hayCambiosSinGuardar) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hayCambiosSinGuardar])

  return (
    <div className="not-page">
      <BackLink to="/noticias">Volver a noticias</BackLink>

      <PageHeader
        eyebrow="Administración"
        title="Crear noticia"
        subtitle="Publica una noticia manualmente (visible para clientes y administradores)."
      />

      <Card as="form" className="not-card at-card--padded" onSubmit={enviar} noValidate>
        <div className="not-form__grid">
          <Input
            label="Título *"
            type="text"
            value={titulo}
            onChange={(e) => {
              setFormTouched(true)
              setTitulo(e.target.value)
            }}
            placeholder="Ej. Nuevo vuelo disponible"
            required
            error={errores.titulo}
          />
          <div className="at-field">
            <label htmlFor="contenido" className="form-label">
              Contenido <span aria-hidden="true">*</span>
            </label>
            <textarea
              id="contenido"
              className={`form-control ${errores.contenido ? 'is-invalid' : ''}`}
              value={contenido}
              onChange={(e) => {
                setFormTouched(true)
                setContenido(e.target.value)
              }}
              placeholder="Escribe el cuerpo de la noticia…"
              rows={5}
              required
              aria-invalid={!!errores.contenido || undefined}
              aria-describedby={errores.contenido ? 'error-contenido' : undefined}
              maxLength={1000}
            />
            {errores.contenido && (
              <p id="error-contenido" className="at-field__error" role="alert">
                {errores.contenido}
              </p>
            )}
          </div>
          <Input
            label="Imagen (subir desde tu PC)"
            type="file"
            accept="image/*"
            onChange={(e) => {
              setFormTouched(true)
              const file = e.target.files?.[0] ?? null
              setImagen(file)
            }}
            error={errores.imagen}
          />
          <Input
            label="ID de vuelo vinculado (opcional)"
            type="number"
            min="1"
            value={idVuelo}
            onChange={(e) => {
              setFormTouched(true)
              setIdVuelo(e.target.value)
            }}
            placeholder="Ej. 12"
            error={errores.id_vuelo}
          />
          <Input
            label="Vigente hasta (opcional)"
            type="datetime-local"
            value={vigenteHasta}
            onChange={(e) => {
              setFormTouched(true)
              setVigenteHasta(e.target.value)
            }}
          />
        </div>

        {errorGeneral && (
          <Notice tone="danger" className="mt-4" role="alert">
            {errorGeneral}
          </Notice>
        )}

        <div className="not-form__actions mt-4">
          <Button type="submit" loading={enviando} disabled={enviando}>
            Publicar noticia
          </Button>
          <Button
            type="button"
            variant="outline-secondary"
            onClick={() => {
              if (
                hayCambiosSinGuardar &&
                !window.confirm('¿Descartar los cambios sin guardar?')
              ) {
                return
              }
              navigate('/noticias', { replace: true })
            }}
          >
            Cancelar
          </Button>
        </div>
      </Card>
    </div>
  )
}
