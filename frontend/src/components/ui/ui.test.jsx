import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button, Input, Modal, ConfirmDialog } from '@/components/ui'

describe('Button', () => {
  it('se deshabilita mientras carga (evita doble envío)', () => {
    render(<Button loading>Guardar</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})

describe('Input', () => {
  it('asocia etiqueta, error y accesibilidad', () => {
    render(<Input label="Correo" error="Correo inválido" />)
    const input = screen.getByLabelText('Correo')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Correo inválido')
  })
})

describe('Modal', () => {
  it('no renderiza cerrado y cierra con Escape', async () => {
    const onClose = vi.fn()
    const { rerender } = render(<Modal open={false} title="T" onClose={onClose}>x</Modal>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    rerender(<Modal open title="T" onClose={onClose}>x</Modal>)
    expect(screen.getByRole('dialog', { name: 'T' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})

describe('Modal — regresión de foco', () => {
  function Harness() {
    const [text, setText] = useState('')
    // onClose inline: función nueva en CADA render, como en el uso real
    return (
      <Modal open title="Con campo" onClose={() => {}}>
        <input aria-label="campo" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      </Modal>
    )
  }
  it('escribir varias letras no le quita el foco al campo', async () => {
    render(<Harness />)
    await userEvent.type(screen.getByLabelText('campo'), 'hola mundo')
    expect(screen.getByLabelText('campo')).toHaveValue('hola mundo')
    expect(screen.getByLabelText('campo')).toHaveFocus()
  })
})

describe('ConfirmDialog', () => {
  it('llama a onConfirm y onCancel', async () => {
    const onConfirm = vi.fn(); const onCancel = vi.fn()
    render(<ConfirmDialog open title="Eliminar" message="¿Seguro?" confirmLabel="Eliminar" onConfirm={onConfirm} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
