import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '@/components/feedback'

function Boom() { throw new Error('fallo de prueba') }

describe('ErrorBoundary', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {})) // React y el boundary registran el error
  afterEach(() => vi.restoreAllMocks())

  it('muestra un mensaje con salidas en vez de una pantalla en blanco', () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByRole('alert')).toHaveTextContent('Algo salió mal')
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/')
  })

  it('no interfiere si todo va bien', () => {
    render(<ErrorBoundary><p>contenido</p></ErrorBoundary>)
    expect(screen.getByText('contenido')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
