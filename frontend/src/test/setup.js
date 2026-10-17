import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll } from 'vitest'

// jsdom no implementa las URLs temporales de archivos (vista previa de fotos)
beforeAll(() => {
  URL.createObjectURL ??= () => 'blob:preview'
  URL.revokeObjectURL ??= () => {}
})

afterEach(() => sessionStorage.clear())
