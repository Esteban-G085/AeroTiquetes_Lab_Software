import { Button, Input, Select } from '@/components/ui'
import { GENEROS, todayISO } from '../rules'

const FIELDS = [
  ['documento', 'Documento', { autoComplete: 'off', inputMode: 'text' }],
  ['fecha_nacimiento', 'Fecha de nacimiento', { type: 'date' }],
  ['nombres', 'Nombres', { autoComplete: 'off' }],
  ['apellidos', 'Apellidos', { autoComplete: 'off' }],
  ['telefono', 'Teléfono', { type: 'tel', autoComplete: 'off' }],
  ['correo', 'Correo electrónico', { type: 'email', autoComplete: 'off' }],
  ['contacto_nombre', 'Nombre del contacto', { autoComplete: 'off' }],
  ['contacto_telefono', 'Teléfono del contacto', { type: 'tel', autoComplete: 'off' }],
]

/**
 * Datos obligatorios de UN viajero (SRS 3.2.2 RF06). El `fieldset` con su leyenda agrupa los campos
 * para lectores de pantalla ("Viajero 2"), porque las etiquetas se repiten en cada viajero.
 *  value / errors : objetos { campo: valor } y { campo: mensaje }
 *  onChange(campo, valor)
 *  onUseMine      : si existe, muestra "Usar mis datos" (solo en el primer viajero)
 */
export default function ViajeroFields({ index, value, errors = {}, onChange, onUseMine, usingMine = false, onRemove }) {
  const set = (e) => onChange(e.target.name, e.target.value)
  return (
    <fieldset className="co-viajero">
      <legend className="co-viajero__legend">
        <span>Viajero {index + 1}</span>
        <span className="co-viajero__tools">
          {onUseMine && <Button variant="ghost" size="sm" onClick={onUseMine} loading={usingMine}>Usar mis datos</Button>}
          {onRemove && <Button variant="ghost" size="sm" onClick={onRemove} aria-label={`Quitar al viajero ${index + 1}`}>Quitar</Button>}
        </span>
      </legend>

      <div className="co-viajero__grid">
        {FIELDS.slice(0, 4).map(([name, label, props]) => (
          <Input key={name} label={label} name={name} value={value[name] ?? ''} onChange={set}
            error={errors[name]} {...(name === 'fecha_nacimiento' ? { max: todayISO() } : {})} {...props} />
        ))}
        <Select label="Género" name="genero" placeholder="Selecciona" options={GENEROS}
          value={value.genero ?? ''} onChange={set} error={errors.genero} />
        {FIELDS.slice(4, 6).map(([name, label, props]) => (
          <Input key={name} label={label} name={name} value={value[name] ?? ''} onChange={set} error={errors[name]} {...props} />
        ))}
      </div>

      <p className="co-viajero__sub">Persona de contacto</p>
      <div className="co-viajero__grid">
        {FIELDS.slice(6).map(([name, label, props]) => (
          <Input key={name} label={label} name={name} value={value[name] ?? ''} onChange={set} error={errors[name]} {...props} />
        ))}
      </div>
    </fieldset>
  )
}
