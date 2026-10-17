import { Badge } from '@/components/ui'
import { ESTADO_LABEL, ESTADO_TONE } from '@/domain/estados'

/** Insignia del estado de un vuelo (programado / sucedido / realizado / cancelado). */
export default function EstadoBadge({ estado }) {
  return <Badge tone={ESTADO_TONE[estado] ?? 'neutral'}>{ESTADO_LABEL[estado] ?? estado}</Badge>
}
