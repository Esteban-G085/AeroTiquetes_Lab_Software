import { useMemo } from 'react'
import { Button, Notice, Skeleton } from '@/components/ui'
import { ErrorState, useToast } from '@/components/feedback'
import { PageHeader } from '@/components/layout'
import { ApiError } from '@/services/apiError'
import { useAsyncData } from '@/utils/useAsyncData'
import RolesMatrix from '../components/RolesMatrix'
import { obtenerRoles } from '../api'
import '../usuarios.css'

/** HU24 — Gestionar roles (solo root): 4 roles fijos, solo lectura. Las funciones de cada rol ya están definidas. */
export default function RolesPage() {
  const toast = useToast()
  const { status, data, error, reload } = useAsyncData(obtenerRoles)

  const roles = useMemo(() => data?.roles ?? [], [data])

  return (
    <div className="us-roles">
      <PageHeader
        eyebrow="Panel del root"
        title="Gestionar roles"
        subtitle="Los cuatro roles son fijos. Cada rol tiene definido su acceso a los módulos del sistema; no se pueden modificar desde aquí."
      />

      <section className="at-card us-roles__card at-enter-2" aria-labelledby="roles-sistema">
        <h2 id="roles-sistema" className="us-roles__kicker">Roles del sistema</h2>

        {status === 'loading' && (
          <div role="status" aria-label="Cargando roles" className="us-roles__skeleton">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} height="3.2rem" />)}
          </div>
        )}
        {status === 'error' && <ErrorState message={error?.message} onRetry={reload} />}

        {status === 'ready' && (
          <>
            <RolesMatrix modulos={data.modulos} roles={roles} />

            <p className="us-roles__hint">
              Los permisos de cada rol están definidos en el catálogo de módulos del sistema y no
              se pueden cambiar desde esta pantalla.
            </p>
          </>
        )}
      </section>
    </div>
  )
}
