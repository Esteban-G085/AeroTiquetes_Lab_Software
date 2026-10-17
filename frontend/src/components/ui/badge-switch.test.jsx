import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Badge, Switch } from '@/components/ui'

describe('Badge', () => {
  it('aplica el tono', () => {
    render(<Badge tone="success">Activo</Badge>)
    expect(screen.getByText('Activo')).toHaveClass('at-badge--success')
  })
})

describe('Switch', () => {
  it('es un interruptor accesible que notifica el nuevo valor', async () => {
    const onChange = vi.fn()
    render(<Switch label="Cliente: Vuelos" checked={false} onChange={onChange} />)
    await userEvent.click(screen.getByRole('switch', { name: 'Cliente: Vuelos' }))
    expect(onChange).toHaveBeenCalledWith(true)
  })
  it('deshabilitado no responde', async () => {
    const onChange = vi.fn()
    render(<Switch label="x" checked disabled onChange={onChange} />)
    await userEvent.click(screen.getByRole('switch'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
