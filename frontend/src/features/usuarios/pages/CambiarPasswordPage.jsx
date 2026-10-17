import { useRef, useState } from 'react'
import { Button, Input, Notice } from '@/components/ui'
import { useToast } from '@/components/feedback'
import { ROLES } from '@/config/roles'
import { useAuth } from '@/context'
import { ApiError } from '@/services/apiError'
import { useGoBack } from '@/utils/useGoBack'
import PerfilShell, { PerfilAvatar } from '../components/PerfilShell'
import PerfilSection from '../components/PerfilSection'
import { usePerfil } from '../hooks/usePerfil'
import { cambiarPassword } from '../api'
import { validateCambioPassword } from '../validators'
import '../usuarios.css'

const EMPTY = { password_actual: '', password_nueva: '', confirmar: '' }

/** HU3 — Cambiar contraseña (actual + nueva). Mismo marco que el perfil. */
export default function CambiarPasswordPage() {
  const { rol, user } = useAuth()
  const isRoot = rol === ROLES.ROOT
  const toast = useToast()
  const { perfil } = usePerfil() // solo para la identidad del encabezado: si falla, no bloquea el cambio
  const formRef = useRef(null)
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  // Vuelve a donde estaba (normalmente /perfil); si se entró directo por URL, va a /perfil
  const toProfile = useGoBack('/perfil')

  const onChange = (e) => {
    const { name, value } = e.target
    setValues((v) => ({ ...v, [name]: value }))
    setErrors((p) => (p[name] ? { ...p, [name]: undefined } : p))
  }

  async function submit(e) {
    e.preventDefault()
    const found = validateCambioPassword(values)
    setErrors(found)
    if (Object.keys(found).length) {
      setFormError('')
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus())
      return
    }

    setFormError(''); setLoading(true)
    try {
      await cambiarPassword({ password_actual: values.password_actual, password_nueva: values.password_nueva })
      toast.success('Contraseña actualizada')
      toProfile()
    } catch (err) {
      const fields = err instanceof ApiError ? err.fields : {}
      const known = Object.fromEntries(Object.entries(fields).filter(([k]) => k in values))
      setErrors(known)
      setFormError(Object.keys(known).length ? '' : err.message)
      setLoading(false)
    }
  }

  const shown = perfil ?? user ?? {}
  const name = isRoot ? 'Root' : ([shown.nombres, shown.apellidos].filter(Boolean).join(' ') || shown.usuario || 'Mi cuenta')
  const idLine = isRoot ? `Id: ${shown.usuario ?? shown.id ?? ''}` : (shown.dni ? `Documento: ${shown.dni}` : '')

  return (
    <PerfilShell
      name={name} idLine={idLine} avatar={<PerfilAvatar name={name} src={perfil?.imagen_url} />}
      actions={(
        <>
          <Button variant="ghost" onClick={toProfile} disabled={loading}>Cancelar</Button>
          <Button type="submit" form="form-password" loading={loading}>Guardar cambios</Button>
        </>
      )}
      onBack={toProfile}
    >
      <PerfilSection id="sec-pass" icon="lock" title="Cambiar contraseña"
        description="Escribe la actual y elige una nueva. Confirma la nueva para evitar errores al teclear.">
        <form id="form-password" ref={formRef} onSubmit={submit} noValidate className="us-perfil__narrow">
          {formError && <Notice tone="danger" className="mb-3">{formError}</Notice>}
          <Input label="Contraseña actual" name="password_actual" type="password" autoComplete="current-password"
            value={values.password_actual} onChange={onChange} error={errors.password_actual} autoFocus />
          <Input label="Nueva contraseña" name="password_nueva" type="password" autoComplete="new-password"
            hint="Mín. 8 caracteres, con letras y números"
            value={values.password_nueva} onChange={onChange} error={errors.password_nueva} />
          <Input label="Confirmar nueva contraseña" name="confirmar" type="password" autoComplete="new-password"
            value={values.confirmar} onChange={onChange} error={errors.confirmar} />
        </form>
      </PerfilSection>
    </PerfilShell>
  )
}
