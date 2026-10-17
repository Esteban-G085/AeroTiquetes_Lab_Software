import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: { react, 'react-hooks': reactHooks },
    rules: {
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Modularidad: un feature solo puede usar a otro por su index público
      // (@/features/vuelos), nunca por archivos internos (@/features/vuelos/pages/X).
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@/features/*/*'],
          message: 'Importa otros features solo por su index público: @/features/<nombre>',
        }],
      }],
    },
  },
  { files: ['**/*.test.{js,jsx}', 'src/test/**'], languageOptions: { globals: { ...globals.vitest } } },
]
