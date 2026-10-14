/** Muestra la ruta origen → destino con los códigos y nombres de ciudad. */
export default function RutaVuelo({ origen, destino, tamano = 'md' }) {
  const claseCodigo = tamano === 'lg' ? 'fs-3' : 'fs-5'
  return (
    <div className="at-ruta d-flex align-items-center gap-2 flex-wrap">
      <span className={`${claseCodigo} text-dark`} title={origen?.nombre}>
        {origen?.codigo}
      </span>
      <span className="texto-suave">→</span>
      <span className={`${claseCodigo} text-dark`} title={destino?.nombre}>
        {destino?.codigo}
      </span>
      <span className="small texto-suave ms-1">
        {origen?.nombre} · {destino?.nombre}
      </span>
    </div>
  )
}
