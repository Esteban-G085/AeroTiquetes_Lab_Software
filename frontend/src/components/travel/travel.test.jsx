import { render, screen } from '@testing-library/react'
import { FlightCard, Stepper, VueloDetalleSkeleton } from '@/components/travel'

const vuelo = {
  codigo: 'AT-204', aerolinea: 'AeroTiquetes',
  origen: { ciudad: 'Bogotá', codigo: 'BOG' }, destino: { ciudad: 'Madrid', codigo: 'MAD' },
  salida: '2026-11-10T22:10:00-05:00', llegada: '2026-11-11T14:25:00+01:00',
  salidaZona: 'America/Bogota', llegadaZona: 'Europe/Madrid', precio: 2450000, moneda: 'COP',
}

describe('FlightCard', () => {
  it('presenta ruta, horas locales de cada aeropuerto, duración y precio', () => {
    render(<FlightCard {...vuelo} />)
    const card = screen.getByRole('article', { name: 'Vuelo AT-204: Bogotá a Madrid' })
    expect(card).toHaveTextContent('22:10')
    expect(card).toHaveTextContent('14:25')
    expect(card).toHaveTextContent('BOG')
    expect(card).toHaveTextContent('MAD')
    expect(card).toHaveTextContent(/2\.450\.000/)
    expect(card).toHaveTextContent('hora local')
    expect(screen.getByText('Directo, duración 10 h 15 min.')).toBeInTheDocument()
  })

  it('avisa cuando se llega al día siguiente', () => {
    render(<FlightCard {...vuelo} />)
    expect(screen.getByTitle('Llegada al día siguiente')).toHaveTextContent('+1')
  })

  it('no muestra ese aviso si se llega el mismo día', () => {
    render(<FlightCard {...vuelo} salida="2026-11-10T08:00:00-05:00" llegada="2026-11-10T10:00:00-05:00" llegadaZona="America/Bogota" />)
    expect(screen.queryByTitle('Llegada al día siguiente')).not.toBeInTheDocument()
  })

  it('NO inventa etiquetas: sin `etiqueta` no se dibuja ninguna', () => {
    render(<FlightCard {...vuelo} />)
    expect(screen.queryByText(/mejor precio|recomendado|oferta/i)).not.toBeInTheDocument()
  })

  it('muestra la etiqueta solo cuando quien la usa la pasa', () => {
    render(<FlightCard {...vuelo} etiqueta="Más barato de esta búsqueda" />)
    expect(screen.getByText('Más barato de esta búsqueda')).toBeInTheDocument()
  })

  it('escalas en singular y plural', () => {
    const { rerender } = render(<FlightCard {...vuelo} escalas={1} />)
    expect(screen.getByText(/1 escala,/)).toBeInTheDocument()
    rerender(<FlightCard {...vuelo} escalas={2} />)
    expect(screen.getByText(/2 escalas,/)).toBeInTheDocument()
  })

  it('el botón de acción lo aporta quien la usa (la tarjeta no finge ser funcional)', () => {
    render(<FlightCard {...vuelo} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    render(<FlightCard {...vuelo} action={<button type="button">Seleccionar</button>} />)
    expect(screen.getByRole('button', { name: 'Seleccionar' })).toBeInTheDocument()
  })

  it('muestra condiciones y disponibilidad cuando se entregan', () => {
    render(<FlightCard {...vuelo} detalles="Equipaje de mano incluido" disponibilidad="Quedan 3 en Económica" />)
    expect(screen.getByText('Equipaje de mano incluido')).toBeInTheDocument()
    expect(screen.getByText('Quedan 3 en Económica')).toBeInTheDocument()
  })

  it('respeta la duración que envía el backend si existe', () => {
    render(<FlightCard {...vuelo} duracionMin={700} />)
    expect(screen.getByText('Directo, duración 11 h 40 min.')).toBeInTheDocument()
  })
})

describe('Stepper', () => {
  const steps = ['Vuelo', 'Pasajeros', 'Pago', 'Confirmación']

  it('marca el paso actual y los completados para lectores de pantalla', () => {
    render(<Stepper steps={steps} current={2} label="Pasos de la reserva" />)
    expect(screen.getByRole('navigation', { name: 'Pasos de la reserva' })).toBeInTheDocument()
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(items[2]).toHaveAttribute('aria-current', 'step')
    expect(items[0]).not.toHaveAttribute('aria-current')
    expect(items[0]).toHaveTextContent('(completado)')
    expect(items[1]).toHaveTextContent('(completado)')
    expect(items[3]).not.toHaveTextContent('(completado)')
  })

  it('en el primer paso no hay completados', () => {
    render(<Stepper steps={steps} current={0} />)
    expect(screen.queryByText(/completado/)).not.toBeInTheDocument()
  })
})

describe('VueloDetalleSkeleton', () => {
  it('anuncia la carga y reserva el hueco de la ficha en vez de un spinner suelto', () => {
    const { container } = render(<VueloDetalleSkeleton />)
    expect(screen.getByRole('status', { name: 'Cargando vuelo…' })).toBeInTheDocument()
    expect(container.querySelector('.at-detail')).toBeInTheDocument()
    expect(container.querySelectorAll('.at-skeleton').length).toBeGreaterThan(6)
  })

  it('nombra el estado según quien lo use', () => {
    render(<VueloDetalleSkeleton label="Cargando el vuelo programado…" />)
    expect(screen.getByRole('status', { name: 'Cargando el vuelo programado…' })).toBeInTheDocument()
  })
})
