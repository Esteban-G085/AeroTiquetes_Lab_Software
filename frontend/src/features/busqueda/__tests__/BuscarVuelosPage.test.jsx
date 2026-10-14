import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../../context/AuthContext.jsx'
import BuscarVuelosPage from '../pages/BuscarVuelosPage.jsx'

function renderPagina() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <BuscarVuelosPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('BuscarVuelosPage', () => {
  it('carga y muestra tarjetas de vuelo', async () => {
    renderPagina()
    await waitFor(() => {
      expect(screen.getAllByText('Ver detalle').length).toBeGreaterThan(0)
    })
  })

  it('renderiza el formulario de búsqueda', async () => {
    renderPagina()
    expect(screen.getByLabelText('Origen')).toBeInTheDocument()
    expect(screen.getByLabelText('Destino')).toBeInTheDocument()
    // El botón pasa de "Buscando…" a "Buscar vuelos" cuando termina la primera carga.
    expect(await screen.findByRole('button', { name: 'Buscar vuelos' })).toBeInTheDocument()
  })
})
