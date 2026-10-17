import { render, screen, act } from '@testing-library/react'
import { ToastProvider, useToast } from '@/components/feedback'

function Trigger() {
  const toast = useToast()
  return <button onClick={() => toast.success('Guardado')}>go</button>
}

describe('ToastProvider', () => {
  it('muestra el aviso y lo retira solo', () => {
    vi.useFakeTimers()
    render(<ToastProvider><Trigger /></ToastProvider>)
    act(() => screen.getByText('go').click())
    expect(screen.getByText('Guardado')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(5100))
    expect(screen.queryByText('Guardado')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('se puede cerrar a mano y distingue el tipo de aviso', () => {
    function Both() {
      const toast = useToast()
      return <button onClick={() => { toast.error('Falló'); toast.info('Dato') }}>go</button>
    }
    render(<ToastProvider><Both /></ToastProvider>)
    act(() => screen.getByText('go').click())
    expect(screen.getByRole('alert')).toHaveTextContent('Falló') // los errores se anuncian como alerta
    expect(screen.getByRole('status')).toHaveTextContent('Dato')
    act(() => screen.getAllByRole('button', { name: 'Cerrar aviso' })[0].click())
    expect(screen.queryByText('Falló')).not.toBeInTheDocument()
  })
})
