export default function Spinner({ texto = 'Cargando…' }) {
  return (
    <div className="d-flex align-items-center gap-2 texto-suave py-4" role="status">
      <span className="spinner-border spinner-border-sm text-primary" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  )
}
