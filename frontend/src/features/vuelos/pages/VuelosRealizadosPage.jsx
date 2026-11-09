import { useEffect, useState } from 'react'
import { EmptyState, ErrorState } from '@/components/feedback'
import { PageHeader } from '@/components/layout'
import { BackLink } from '@/components/layout'
import VuelosTable from '../components/VuelosTable'
import VuelosTableSkeleton from '../components/VuelosTableSkeleton'
import { listarVuelosRealizados } from '../api'
import '../vuelos.css'

/** HU14 — Listar vuelos realizados o sucedidos (solo administrador). */
export default function VuelosRealizadosPage() {
  const [resultado, setResultado] = useState({ status: 'loading', vuelos: [], error: null })
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vivo = true
    setResultado((r) => ({ ...r, status: 'loading', error: null }))
    listarVuelosRealizados()
      .then(({ items }) => { if (vivo) setResultado({ status: 'ready', vuelos: items, error: null }) })
      .catch((error) => { if (vivo) setResultado({ status: 'error', vuelos: [], error }) })
    return () => { vivo = false }
  }, [intento])

  const volver = <BackLink to="/admin/vuelos">Volver al panel</BackLink>

  return (
    <div className="vu-page">
      {volver}

      <PageHeader
        eyebrow="Administración"
        title="Vuelos realizados"
        subtitle="Listado de vuelos ya ejecutados (estado realizado o sucedido)."
      />

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
                title="No hay vuelos realizados"
                message="Aún no hay vuelos con estado realizado o sucedido en el sistema."
              />
            )
        )}
      </div>
    </div>
  )
}
