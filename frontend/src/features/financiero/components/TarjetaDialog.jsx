import { useState } from 'react'
import { Button, Input, Modal, Notice, Select } from '@/components/ui'
import { ApiError } from '@/services/apiError'
import { TARJETA_VACIA, TIPOS_TARJETA, validarTarjeta } from '../validators'

/**
 * Registrar o modificar una tarjeta (HU17). Al modificar, el código se vuelve a pedir: el backend no lo devuelve.
 * onSave(values) debe lanzar ApiError si el backend rechaza; sus `fields` se pintan en cada campo.
 */
export default function TarjetaDialog({ open, tarjeta, onSave, onClose }) {
  // El formulario vive en un hijo con `key`, así cada apertura empieza limpia sin efectos de reinicio.
  if (!open) return null
  return <Formulario key={tarjeta?.id ?? 'nueva'} tarjeta={tarjeta} onSave={onSave} onClose={onClose} />
}

function Formulario({ tarjeta, onSave, onClose }) {
  const editando = Boolean(tarjeta)
  const [values, setValues] = useState(editando ? { ...TARJETA_VACIA, ...tarjeta, numero: '', codigo: '' } : { ...TARJETA_VACIA })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const onChange = (e) => {
    const { name, value } = e.target
    setValues((v) => ({ ...v, [name]: value }))
    setErrors((p) => (p[name] ? { ...p, [name]: undefined } : p))
  }

  async function submit(e) {
    e.preventDefault()
    const found = validarTarjeta(values)
    setErrors(found)
    if (Object.keys(found).length) { setFormError(''); return }
    setSaving(true); setFormError('')
    try {
      await onSave(values)
    } catch (err) {
      const fields = err instanceof ApiError ? err.fields : {}
      const known = Object.fromEntries(Object.entries(fields).filter(([k]) => k in values))
      setErrors(known)
      setFormError(Object.keys(known).length ? '' : err.message)
      setSaving(false)
    }
  }

  return (
    <Modal open title={editando ? 'Modificar tarjeta' : 'Agregar tarjeta'} onClose={() => !saving && onClose()}
      footer={(
        <>
          <Button variant="outline-secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" form="fi-tarjeta-form" loading={saving}>{editando ? 'Guardar cambios' : 'Guardar tarjeta'}</Button>
        </>
      )}>
      <form id="fi-tarjeta-form" onSubmit={submit} noValidate>
        {formError && <Notice tone="danger" className="mb-3">{formError}</Notice>}
        <Notice tone="info" className="mb-3">Es una tarjeta simulada: no se valida con ningún banco ni se hacen cobros reales.</Notice>
        <Select label="Tipo de tarjeta" name="tipo" placeholder="Selecciona" options={TIPOS_TARJETA} value={values.tipo} onChange={onChange} error={errors.tipo} />
        <Input label="Número de la tarjeta" name="numero" inputMode="numeric" autoComplete="off" value={values.numero} onChange={onChange} error={errors.numero} />
        <Input label="Nombre del titular" name="titular" autoComplete="off" value={values.titular} onChange={onChange} error={errors.titular} />
        <div className="row">
          <div className="col-6"><Input label="Vencimiento" name="vencimiento" placeholder="MM/AA" autoComplete="off" value={values.vencimiento} onChange={onChange} error={errors.vencimiento} /></div>
          <div className="col-6">
            <Input label="Código de seguridad" name="codigo" inputMode="numeric" autoComplete="off" value={values.codigo} onChange={onChange}
              error={errors.codigo} hint={editando ? 'Vuelve a escribirlo para guardar los cambios.' : undefined} />
          </div>
        </div>
      </form>
    </Modal>
  )
}
