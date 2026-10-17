export default function Spinner({ label = 'Cargando' }) {
  return <span className="at-spinner" role="status" aria-label={label} />
}
