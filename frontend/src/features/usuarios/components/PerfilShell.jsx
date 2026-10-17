import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui'
import { BackLink } from '@/components/layout'
import { SkyArt, Wordmark } from '@/components/brand'
import { resolveMediaUrl } from '@/utils/media'

const initials = (name) => String(name ?? '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'

/** Avatar circular: foto, o iniciales si no hay. `onPick` lo vuelve clicable (modo edición) para cambiar la foto. */
export function PerfilAvatar({ src, name, onPick }) {
  const inner = src
    ? <img src={resolveMediaUrl(src)} alt="Foto de perfil" />
    : <span className="us-perfil__initials" aria-hidden="true">{initials(name)}</span>
  return onPick
    ? (
      <button type="button" className="us-perfil__avatar us-perfil__avatar--edit" onClick={onPick}>
        {inner}
        {/* El nombre accesible sale del contenido (no de aria-label) para que coincida con lo que se ve y funcione con voz */}
        <span className="visually-hidden">Cambiar foto de perfil</span>
        <span className="us-perfil__camera" aria-hidden="true"><Icon name="camera" size={16} /></span>
      </button>
    )
    : <div className="us-perfil__avatar" role="img" aria-label="Foto de perfil">{inner}</div>
}

/**
 * Marco común de HU2 y HU3: portada de marca, avatar que la cruza, identidad (nombre + documento/Id),
 * acciones a la derecha y botón Atrás.
 */
export default function PerfilShell({ name, idLine, avatar, actions, onBack, children }) {
  return (
    <div className="us-perfil">
      <div className="us-perfil__hero at-sky">
        <SkyArt variant="wide" />
        <div className="container">
          <Link to="/" className="us-perfil__home" aria-label="AeroTiquetes, ir al inicio"><Wordmark tone="light" size={34} /></Link>
        </div>
      </div>

      <main className="container us-perfil__main">
        <div className="us-perfil__head at-enter">
          <div className="us-perfil__avatarbox">{avatar}</div>
          <div className="us-perfil__identity">
            <h1 className="us-perfil__name">{name}</h1>
            {idLine && <p className="us-perfil__doc"><Icon name="id" size={16} />{idLine}</p>}
          </div>
          {actions && <div className="us-perfil__actions">{actions}</div>}
        </div>

        <div className="us-perfil__body">{children}</div>

        <div className="us-perfil__back">
          <BackLink onClick={onBack}>Atrás</BackLink>
        </div>
      </main>
    </div>
  )
}
