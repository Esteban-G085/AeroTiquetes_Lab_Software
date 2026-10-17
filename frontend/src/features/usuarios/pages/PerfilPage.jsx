import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Icon, Input, Notice, Select } from '@/components/ui'
import { ErrorState, LoadingState, useToast } from '@/components/feedback'
import { HOME_BY_ROLE, ROLES } from '@/config/roles'
import { useAuth } from '@/context'
import { ApiError } from '@/services/apiError'
import { useGoBack } from '@/utils/useGoBack'
import PerfilShell, { PerfilAvatar } from '../components/PerfilShell'
import PerfilSection from '../components/PerfilSection'
import CorreoDialog from '../components/CorreoDialog'
import { usePerfil } from '../hooks/usePerfil'
import { actualizarPerfil } from '../api'
import { GENEROS, PROFILE_EDITABLE, todayISO, validateImagen, validateProfile } from '../validators'
import '../usuarios.css'

const GENERO_LABEL = Object.fromEntries(GENEROS.map((g) => [g.value, g.label]))
const fullName = (p) => [p?.nombres, p?.apellidos].filter(Boolean).join(' ')
const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj?.[k] ?? '']))

const formatDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

function ReadOnlyItem({ label, value }) {
  return (
    <div className="us-perfil__item">
      <dt>{label}</dt>
      <dd>{value || '—'}</dd>
    </div>
  )
}

/** Fila "dato + acción" (correo, contraseña). */
function ActionRow({ label, value, children }) {
  return (
    <div className="us-row">
      <div className="us-row__info">
        {label && <p className="us-row__label">{label}</p>}
        <p className="us-row__value">{value}</p>
      </div>
      {children}
    </div>
  )
}

/** HU2 — Gestionar perfil. Cliente y administrador ven/editan sus datos; el root solo su Id y contraseña. */
export default function PerfilPage() {
  const { rol, updateUser } = useAuth()
  const isRoot = rol === ROLES.ROOT
  const navigate = useNavigate()
  const toast = useToast()
  const goBack = useGoBack(HOME_BY_ROLE[rol])
  const { status, perfil, error, reload, refresh } = usePerfil()

  const fileRef = useRef(null)
  const formRef = useRef(null)
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState({})
  const [imagen, setImagen] = useState(null)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [correoOpen, setCorreoOpen] = useState(false)

  const preview = useMemo(() => (imagen ? URL.createObjectURL(imagen) : null), [imagen])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  if (status === 'loading') return <div className="us-perfil__state"><LoadingState label="Cargando tu perfil…" /></div>
  if (status === 'error') {
    return (
      <div className="us-perfil__state">
        <ErrorState message={error?.message} onRetry={reload} />
      </div>
    )
  }

  const startEdit = () => {
    setValues(pick(perfil, PROFILE_EDITABLE))
    setImagen(null); setErrors({}); setFormError(''); setEditing(true)
  }
  const cancelEdit = () => { setEditing(false); setImagen(null); setErrors({}); setFormError('') }

  const onChange = (e) => {
    const { name, value } = e.target
    setValues((v) => ({ ...v, [name]: value }))
    setErrors((p) => (p[name] ? { ...p, [name]: undefined } : p))
  }

  const onPickFile = (e) => {
    const file = e.target.files?.[0] ?? null
    e.target.value = ''
    if (!file) return
    setImagen(file)
    setErrors((p) => ({ ...p, imagen: validateImagen(file) ?? undefined }))
  }

  async function save(e) {
    e.preventDefault()
    const found = validateProfile(values)
    const imagenError = validateImagen(imagen)
    if (imagenError) found.imagen = imagenError
    setErrors(found)
    if (Object.keys(found).length) {
      setFormError('')
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus())
      return
    }

    setFormError(''); setSaving(true)
    try {
      await actualizarPerfil(values, imagen)
      await refresh() // el backend es la fuente de verdad: se vuelve a leer GET /me
      updateUser({ nombres: values.nombres.trim(), apellidos: values.apellidos.trim() })
      toast.success('Perfil actualizado')
      cancelEdit()
    } catch (err) {
      const fields = err instanceof ApiError ? err.fields : {}
      const known = Object.fromEntries(Object.entries(fields).filter(([k]) => k in values || k === 'imagen'))
      setErrors(known)
      setFormError(Object.keys(known).length ? 'Revisa los campos marcados.' : err.message)
    } finally {
      setSaving(false)
    }
  }

  const name = isRoot ? 'Root' : fullName(perfil)
  const idLine = isRoot ? `Id: ${perfil.usuario ?? perfil.id}` : `Documento: ${perfil.dni}`

  return (
    <PerfilShell
      name={name} idLine={idLine}
      avatar={(
        <>
          <PerfilAvatar
            name={name} src={preview ?? perfil.imagen_url}
            onPick={editing && !isRoot ? () => fileRef.current?.click() : undefined}
          />
          <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="visually-hidden" tabIndex={-1}
            aria-label="Archivo de foto de perfil" onChange={onPickFile} />
        </>
      )}
      actions={editing ? (
        <>
          <Button variant="ghost" onClick={cancelEdit} disabled={saving}>Cancelar</Button>
          <Button type="submit" form="form-perfil" loading={saving}>Guardar cambios</Button>
        </>
      ) : (!isRoot && (
        <Button variant="outline-primary" onClick={startEdit}><Icon name="pencil" size={16} className="me-2" />Editar mis datos</Button>
      ))}
      onBack={goBack}
    >
      {errors.imagen && <Notice tone="danger" className="mb-3">{errors.imagen}</Notice>}

      {!isRoot && (
        <PerfilSection id="sec-datos" icon="user" title="Datos personales"
          description={editing ? 'El documento, el usuario y el correo no se editan aquí.' : undefined}>
          {editing ? (
            <form id="form-perfil" ref={formRef} onSubmit={save} noValidate>
              {formError && <Notice tone="danger" className="mb-3">{formError}</Notice>}
              <div className="us-perfil__grid">
                <Input label="Nombres" name="nombres" value={values.nombres} onChange={onChange} error={errors.nombres} />
                <Input label="Apellidos" name="apellidos" value={values.apellidos} onChange={onChange} error={errors.apellidos} />
                <Input label="Fecha de nacimiento" name="fecha_nacimiento" type="date" max={todayISO()}
                  value={values.fecha_nacimiento} onChange={onChange} error={errors.fecha_nacimiento} />
                <Input label="Lugar de nacimiento" name="lugar_nacimiento" value={values.lugar_nacimiento}
                  onChange={onChange} error={errors.lugar_nacimiento} />
                <Input label="Dirección de facturación" name="direccion_facturacion" value={values.direccion_facturacion}
                  onChange={onChange} error={errors.direccion_facturacion} />
                <Select label="Género" name="genero" value={values.genero} onChange={onChange}
                  error={errors.genero} placeholder="Selecciona" options={GENEROS} />
              </div>
            </form>
          ) : (
            <dl className="us-perfil__list">
              <ReadOnlyItem label="Usuario" value={perfil.usuario} />
              <ReadOnlyItem label="Fecha de nacimiento" value={formatDate(perfil.fecha_nacimiento)} />
              <ReadOnlyItem label="Lugar de nacimiento" value={perfil.lugar_nacimiento} />
              <ReadOnlyItem label="Dirección de facturación" value={perfil.direccion_facturacion} />
              <ReadOnlyItem label="Género" value={GENERO_LABEL[perfil.genero] ?? perfil.genero} />
            </dl>
          )}
        </PerfilSection>
      )}

      {!isRoot && (
        <PerfilSection id="sec-correo" icon="mail" title="Correo electrónico"
          description="Para cambiarlo te enviamos un enlace de verificación al correo nuevo.">
          <ActionRow label="Correo actual" value={perfil.correo}>
            <Button variant="outline-primary" onClick={() => setCorreoOpen(true)}>Cambiar correo</Button>
          </ActionRow>
          {perfil.correo_pendiente && (
            <Notice tone="info" className="mt-3">
              Pendiente de verificar: <strong>{perfil.correo_pendiente}</strong>. Revisa la bandeja de ese correo y abre el enlace.
            </Notice>
          )}
        </PerfilSection>
      )}

      <PerfilSection id="sec-pass" icon="lock" title="Contraseña"
        description="Cámbiala cuando lo necesites. Por seguridad, nunca la mostramos.">
        <ActionRow value={<><span aria-hidden="true">••••••••</span><span className="visually-hidden">Contraseña oculta</span></>}>
          <Button variant="outline-primary" onClick={() => navigate('/perfil/password')}>Cambiar contraseña</Button>
        </ActionRow>
      </PerfilSection>

      <CorreoDialog
        open={correoOpen} correoActual={perfil.correo}
        onClose={() => setCorreoOpen(false)}
        onSent={(correo) => {
          setCorreoOpen(false)
          toast.info(`Enviamos un enlace de verificación a ${correo}. Tu correo cambiará cuando lo confirmes.`)
          refresh()
        }}
      />
    </PerfilShell>
  )
}
