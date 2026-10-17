import { useState } from 'react'
import { Badge, Button, ConfirmDialog, Icon, Input, Notice, Skeleton } from '@/components/ui'
import { ErrorState, useToast } from '@/components/feedback'
import { PageHeader } from '@/components/layout'
import { ApiError } from '@/services/apiError'
import { resolveMediaUrl } from '@/utils/media'
import { useAsyncData } from '@/utils/useAsyncData'
import { crearAdministrador, eliminarAdministrador, listarAdministradores } from '../api'
import { validateNuevoAdmin } from '../validators'
import '../usuarios.css'

const ESTADOS = {
  activo: { tone: 'success', label: 'Activo' },
  pendiente: { tone: 'warning', label: 'Pendiente' },
}

const initials = (name) => String(name ?? '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'

function AdminAvatar({ src, name }) {
  return (
    <span className="us-adm__avatar" aria-hidden="true">
      {src ? <img src={resolveMediaUrl(src)} alt="" /> : initials(name)}
    </span>
  )
}

function ListSkeleton() {
  return (
    <div role="status" aria-label="Cargando administradores" className="us-adm__list">
      {[0, 1, 2].map((i) => (
        <div key={i} className="us-adm__item">
          <Skeleton circle width="2.8rem" />
          <div className="us-adm__who"><Skeleton width="9rem" height=".9rem" /><Skeleton width="12rem" height=".75rem" /></div>
          <Skeleton width="4.5rem" height="1.4rem" />
        </div>
      ))}
    </div>
  )
}

/** HU23 — Gestionar administradores (solo root). Crear y eliminar; sin edición (R21). */
export default function AdministradoresPage() {
  const toast = useToast()
  const { status, data: admins, error, reload, refresh } = useAsyncData(listarAdministradores)

  const [values, setValues] = useState({ nombre: '', correo: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [creating, setCreating] = useState(false)

  const [target, setTarget] = useState(null) // administrador pendiente de confirmar eliminación
  const [deleting, setDeleting] = useState(false)

  const onChange = (e) => {
    const { name, value } = e.target
    setValues((v) => ({ ...v, [name]: value }))
    setErrors((p) => (p[name] ? { ...p, [name]: undefined } : p))
  }

  async function create(e) {
    e.preventDefault()
    const found = validateNuevoAdmin(values)
    setErrors(found)
    if (Object.keys(found).length) { setFormError(''); return }

    setFormError(''); setCreating(true)
    try {
      await crearAdministrador(values)
      toast.success(`Enviamos el enlace de primer ingreso a ${values.correo.trim()}.`)
      setValues({ nombre: '', correo: '' })
      refresh()
    } catch (err) {
      const fields = err instanceof ApiError ? err.fields : {}
      const known = Object.fromEntries(Object.entries(fields).filter(([k]) => k in values))
      setErrors(known)
      setFormError(Object.keys(known).length ? '' : err.message)
    } finally {
      setCreating(false)
    }
  }

  async function confirmDelete() {
    setDeleting(true)
    try {
      await eliminarAdministrador(target.id)
      toast.success(`${target.nombre} fue eliminado.`)
      setTarget(null)
      refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="us-adm">
      <PageHeader
        eyebrow="Panel del root"
        title="Gestionar administradores"
        subtitle="Crea administradores y elimina a quienes ya no deban tener acceso."
      />

      <div className="us-adm__layout">
        <section className="at-card us-adm__new at-enter-2" aria-labelledby="adm-nuevo">
          <h2 id="adm-nuevo" className="us-card__title">Nuevo administrador</h2>
          <p className="us-adm__help">El administrador completará el resto de su registro al ingresar por primera vez.</p>

          <form onSubmit={create} noValidate>
            {formError && <Notice tone="danger" className="mb-3">{formError}</Notice>}
            <Input label="Nombre" name="nombre" placeholder="nombre" autoComplete="off"
              value={values.nombre} onChange={onChange} error={errors.nombre} />
            <Input label="Correo" name="correo" type="email" placeholder="usuario@123.com" autoComplete="off"
              value={values.correo} onChange={onChange} error={errors.correo} />
            <Button type="submit" className="w-100" loading={creating}>Crear administrador</Button>
          </form>
        </section>

        <section className="at-card us-adm__current at-enter-3" aria-labelledby="adm-actuales">
          <div className="us-adm__listhead">
            <h2 id="adm-actuales" className="us-card__title">Administradores actuales</h2>
            {status === 'ready' && <span className="us-adm__count">{admins.length}</span>}
          </div>

          {status === 'loading' && <ListSkeleton />}
          {status === 'error' && <ErrorState message={error?.message} onRetry={reload} />}
          {status === 'ready' && admins.length === 0 && (
            <p className="us-adm__empty">Aún no hay administradores. Crea el primero con el formulario.</p>
          )}
          {status === 'ready' && admins.length > 0 && (
            <ul className="us-adm__list">
              {admins.map((a) => {
                const estado = ESTADOS[a.estado] ?? { tone: 'neutral', label: a.estado }
                return (
                  <li key={a.id} className="us-adm__item">
                    <AdminAvatar src={a.imagen_url} name={a.nombre} />
                    <div className="us-adm__who">
                      <span className="us-adm__name">{a.nombre}</span>
                      <span className="us-adm__mail">{a.correo}</span>
                    </div>
                    <Badge tone={estado.tone}>{estado.label}</Badge>
                    <button type="button" className="us-adm__trash" aria-label={`Eliminar a ${a.nombre}`} onClick={() => setTarget(a)}>
                      <Icon name="trash" size={20} />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(target)} danger loading={deleting}
        title="Eliminar administrador" confirmLabel="Eliminar"
        message={target && `¿Seguro que quieres eliminar a ${target.nombre} (${target.correo})? ${
          target.estado === 'pendiente' ? 'Su enlace de primer ingreso dejará de funcionar. ' : ''}Esta acción no se puede deshacer.`}
        onConfirm={confirmDelete} onCancel={() => !deleting && setTarget(null)}
      />
    </div>
  )
}
