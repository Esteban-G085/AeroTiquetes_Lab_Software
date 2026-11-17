import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/feedback'
import { BackLink, PageHeader } from '@/components/layout'
import { Button, Card, Input, Notice } from '@/components/ui'
import { crearNoticia } from '../api'
import '../noticias.css'

/** HU11 (admin) — Crear una noticia manualmente (solo administrador). */
export default function CrearNoticiaPage() {
  const navigate = useNavigate()
  const toast = useToast()

  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')
  const [imagenUrl, setImagenUrl] = useState('')
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
      imagenUrl !== '' ||
      idVuelo !== '' ||
      vigenteHasta !== '')

  const limpiarErrores = () => {
    setErrores({})
    setErrorGeneral('')
  }

  async function enviar(e) {
    e.preventDefault()
    limpiarErrores()
    setEnviando(true)
    try {
      const payload = {
        tipo: 'vuelo',
        titulo: titulo.trim() || null,
        contenido: contenido.trim() || null,
        imagen_url: imagenUrl.trim() || null,
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

  const handleTituloChange = (e) => {
    setFormTouched(true)
    setTitulo(e.target.value)
  }

  const handleContenidoChange = (e) => {
    setFormTouched(true)
    setContenido(e.target.value)
  }

  const handleImagenUrlChange = (e) => {
    setFormTouched(true)
    setImagenUrl(e.target.value)
  }

  const handleIdVueloChange = (e) => {
    setFormTouched(true)
    setIdVuelo(e.target.value)
  }

  const handleVigenteHastaChange = (e) => {
    setFormTouched(true)
    setVigenteHasta(e.target.value)
  }

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
            onChange={handleTituloChange}
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
              onChange={handleContenidoChange}
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
            label="URL de imagen (opcional)"
            type="url"
            value={imagenUrl}
            onChange={handleImagenUrlChange}
            placeholder="https://ejemplo.com/imagen.jpg"
            error={errores.imagen_url}
          />
          <Input
            label="ID de vuelo vinculado (opcional)"
            type="number"
            min="1"
            value={idVuelo}
            onChange={handleIdVueloChange}
            placeholder="Ej. 12"
            error={errores.id_vuelo}
          />
          <Input
            label="Vigente hasta (opcional)"
            type="datetime-local"
            value={vigenteHasta}
            onChange={handleVigenteHastaChange}
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
