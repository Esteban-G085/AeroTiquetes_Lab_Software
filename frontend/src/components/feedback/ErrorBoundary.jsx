import { Component } from 'react'

/**
 * Red de seguridad global: si una pantalla lanza una excepción al renderizar, el usuario ve un mensaje
 * claro con salida (recargar / ir al inicio) en vez de una página en blanco.
 * Debe ser un componente de clase: React no ofrece aún un equivalente con hooks.
 */
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    // Solo el mensaje técnico, nunca estado de sesión, tokens ni datos del formulario.
    if (import.meta.env.DEV) console.error('[ErrorBoundary]', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="at-state" role="alert" style={{ minHeight: '100vh', display: 'grid', placeContent: 'center' }}>
        <div className="at-state__title">Algo salió mal</div>
        <p className="mb-3">Ocurrió un error inesperado. Puedes recargar la página o volver al inicio.</p>
        <div className="d-flex gap-2 justify-content-center">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Recargar</button>
          <a className="btn btn-outline-primary" href="/">Ir al inicio</a>
        </div>
      </div>
    )
  }
}
