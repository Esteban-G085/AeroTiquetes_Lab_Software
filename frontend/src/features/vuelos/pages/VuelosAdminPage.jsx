import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorState } from '@/components/feedback'
import { Notice, Select } from '@/components/ui'
import { PageHeader } from '@/components/layout'
import { ESTADO_OPCIONES } from '@/domain/estados'
import { ciudadesDeColombia, ciudadesDelExterior } from '@/utils/ciudadesOpciones'
import { useCiudades } from '@/utils/useCiudades'
import VuelosTable from '../components/VuelosTable'
import VuelosTableSkeleton from '../components/VuelosTableSkeleton'
import { listarVuelos } from '../api'
import '../vuelos.css'

const FILTROS_VACIOS = { estado: '', origen: '', destino: '' }

const opcionesDe = (ciudades) => ciudades.map((c) => ({ value: c.codigo, label: `${c.nombre} (${c.codigo})` }))

/** HU19 — Panel de vuelos programados (solo administrador). */
export default function VuelosAdminPage() {
  const { ciudades, status: ciudadesStatus } = useCiudades()
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [resultado, setResultado] = useState({ status: 'loading', vuelos: [], error: null })
  const [intento, setIntento] = useState(0)

  const clave = JSON.stringify(filtros)

  useEffect(() => {
    let vivo = true
    setResultado((r) => ({ ...r, status: 'loading', error: null }))
    listarVuelos(JSON.parse(clave))
      .then(({ items }) => { if (vivo) setResultado({ status: 'ready', vuelos: items, error: null }) })
      .catch((error) => { if (vivo) setResultado({ status: 'error', vuelos: [], error }) })
    return () => { vivo = false }
  }, [clave, intento])

  const set = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }))

  return (
    <div className="vu-page">
      <PageHeader
        eyebrow="Administración"
        title="Vuelos programados"
        subtitle="Consulta, filtra y programa los vuelos del sistema."
        actions={<Link className="btn btn-primary" to="/admin/vuelos/nuevo">Programar vuelo</Link>}
      />

      {ciudadesStatus === 'fallback' && (
        <Notice tone="info" className="mb-3">
          No pudimos actualizar el catálogo de ciudades con el servidor; los filtros usan el catálogo local.
        </Notice>
      )}

      <div className="vu-filters at-card at-enter-2">
        <Select label="Estado" value={filtros.estado} onChange={set('estado')} placeholder="Todos"
          options={ESTADO_OPCIONES} />
        <Select label="Origen" value={filtros.origen} onChange={set('origen')} placeholder="Todos"
          options={opcionesDe(ciudadesDeColombia(ciudades))} />
        <Select label="Destino" value={filtros.destino} onChange={set('destino')} placeholder="Todos"
          options={opcionesDe([...ciudadesDeColombia(ciudades), ...ciudadesDelExterior(ciudades)])} />
        <button type="button" className="btn btn-outline-secondary vu-filters__clear" onClick={() => setFiltros(FILTROS_VACIOS)}>
          Limpiar filtros
        </button>
      </div>

      <div className="at-enter-3">
        {resultado.status === 'loading' && <VuelosTableSkeleton />}

        {resultado.status === 'error' && (
          <ErrorState message={resultado.error?.message} onRetry={() => setIntento((n) => n + 1)} />
        )}

        {resultado.status === 'ready' && (
          resultado.vuelos.length > 0
            ? <VuelosTable vuelos={resultado.vuelos} />
            : (
              <EmptyState
                title="No hay vuelos con esos filtros"
                message="Programa un vuelo nuevo o quita los filtros para verlos todos."
              />
            )
        )}
      </div>
    </div>
  )
}
