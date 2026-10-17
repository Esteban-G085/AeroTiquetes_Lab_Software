import { forwardRef, useId, useState } from 'react'
import { cn } from '@/utils/cn'
import Icon from './Icon'

/** Envoltorio común: etiqueta + control + ayuda + error, con ids de accesibilidad. */
function FieldShell({ id, label, hint, error, required, children }) {
  return (
    <div className="at-field">
      {label && (
        <label htmlFor={id} className="form-label">
          {label}{required && <span aria-hidden="true"> *</span>}
        </label>
      )}
      {children}
      {hint && !error && <div id={`${id}-hint`} className="at-field__hint">{hint}</div>}
      {error && <div id={`${id}-err`} role="alert" className="at-field__error">{error}</div>}
    </div>
  )
}

const describedBy = (id, hint, error) =>
  error ? `${id}-err` : hint ? `${id}-hint` : undefined

/**
 * Input de texto. `error` es el mensaje (string) del campo; coincide con
 * el formato del backend: { error: { fields: { campo: "mensaje" } } }.
 * Los campos de contraseña traen un botón para mostrarla u ocultarla (menos errores de tecleo).
 */
export const Input = forwardRef(function Input(
  { label, hint, error, required, className, type = 'text', ...rest }, ref,
) {
  const id = useId()
  const [shown, setShown] = useState(false)
  const isPassword = type === 'password'

  const control = (
    <input
      ref={ref} id={id} type={isPassword && shown ? 'text' : type} required={required}
      className={cn('form-control', error && 'is-invalid', isPassword && 'at-input__control--toggle', className)}
      aria-invalid={!!error || undefined}
      aria-describedby={describedBy(id, hint, error)}
      {...rest}
    />
  )

  return (
    <FieldShell {...{ id, label, hint, error, required }}>
      {isPassword ? (
        <div className="at-input">
          {control}
          <button
            type="button" className="at-input__toggle" aria-pressed={shown}
            aria-label={shown ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onClick={() => setShown((s) => !s)}
          >
            <Icon name={shown ? 'eye-off' : 'eye'} size={20} />
          </button>
        </div>
      ) : control}
    </FieldShell>
  )
})

/**
 * Select. `options: [{ value, label }]`. Para agrupar, `groups: [{ label, options }]`
 * (los grupos se pintan como `<optgroup>`; el respaldo de ciudades los usa).
 */
export const Select = forwardRef(function Select(
  { label, hint, error, required, options = [], groups, placeholder, className, ...rest }, ref,
) {
  const id = useId()
  return (
    <FieldShell {...{ id, label, hint, error, required }}>
      <select
        ref={ref} id={id} required={required}
        className={cn('form-select', error && 'is-invalid', className)}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {groups
          ? groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </optgroup>
          ))
          : options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </FieldShell>
  )
})
