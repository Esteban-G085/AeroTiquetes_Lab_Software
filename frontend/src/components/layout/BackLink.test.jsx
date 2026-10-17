import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import BackLink from './BackLink'

describe('BackLink', () => {
  it('con `to` es un enlace real: se puede abrir o copiar la ruta', () => {
    render(<MemoryRouter><BackLink to="/admin/vuelos">Volver al panel</BackLink></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Volver al panel' })).toHaveAttribute('href', '/admin/vuelos')
  })

  it('con `onClick` es un botón que devuelve a la pantalla anterior', async () => {
    const onClick = vi.fn()
    render(<MemoryRouter><BackLink onClick={onClick}>Atrás</BackLink></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('no compite con la acción principal de la pantalla (variante secundaria)', () => {
    render(<MemoryRouter><BackLink to="/">Volver</BackLink></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Volver' })).toHaveClass('btn-outline-secondary')
  })
})
