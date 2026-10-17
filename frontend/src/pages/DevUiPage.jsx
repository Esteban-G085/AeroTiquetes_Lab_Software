import { useState } from 'react'
import { Badge, Button, Card, ConfirmDialog, Icon, Input, Modal, Notice, Select, Skeleton, Switch } from '@/components/ui'
import { EmptyState, ErrorState, LoadingState, useToast } from '@/components/feedback'
import { PageHeader } from '@/components/layout'
import { FlightCard, Stepper } from '@/components/travel'

const SWATCHES = [
  ['blue-50', '#eef3fe'], ['blue-100', '#dce7fd'], ['blue-300', '#8eb3f6'], ['blue-500 ◆', '#3b62c8'], ['blue-600 ◆', '#244dbe'],
  ['blue-700', '#1d3f9a'], ['blue-800 ◆', '#1a336c'], ['blue-900 ◆', '#0b1936'], ['sun', '#ffb020'], ['success ◆', '#78d84f'], ['danger', '#b42318'],
]

// DATOS DE EJEMPLO: solo para este catálogo (únicamente en desarrollo). Nunca se usan en pantallas reales.
const EJEMPLO = {
  codigo: 'AT-204', aerolinea: 'AeroTiquetes',
  origen: { ciudad: 'Bogotá', codigo: 'BOG' }, destino: { ciudad: 'Madrid', codigo: 'MAD' },
  salida: '2026-11-10T22:10:00-05:00', llegada: '2026-11-11T14:25:00+01:00',
  salidaZona: 'America/Bogota', llegadaZona: 'Europe/Madrid', precio: 2450000, moneda: 'COP',
}

function Section({ title, children, note }) {
  return (
    <Card className="at-enter">
      <h2 className="h5 mb-1">{title}</h2>
      {note && <p className="text-secondary small mb-3">{note}</p>}
      {children}
    </Card>
  )
}

/** Catálogo visual del sistema de diseño. Solo existe en desarrollo (/dev/ui). */
export default function DevUiPage() {
  const toast = useToast()
  const [modal, setModal] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [on, setOn] = useState(true)

  return (
    <div className="d-grid gap-4">
      <PageHeader eyebrow="Solo desarrollo" title="Sistema de diseño" subtitle="Todo lo que sale de src/styles/tokens.css y src/components. Los rombos ◆ marcan los colores originales del proyecto." />

      <Section title="Color">
        <div className="d-flex flex-wrap gap-3">
          {SWATCHES.map(([name, hex]) => (
            <div key={name} className="text-center" style={{ width: '5.5rem' }}>
              <div style={{ background: hex, height: '3.25rem', borderRadius: 12, border: '1px solid var(--at-line)' }} />
              <div className="small fw-semibold mt-1">{name}</div>
              <code>{hex}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografía" note="Titulares: Fraunces. Texto: Plus Jakarta Sans. Códigos y cifras de referencia: Roboto Mono.">
        <h1 className="mb-1">Titular de pantalla (h1)</h1>
        <h2 className="mb-1">Titular de sección (h2)</h2>
        <h3>Titular de tarjeta (h3)</h3>
        <p className="mb-1">Texto de lectura: claro, con interlineado cómodo y buen contraste sobre cualquier superficie.</p>
        <p className="text-secondary small mb-0">Texto secundario · código de vuelo <code>AT-204</code></p>
      </Section>

      <Section title="Botones">
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <Button>Primario</Button>
          <Button variant="outline-primary">Secundario</Button>
          <Button variant="ghost">Terciario</Button>
          <Button variant="outline-secondary">Neutro</Button>
          <Button variant="danger">Peligro</Button>
          <Button size="lg">Grande</Button>
          <Button size="sm">Pequeño</Button>
          <Button loading>Guardando</Button>
          <Button disabled>Deshabilitado</Button>
        </div>
      </Section>

      <Section title="Formulario y avisos">
        <div className="row">
          <div className="col-md-4"><Input label="Usuario" hint="Entre 4 y 20 caracteres" /></div>
          <div className="col-md-4"><Input label="Correo" type="email" error="Ese correo ya está registrado" /></div>
          <div className="col-md-4"><Select label="Género" placeholder="Selecciona" options={[{ value: 'f', label: 'Femenino' }, { value: 'm', label: 'Masculino' }]} /></div>
          <div className="col-md-4"><Input label="Contraseña" type="password" defaultValue="clave-de-ejemplo" /></div>
        </div>
        <div className="d-grid gap-2 mt-2">
          <Notice tone="danger">Revisa los campos marcados.</Notice>
          <Notice tone="warning">Tu enlace vence en 48 horas.</Notice>
          <Notice tone="info">Te enviamos un enlace de verificación.</Notice>
          <Notice tone="success">Cambios guardados.</Notice>
        </div>
      </Section>

      <Section title="Insignias, interruptor y esqueletos">
        <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
          <Badge tone="success">Activo</Badge><Badge tone="warning">Pendiente</Badge><Badge tone="danger">Cancelado</Badge><Badge>Programado</Badge>
          <Switch label="Ejemplo" checked={on} onChange={setOn} />
        </div>
        <div className="d-flex align-items-center gap-3"><Skeleton circle width="2.8rem" /><div className="d-grid gap-2"><Skeleton width="9rem" height=".9rem" /><Skeleton width="13rem" height=".75rem" /></div></div>
      </Section>

      <Section title="Piezas de viaje" note="Datos de ejemplo: solo para este catálogo. Las pantallas reales las alimentan con la API (ver docs/DISENO.md).">
        <div className="mb-4"><Stepper steps={['Vuelo', 'Pasajeros', 'Pago', 'Confirmación']} current={1} label="Pasos de ejemplo" /></div>
        <div className="d-grid gap-4 pt-2">
          <FlightCard {...EJEMPLO} etiqueta="Más barato de esta búsqueda" detalles="Equipaje de mano incluido · Cambios con cargo" disponibilidad="Quedan 3 en Económica"
            action={<Button onClick={() => toast.info('Botón de ejemplo del catálogo')}>Seleccionar</Button>} />
          <FlightCard {...EJEMPLO} codigo="AT-310" salida="2026-11-10T08:00:00-05:00" llegada="2026-11-10T09:25:00-05:00" llegadaZona="America/Bogota"
            destino={{ ciudad: 'Medellín', codigo: 'MDE' }} precio={289000} />
        </div>
      </Section>

      <Section title="Avisos, diálogos y estados">
        <div className="d-flex flex-wrap gap-2 mb-3">
          <Button variant="outline-primary" onClick={() => toast.success('Cambios guardados')}>Aviso éxito</Button>
          <Button variant="outline-primary" onClick={() => toast.error('No se pudo guardar')}>Aviso error</Button>
          <Button variant="outline-primary" onClick={() => setModal(true)}>Diálogo</Button>
          <Button variant="outline-primary" onClick={() => setConfirm(true)}>Confirmación</Button>
        </div>
        <div className="row g-3">
          <div className="col-md-4"><Card><LoadingState /></Card></div>
          <div className="col-md-4"><Card><ErrorState message="Revisa tu conexión e inténtalo de nuevo." onRetry={() => toast.info('Reintentando…')} /></Card></div>
          <div className="col-md-4"><Card><EmptyState title="No existen vuelos" message="Prueba con otras fechas o ciudades." icon="search" /></Card></div>
        </div>
      </Section>

      <Modal open={modal} title="Título del diálogo" onClose={() => setModal(false)} footer={<Button onClick={() => setModal(false)}>Entendido</Button>}>
        <p className="mb-0">Contenido del diálogo. <Icon name="shield" size={16} /> Se cierra con Escape.</p>
      </Modal>
      <ConfirmDialog open={confirm} danger title="Eliminar administrador" message="Esta acción no se puede deshacer." confirmLabel="Eliminar"
        onConfirm={() => { setConfirm(false); toast.success('Administrador eliminado') }} onCancel={() => setConfirm(false)} />
    </div>
  )
}
