import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary, ToastProvider } from '@/components/feedback'
import { AuthProvider, CartProvider } from '@/context'
import AppRouter from '@/routes/AppRouter'

// Orden de providers: ErrorBoundary > Router > Toast > Auth (Auth usa avisos) > Cart (depende de la sesión) > rutas.
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <CartProvider>
              <AppRouter />
            </CartProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
