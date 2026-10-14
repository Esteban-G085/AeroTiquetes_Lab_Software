export default function EmptyState({ titulo = 'Sin resultados', mensaje, icono = '🔎', children }) {
  return (
    <div className="text-center py-5">
      <div style={{ fontSize: '2.5rem' }} aria-hidden="true">{icono}</div>
      <h2 className="h5 mt-2 mb-1">{titulo}</h2>
      {mensaje && <p className="texto-suave mb-3">{mensaje}</p>}
      {children}
    </div>
  )
}
