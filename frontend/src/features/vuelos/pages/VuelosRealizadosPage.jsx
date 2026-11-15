import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Input, Skeleton } from '@/components/ui'
import { EmptyState, ErrorState } from '@/components/feedback'
import { PageHeader } from '@/components/layout'
import { useAsyncData } from '@/utils/useAsyncData'
import { listarVuelosRealizados } from '../api'
import VuelosTabla from '../components/VuelosTabla'
import '../vuelos.css'

const FILTROS = [['todos', 'Todos'], ['sucedido', 'Sucedidos'], ['realizado', 'Realizados']]
const TIPOS = [['todos', 'Todos los tipos'], ['nacional', 'Nacionales'], ['internacional', 'Internacionales']]

/** HU14 — Histórico de vuelos que ya sucedieron o se realizaron. El paso de «sucedido» a «realizado» es automático (lo hace el backend). */
export default function VuelosRealizadosPage() {
  const { status, data, error, reload } = useAsyncData(listarVuelosRealizados)
  const [filtro, setFiltro] = useState('todos')
  const [tipo, setTipo] = useState('todos')
  const [q, setQ] = useState('')
  const buscado = q.trim().toLowerCase()
  const visibles = status === 'ready'
    ? data.filter((v) => (filtro === 'todos' || v.estado === filtro) && (tipo === 'todos' || v.tipo === tipo) && (!buscado || v.codigo.toLowerCase().includes(buscado)))
    : []
  const total = status === 'ready' ? data.length : 0
  const nacionales = status === 'ready' ? data.filter((v) => v.tipo === 'nacional').length : 0

  return (
    <div className="vu-page">
      <PageHeader eyebrow="Administración" title="Vuelos realizados"
        subtitle="Histórico de operación. «Sucedido» es un vuelo cuya hora de salida ya pasó; «realizado», uno que se completó."
        actions={<Link to="/admin/vuelos" className="btn btn-outline-primary">Vuelos programados</Link>} />

      {status === 'ready' && (
        <dl className="vu-stats" aria-label="Resumen">
          <div><dt>Total</dt><dd>{total}</dd></div>
          <div><dt>Nacionales</dt><dd>{nacionales}</dd></div>
          <div><dt>Internacionales</dt><dd>{total - nacionales}</dd></div>
        </dl>
      )}

      <div className="vu-toolbar">
        <Input label="Buscar por código de vuelo" name="q" placeholder="Ej: AT-204" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
        <div>
          <div className="at-filters mb-2" role="group" aria-label="Filtrar por estado">
            {FILTROS.map(([id, label]) => (
              <button key={id} type="button" className={`at-filters__btn${filtro === id ? ' is-active' : ''}`} aria-pressed={filtro === id} onClick={() => setFiltro(id)}>{label}</button>
            ))}
          </div>
          <div className="at-filters" role="group" aria-label="Filtrar por tipo">
            {TIPOS.map(([id, label]) => (
              <button key={id} type="button" className={`at-filters__btn${tipo === id ? ' is-active' : ''}`} aria-pressed={tipo === id} onClick={() => setTipo(id)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {status === 'loading' && <div role="status" aria-label="Cargando vuelos realizados" className="d-grid gap-2"><Skeleton height="3rem" /><Skeleton height="3rem" /></div>}
      {status === 'error' && <ErrorState message={error?.message} onRetry={reload} />}
      {status === 'ready' && visibles.length === 0 && (
        <EmptyState icon="plane" title={data.length === 0 ? 'Aún no hay vuelos realizados' : 'No hay vuelos con estos filtros'}
          message={data.length === 0 ? 'Cuando un vuelo salga y se complete, aparecerá aquí.' : 'Prueba con otro estado, tipo o código.'} />
      )}
      {status === 'ready' && visibles.length > 0 && <VuelosTabla vuelos={visibles} caption="Vuelos realizados" />}
    </div>
  )
}
