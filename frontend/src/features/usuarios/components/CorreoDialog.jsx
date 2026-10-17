import { useState } from 'react'
import { Button, Input, Modal, Notice } from '@/components/ui'
import { ApiError } from '@/services/apiError'
import { solicitarCambioCorreo } from '../api'
import { validateCambioCorreo } from '../validators'

/**
 * Cambio de correo con verificación (D8): correo nuevo + contraseña actual.
 * El backend envía un enlace al correo NUEVO; el correo no cambia hasta confirmarlo.
 */
export default function CorreoDialog({ open, correoActual, onClose, onSent }) {
  const [values, setValues] = useState({ correo_nuevo: '', password_actual: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  const change = (e) => {
    const { name, value } = e.target
    setValues((v) => ({ ...v, [name]: value }))
    setErrors((p) => (p[name] ? { ...p, [name]: undefined } : p))
  }

  const close = () => {
    if (loading) return
    setValues({ correo_nuevo: '', password_actual: '' })
    setErrors({}); setFormError('')
    onClose()
  }

  async function submit(e) {
    e.preventDefault()
    const found = validateCambioCorreo(values, correoActual)
    setErrors(found)
    if (Object.keys(found).length) return

    setFormError(''); setLoading(true)
    try {
      await solicitarCambioCorreo(values)
      const sentTo = values.correo_nuevo.trim()
      setLoading(false)
      setValues({ correo_nuevo: '', password_actual: '' })
      onSent(sentTo)
    } catch (err) {
      const fields = err instanceof ApiError ? err.fields : {}
      const known = Object.fromEntries(Object.entries(fields).filter(([k]) => k in values))
      setErrors(known)
      setFormError(Object.keys(known).length ? '' : err.message)
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open} title="Cambiar correo electrónico" onClose={close}
      footer={(
        <>
          <Button variant="ghost" onClick={close} disabled={loading}>Cancelar</Button>
          <Button type="submit" form="form-cambio-correo" loading={loading}>Enviar enlace</Button>
        </>
      )}
    >
      <form id="form-cambio-correo" onSubmit={submit} noValidate>
        <p className="text-secondary small">
          Te enviaremos un enlace al correo nuevo. Tu correo actual seguirá activo hasta que lo confirmes.
        </p>
        {formError && <Notice tone="danger" className="mb-3">{formError}</Notice>}
        <Input label="Correo nuevo" name="correo_nuevo" type="email" autoComplete="email" autoFocus
          value={values.correo_nuevo} onChange={change} error={errors.correo_nuevo} />
        <Input label="Contraseña actual" name="password_actual" type="password" autoComplete="current-password"
          value={values.password_actual} onChange={change} error={errors.password_actual} />
      </form>
    </Modal>
  )
}
