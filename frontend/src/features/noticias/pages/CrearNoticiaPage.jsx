import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
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
  const [imagenUrl, setImagenUrl] = useState('')
  const [idVuelo, setIdVuelo] = useState('')
  const [vigenteHasta, setVigenteHasta] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
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
      toast.error(err?.message ?? 'No se pudo crear la noticia.')
    } finally {
      setEnviando(false)
    }
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
            label="Título"
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej. Nuevo vuelo disponible"
            required
          />
          <textarea
            className="form-control"
            label="Contenido"
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            placeholder="Escribe el cuerpo de la noticia…"
            rows={5}
          />
          <Input
            label="URL de imagen (opcional)"
            type="url"
            value={imagenUrl}
            onChange={(e) => setImagenUrl(e.target.value)}
            placeholder="https://ejemplo.com/imagen.jpg"
          />
          <Input
            label="ID de vuelo vinculado (opcional)"
            type="number"
            min="1"
            value={idVuelo}
            onChange={(e) => setIdVuelo(e.target.value)}
            placeholder="Ej. 12"
          />
          <Input
            label="Vigente hasta (opcional)"
            type="datetime-local"
            value={vigenteHasta}
            onChange={(e) => setVigenteHasta(e.target.value)}
          />
        </div>

        <div className="not-form__actions mt-4">
          <Button type="submit" loading={enviando}>Publicar noticia</Button>
          <Button type="button" variant="outline-secondary" onClick={() => navigate('/noticias', { replace: true })}>
            Cancelar
          </Button>
        </div>
      </Card>
    </div>
  )
}
