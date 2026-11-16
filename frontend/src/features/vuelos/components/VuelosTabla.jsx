import { Badge } from '@/components/ui'
import { formatDateTime, formatDuration, formatPrice } from '@/utils/format'
import { estadoVuelo } from '../rules'

/**
 * Tabla de vuelos para el administrador. Solo presenta: las acciones de cada fila las pone la página (`acciones(vuelo)`).
 * En pantallas angostas se desplaza dentro de su propio contenedor (la página nunca se desborda).
 */
export default function VuelosTabla({ vuelos, acciones, caption }) {
  return (
    <div className="vu-tablewrap">
      <table className="table vu-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Vuelo</th><th scope="col">Ruta</th><th scope="col">Salida (hora local)</th>
            <th scope="col">Duración</th><th scope="col">Valor</th><th scope="col">Tiquetes</th><th scope="col">Estado</th>
            {acciones && <th scope="col"><span className="visually-hidden">Acciones</span></th>}
          </tr>
        </thead>
        <tbody>
          {vuelos.map((v) => {
            const e = estadoVuelo(v.estado)
            return (
              <tr key={v.id}>
                <td><span className="at-mono">{v.codigo}</span></td>
                <td>{v.origen.ciudad} a {v.destino.ciudad}<span className="vu-table__sub">{v.tipo === 'internacional' ? 'Internacional' : 'Nacional'}</span></td>
                <td>{formatDateTime(v.salida, v.salida_zona)}</td>
                <td>{formatDuration(v.duracion_min)}</td>
                <td>{formatPrice(v.precio, v.moneda)}</td>
                <td>{v.tiquetes_vendidos ?? '—'}</td>
                <td><Badge tone={e.tone}>{e.label}</Badge></td>
                {acciones && <td className="vu-table__actions">{acciones(v)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
