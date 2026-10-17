import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Un solo alias (@ -> src) para que los imports no dependan de la profundidad
// de carpetas y los módulos se puedan mover/unir sin romper rutas relativas.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true }, // el backend habilita CORS para este origen
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/test/**', 'src/main.jsx', 'src/pages/DevUiPage.jsx'],
      reporter: ['text-summary', 'text', 'html'],
    },
  },
})
