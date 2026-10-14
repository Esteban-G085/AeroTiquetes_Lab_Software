import { ESTADO_LABEL, ESTADO_CLASE } from '../../domain/estados.js'

export default function EstadoBadge({ estado }) {
  const clase = ESTADO_CLASE[estado] ?? 'at-estado--programado'
  return <span className={`at-estado ${clase}`}>{ESTADO_LABEL[estado] ?? estado}</span>
}
