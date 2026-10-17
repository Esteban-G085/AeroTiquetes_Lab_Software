import { useState } from 'react'
import { Button, Card, Input, Notice, Select } from '@/components/ui'
import { CLASE_OPCIONES, ORDEN_BUSQUEDA } from '@/domain/estados'
import { gruposDeCiudades } from '@/utils/ciudadesOpciones'
import { todayISO } from '@/utils/format'
import { FILTROS_VACIOS } from '../api'

/**
 * Formulario de búsqueda combinada de vuelos (HU5: origen, destino, fecha, precio,
 * duración y clase, en cualquier combinación; sin filtro de aerolínea).
 * Quien lo usa es dueño del estado de los resultados: aquí solo se validan los criterios.
 */
export default function SearchForm({ ciudades = [], valoresIniciales = {}, onBuscar, cargando = false }) {
  const [filtros, setFiltros] = useState({ ...FILTROS_VACIOS, ...valoresIniciales })
  const [error, setError] = useState('')

  const grupos = gruposDeCiudades(ciudades)

  const set = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }))

  const numero = (valor) => (valor === '' ? null : Number(valor))

  function validar() {
    if (filtros.origen && filtros.origen === filtros.destino) {
      return 'El origen y el destino no pueden ser la misma ciudad.'
    }
    const min = numero(filtros.precioMin)
    const max = numero(filtros.precioMax)
    if (min !== null && max !== null && min > max) return 'El precio mínimo no puede ser mayor que el máximo.'
    const dMin = numero(filtros.duracionMin)
    const dMax = numero(filtros.duracionMax)
    if (dMin !== null && dMax !== null && dMin > dMax) return 'La duración mínima no puede ser mayor que la máxima.'
    return ''
  }

  function enviar(e) {
    e.preventDefault()
    const problema = validar()
    setError(problema)
    if (!problema) onBuscar(filtros)
  }

  function limpiar() {
    setFiltros({ ...FILTROS_VACIOS })
    setError('')
    onBuscar({ ...FILTROS_VACIOS })
  }

  return (
    <Card as="form" className="bu-search" onSubmit={enviar} noValidate>
      <div className="bu-search__grid">
        <Select label="Origen" value={filtros.origen} onChange={set('origen')} groups={grupos} placeholder="Cualquiera" />
        <Select label="Destino" value={filtros.destino} onChange={set('destino')} groups={grupos} placeholder="Cualquiera" />
        <Input label="Fecha de salida" type="date" min={todayISO()} value={filtros.fecha} onChange={set('fecha')} />
        <Select label="Clase" value={filtros.clase} onChange={set('clase')} options={CLASE_OPCIONES} placeholder="Cualquiera" />

        <Input label="Precio mínimo (COP)" type="number" min="0" step="10000" placeholder="0"
          value={filtros.precioMin} onChange={set('precioMin')} />
        <Input label="Precio máximo (COP)" type="number" min="0" step="10000" placeholder="Sin límite"
          value={filtros.precioMax} onChange={set('precioMax')} />
        <Input label="Duración mín. (min)" type="number" min="0" step="15" placeholder="0"
          value={filtros.duracionMin} onChange={set('duracionMin')} />
        <Input label="Duración máx. (min)" type="number" min="0" step="15" placeholder="Sin límite"
          value={filtros.duracionMax} onChange={set('duracionMax')} />
        <Select label="Ordenar por" value={filtros.orden} onChange={set('orden')} options={ORDEN_BUSQUEDA} />
      </div>

      {error && <Notice tone="warning" className="mt-3">{error}</Notice>}

      <div className="bu-search__actions">
        <Button type="submit" loading={cargando}>Buscar vuelos</Button>
        <Button variant="outline-secondary" onClick={limpiar} disabled={cargando}>Limpiar</Button>
      </div>
    </Card>
  )
}
