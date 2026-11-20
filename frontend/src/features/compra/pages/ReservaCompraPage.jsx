import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Icon, Notice, Skeleton } from '@/components/ui'
import { EmptyState, ErrorState, useToast } from '@/components/feedback'
import { PageHeader } from '@/components/layout'
import { FlightCard, Stepper, toFlightProps } from '@/components/travel'
import { useCart } from '@/context'
import { useAsyncData } from '@/utils/useAsyncData'
import { formatPrice } from '@/utils/format'
import { crearReserva, obtenerMisDatos, obtenerVuelo } from '../api'
import { CLASES, MAX_TIQUETES_VUELO, VIAJERO_VACIO, cupoRestante, datosViajeroDesdePerfil, normalizarDocumento, precioParaClase, validarViajeros } from '../rules'
import { useRegreso } from '../hooks/useRegreso'
import ViajeroFields from '../components/ViajeroFields'
import RegresoSelector from '../components/RegresoSelector'
import ResumenViaje from '../components/ResumenViaje'
import { PASOS, ReservaCreada } from '../components/Confirmaciones'
import '../compra.css'

// Del backend, los errores por viajero llegan como `viajeros.<posición>.<campo>`.
const FIELD_RE = /^viajeros\.(\d+)\.(\w+)$/

function Formulario({ vuelo }) {
  const navigate = useNavigate()
  const toast = useToast()
  const cart = useCart()
  const formRef = useRef(null)
  const existing = cart.getItem(vuelo.id)

  const [trayecto, setTrayecto] = useState('ida')
  const [regreso, setRegreso] = useState(null)
  const [regresoError, setRegresoError] = useState('')
  const [clase, setClase] = useState(existing?.clase ?? 'economica')
  const [viajeros, setViajeros] = useState(existing?.viajeros ?? [{ ...VIAJERO_VACIO }])
  const [errors, setErrors] = useState([])
  const [general, setGeneral] = useState([])
  const [busy, setBusy] = useState(false)
  const [usingMine, setUsingMine] = useState(false)
  const [perfil, setPerfil] = useState(null)
  const [autocompletado, setAutocompletado] = useState('')
  const [resultado, setResultado] = useState(null)

  const reg = useRegreso(trayecto === 'ida_vuelta', vuelo.id)
  const tiquetesCliente = Math.max(vuelo.tiquetes_cliente ?? 0, regreso?.tiquetes_cliente ?? 0)
  const maximo = Math.max(cupoRestante(tiquetesCliente), 0)
  const sinCupos = vuelo.cupos_disponibles === 0

  // El perfil se consulta una sola vez. Permite completar CUALQUIER viajero cuyo documento
  // coincida con el de la cuenta, sin depender de que pulse "Usar mis datos".
  useEffect(() => {
    let vigente = true
    Promise.resolve(obtenerMisDatos())
      .then((p) => { if (vigente) setPerfil(p ?? null) })
      .catch(() => {}) // sin perfil no hay autocompletado: el formulario sigue siendo usable
    return () => { vigente = false }
  }, [])

  // La silla NO se elige: el backend asigna una libre al azar al confirmar la compra o reserva.

  const setCampo = (i, campo, valor) => {
    setViajeros((list) => list.map((v, idx) => (idx === i ? { ...v, [campo]: valor } : v)))
    setErrors((prev) => (prev[i]?.[campo] ? prev.map((e, idx) => (idx === i ? { ...e, [campo]: undefined } : e)) : prev))
    if (campo === 'documento') setAutocompletado('')
  }

  const agregarViajero = () => setViajeros((l) => (l.length < Math.min(maximo, MAX_TIQUETES_VUELO) ? [...l, { ...VIAJERO_VACIO }] : l))
  const quitarViajero = (i) => { setViajeros((l) => l.filter((_, idx) => idx !== i)); setErrors([]); setGeneral([]) }

  /** Al salir del documento: si coincide con el de la cuenta, completa los datos de ESE viajero. */
  function completarDesdeDocumento(i, documento) {
    if (!perfil?.dni) return
    const escrito = normalizarDocumento(documento)
    if (!escrito || escrito !== normalizarDocumento(perfil.dni)) return
    setViajeros((list) => list.map((v, idx) => (idx === i ? datosViajeroDesdePerfil(perfil, v) : v)))
    setErrors((prev) => prev.map((e, idx) => (idx === i ? {} : e)))
    setAutocompletado(`Datos del viajero ${i + 1} completados desde tu cuenta. Puedes editarlos.`)
  }

  async function usarMisDatos() {
    setUsingMine(true)
    try {
      const p = await obtenerMisDatos()
      const pick = (v) => (v === undefined || v === null ? undefined : v)
      setViajeros((list) => list.map((v, i) => (i === 0 ? {
        ...v,
        documento: pick(p.dni) ?? v.documento, nombres: pick(p.nombres) ?? v.nombres, apellidos: pick(p.apellidos) ?? v.apellidos,
        fecha_nacimiento: pick(p.fecha_nacimiento) ?? v.fecha_nacimiento, genero: pick(p.genero) ?? v.genero, correo: pick(p.correo) ?? v.correo,
      } : v)))
      setErrors([])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUsingMine(false)
    }
  }

  const items = () => {
    const completo = trayecto === 'ida_vuelta' && regreso
    return [
      {
        vuelo,
        clase,
        viajeros,
        tramo: 'ida',
        trayecto: completo ? 'ida_vuelta' : 'ida',
        ...(completo ? { vuelo_regreso_id: regreso.id } : {}),
      },
      ...(completo ? [{ vuelo: regreso, clase, viajeros, tramo: 'vuelta' }] : []),
    ]
  }

  function validar() {
    const res = validarViajeros(viajeros, { salidaIso: vuelo.salida, tiquetesCliente })
    setErrors(res.porViajero)
    setGeneral(res.general)
    let ok = res.ok
    if (trayecto === 'ida_vuelta' && !regreso) { setRegresoError('Elige el vuelo de regreso o cambia a "Solo ida".'); ok = false } else setRegresoError('')
    if (!ok) requestAnimationFrame(() => (formRef.current?.querySelector('[aria-invalid="true"]') ?? formRef.current?.querySelector('[role="alert"]'))?.focus?.())
    return ok
  }

  function onApiError(err) {
    const porViajero = []
    Object.entries(err.fields ?? {}).forEach(([key, msg]) => {
      const m = FIELD_RE.exec(key)
      if (m) porViajero[Number(m[1])] = { ...(porViajero[Number(m[1])] ?? {}), [m[2]]: msg }
    })
    if (porViajero.length) { setErrors(viajeros.map((_, i) => porViajero[i] ?? {})); setGeneral([]) }
    else setGeneral([err.message])
  }

  const agregarAlCarrito = () => {
    if (!validar()) return
    cart.upsertItems(items())
    toast.success(existing ? 'Actualizamos tu carrito.' : 'Agregamos el vuelo a tu carrito.')
    navigate('/carrito')
  }

  async function reservar() {
    if (!validar()) return
    setBusy(true)
    try {
      const lista = items()
      const r = await crearReserva(lista)
      lista.forEach((i) => cart.removeItem(i.vuelo.id)) // no puede haber compra y reserva activas del mismo vuelo
      setResultado({ reservas: r.reservas ?? [] })
    } catch (err) {
      onApiError(err)
    } finally {
      setBusy(false)
    }
  }

  if (resultado) return <ReservaCreada resultado={resultado} onSeguir={() => navigate('/')} />

  const tramos = items().map((i) => ({ tramo: i.tramo, vuelo: i.vuelo }))
  const bloqueado = sinCupos || maximo === 0

  return (
    <div className="co-page">
      <PageHeader eyebrow="Reserva o compra" title={`${vuelo.origen.ciudad} a ${vuelo.destino.ciudad}`}
        subtitle="Elige tu trayecto y la clase, y registra a cada viajero. La silla se asigna al azar al confirmar." />
      <div className="mb-4"><Stepper steps={PASOS} current={0} label="Progreso de la compra" /></div>

      <div className="co-layout">
        <form ref={formRef} className="co-form" noValidate onSubmit={(e) => {
          e.preventDefault()
          agregarAlCarrito()
        }}>
          <FlightCard {...toFlightProps(vuelo)} />

          {existing && <Notice tone="info">Este vuelo ya está en tu carrito. Al guardar, se actualizará con lo que completes aquí.</Notice>}
          {sinCupos && <Notice tone="warning">Este vuelo no tiene cupos disponibles por ahora.</Notice>}
          {!sinCupos && maximo === 0 && <Notice tone="warning">Ya tienes {MAX_TIQUETES_VUELO} tiquetes en este vuelo, que es el máximo por cliente.</Notice>}
          {autocompletado && <Notice tone="info">{autocompletado}</Notice>}
          {general.length > 0 && (
            <Notice tone="danger" tabIndex={-1}>
              {general.length === 1 ? general[0] : <ul className="mb-0 ps-3">{general.map((g) => <li key={g}>{g}</li>)}</ul>}
            </Notice>
          )}

          <>
          <section className="at-card co-section" aria-labelledby="co-trayecto">
            <h2 id="co-trayecto" className="co-section__title">Trayecto</h2>
            <div className="co-seg" role="radiogroup" aria-labelledby="co-trayecto">
              {[['ida', 'Solo ida'], ['ida_vuelta', 'Ida y vuelta']].map(([value, label]) => (
                <label key={value} className={`co-seg__opt${trayecto === value ? ' is-checked' : ''}`}>
                  <input type="radio" name="trayecto" value={value} checked={trayecto === value} disabled={bloqueado}
                    onChange={() => { setTrayecto(value); setRegresoError('') }} />
                  {label}
                </label>
              ))}
            </div>
            {trayecto === 'ida_vuelta' && (
              <div className="mt-3">
                <p className="co-section__hint">Los dos tramos comparten código de reserva y se pagan en una sola operación; la silla de cada tiquete se asigna al azar.</p>
                <RegresoSelector status={reg.status === 'idle' ? 'loading' : reg.status} vuelos={reg.vuelos} error={reg.error}
                  clase={clase} value={regreso?.id} onChange={(v) => { setRegreso(v); setRegresoError('') }} />
                {regresoError && <div role="alert" tabIndex={-1} className="at-field__error mt-2">{regresoError}</div>}
              </div>
            )}
          </section>

          <section className="at-card co-section" aria-labelledby="co-clase">
            <h2 id="co-clase" className="co-section__title">Clase</h2>
            <div className="co-classes" role="radiogroup" aria-labelledby="co-clase">
              {CLASES.map((c) => (
                <label key={c.value} className={`co-class${clase === c.value ? ' is-checked' : ''}`}>
                  <input type="radio" name="clase" value={c.value} checked={clase === c.value} disabled={bloqueado} onChange={() => setClase(c.value)} />
                  <span className="co-class__name">{c.label}</span>
                  <span className="co-class__hint">{c.value === 'primera' ? 'Cabina delantera' : 'Cabina principal'}</span>
                  <span className="co-class__price">{formatPrice(precioParaClase(vuelo, c.value), vuelo.moneda)} por persona</span>
                </label>
              ))}
            </div>
            <p className="co-section__hint">Tarifa por persona y trayecto; se aplica a cada viajero y a cada tramo.</p>
          </section>

          <section className="at-card co-section" aria-labelledby="co-viajeros">
            <div className="co-section__row">
              <h2 id="co-viajeros" className="co-section__title">Viajeros</h2>
              <span className="co-section__count">{viajeros.length} de {Math.min(maximo, MAX_TIQUETES_VUELO)}</span>
            </div>
            {viajeros.map((v, i) => (
              <ViajeroFields key={i} index={i} value={v} errors={errors[i] ?? {}}
                onChange={(campo, valor) => setCampo(i, campo, valor)}
                onDocumentoBlur={(documento) => completarDesdeDocumento(i, documento)}
                onUseMine={i === 0 ? usarMisDatos : undefined} usingMine={usingMine}
                onRemove={i > 0 ? () => quitarViajero(i) : undefined} />
            ))}
            <Button variant="outline-primary" onClick={agregarViajero} disabled={bloqueado || viajeros.length >= maximo}>
              <Icon name="plus" size={16} /> Agregar otro viajero
            </Button>
          </section>
          </>
        </form>

        <aside className="co-aside">
          <ResumenViaje tramos={tramos} viajeros={viajeros.length} clase={clase}>
            <div className="co-actions">
              <Button size="lg" onClick={agregarAlCarrito} disabled={bloqueado || busy}>{existing ? 'Actualizar carrito' : 'Agregar al carrito'}</Button>
              <Button variant="outline-primary" onClick={reservar} loading={busy} disabled={bloqueado}>Reservar sin pagar</Button>
              <p className="co-actions__hint">
                La silla se asigna al azar al confirmar. La reserva dura 24 horas y guarda tu cupo sin pagar; al comprar pagas con tu billetera y recibes el código de reserva.
              </p>
            </div>
          </ResumenViaje>
        </aside>
      </div>
    </div>
  )
}

/** HU6 / HU7 — Reservar o comprar un tiquete: trayecto, clase y datos de cada viajero. */
export default function ReservaCompraPage() {
  const { vueloId } = useParams()
  return <Cargador key={vueloId} vueloId={vueloId} />
}

function Cargador({ vueloId }) {
  const { status, data: vuelo, error, reload } = useAsyncData(() => obtenerVuelo(vueloId))

  if (status === 'loading') {
    return (
      <div role="status" aria-label="Cargando el vuelo" className="d-grid gap-3">
        <Skeleton width="55%" height="2.4rem" /><Skeleton height="9rem" /><Skeleton height="14rem" />
      </div>
    )
  }
  if (status === 'error') {
    return error?.status === 404
      ? <EmptyState title="Este vuelo ya no está disponible" message="Puede que haya sido cancelado o que ya haya salido."
        action={<Link to="/" className="btn btn-primary">Buscar otros vuelos</Link>} />
      : <ErrorState message={error?.message} onRetry={reload} />
  }
  return <Formulario vuelo={vuelo} />
}
