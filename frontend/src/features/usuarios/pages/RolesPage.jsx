import { useMemo, useState } from 'react'
import { Button, Notice, Skeleton } from '@/components/ui'
import { ErrorState, useToast } from '@/components/feedback'
import { PageHeader } from '@/components/layout'
import { ApiError } from '@/services/apiError'
import { useAsyncData } from '@/utils/useAsyncData'
import RolesMatrix from '../components/RolesMatrix'
import { guardarRoles, obtenerRoles } from '../api'
import { diffRoles } from '../utils'
import '../usuarios.css'

/** HU24 — Gestionar roles (solo root): 4 roles fijos; el root activa o desactiva permisos por módulo (P2). */
export default function RolesPage() {
  const toast = useToast()
  const { status, data, error, reload, refresh } = useAsyncData(obtenerRoles)
  const [draft, setDraft] = useState({}) // { rolId: { moduloId: boolean } } solo con lo tocado
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const roles = useMemo(() => data?.roles ?? [], [data])
  const changes = useMemo(() => diffRoles(roles, draft), [roles, draft])

  const isChecked = (role, moduloId) => Boolean((draft[role.id] ?? role.modulos)[moduloId])

  const onToggle = (roleId, moduloId, value) => {
    const base = roles.find((r) => r.id === roleId)
    setDraft((d) => ({ ...d, [roleId]: { ...(d[roleId] ?? base.modulos), [moduloId]: value } }))
  }

  async function save() {
    setSaving(true); setSaveError('')
    try {
      await guardarRoles(changes)
      await refresh() // el backend es la fuente de verdad
      setDraft({})
      toast.success('Permisos actualizados. Se aplican de inmediato.')
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'No se pudieron guardar los cambios.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="us-roles">
      <PageHeader
        eyebrow="Panel del root"
        title="Gestionar roles"
        subtitle="Administrar roles y delimitar accesos. Los cuatro roles son fijos: activa o desactiva el acceso de cada uno a los módulos. El cambio se aplica de inmediato a todas las personas con ese rol."
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
            <RolesMatrix modulos={data.modulos} roles={roles} isChecked={isChecked} onToggle={onToggle} />

            {saveError && <Notice tone="danger" className="mt-3">{saveError}</Notice>}
            <div className="us-roles__actions">
              <span className="us-roles__count" role="status">
                {changes.length ? `${changes.length} rol${changes.length > 1 ? 'es' : ''} con cambios sin guardar` : ''}
              </span>
              <Button variant="ghost" onClick={() => { setDraft({}); setSaveError('') }} disabled={!changes.length || saving}>
                Descartar
              </Button>
              <Button onClick={save} loading={saving} disabled={!changes.length}>Guardar cambios</Button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
