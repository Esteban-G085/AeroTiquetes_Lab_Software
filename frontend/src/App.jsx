import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary, ToastProvider } from '@/components/feedback'
import { AuthProvider } from '@/context'
import AppRouter from '@/routes/AppRouter'

// Orden de providers: ErrorBoundary > Router > Toast > Auth (Auth usa avisos) > rutas.
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
