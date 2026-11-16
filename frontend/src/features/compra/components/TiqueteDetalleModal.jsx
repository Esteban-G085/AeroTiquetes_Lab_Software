import { Button, Modal } from '@/components/ui'
import { formatDateOnly, formatDateTime, formatPrice } from '@/utils/format'
import { claseLabel } from '../rules'

const Fila = ({ label, children }) => <div><dt>{label}</dt><dd>{children}</dd></div>

/** Detalle de un tiquete desde el historial: vuelo, clase, viajero y valor (la silla solo si el backend la envía). */
export default function TiqueteDetalleModal({ item, tiquete, onClose }) {
  if (!item || !tiquete) return null
  const { vuelo } = item
  const v = tiquete.viajero
  return (
    <Modal open title="Detalle del tiquete" onClose={onClose} footer={<Button variant="outline-secondary" onClick={onClose}>Cerrar</Button>}>
      <dl className="co-detail">
        <Fila label="Código de reserva"><span className="at-mono">{tiquete.codigo_reserva}</span></Fila>
        <Fila label="Vuelo">{vuelo.codigo} · {vuelo.origen.ciudad} a {vuelo.destino.ciudad}</Fila>
        <Fila label="Salida">{formatDateTime(vuelo.salida, vuelo.salida_zona)} (hora local)</Fila>
        <Fila label="Llegada">{formatDateTime(vuelo.llegada, vuelo.llegada_zona)} (hora local)</Fila>
        <Fila label="Clase">{claseLabel(item.clase)}</Fila>
        {tiquete.silla ? <Fila label="Silla">{tiquete.silla}</Fila> : null}
        <Fila label="Viajero">{v.nombres} {v.apellidos}</Fila>
        <Fila label="Documento">{v.documento}</Fila>
        {v.fecha_nacimiento && <Fila label="Nacimiento">{formatDateOnly(v.fecha_nacimiento)}</Fila>}
        <Fila label="Valor">{formatPrice(vuelo.precio, vuelo.moneda)}</Fila>
      </dl>
    </Modal>
  )
}
