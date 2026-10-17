# Contrato de un feature

Cada carpeta en `features/` es un módulo funcional (SRS RNF12) y **expone un solo
objeto por defecto** en su `index.js`:

```js
import { lazy } from 'react'
import { ROLES } from '@/config/roles'

export default {
  name: 'usuarios',
  routes: [
    {
      path: '/login',
      title: 'Iniciar sesión',                            // título de la pestaña del navegador
      layout: 'bare',                                     // 'bare' = pantalla completa; omitir = con cabecera y pie
      Component: lazy(() => import('./pages/LoginPage')), // carga diferida por feature
      roles: [ROLES.VISITANTE],                           // quién puede entrar (omitir = todos)
      nav: { label: 'Iniciar sesión', area: 'account', order: 90 }, // omitir = no aparece en el menú lateral
    },
  ],
}
```

Para sumar un módulo al sistema: crear la carpeta y agregar **una línea** en
`features/index.js`. Nada más del núcleo cambia.

## Reglas
1. Cada persona trabaja dentro de **su** carpeta (`usuarios` = F1, `vuelos` y `busqueda` = F2).
2. Un feature **no importa archivos internos de otro**; solo su index público
   (`@/features/vuelos`). ESLint lo bloquea.
3. Lo que usan 2+ features sube a `components/`, `services/`, `utils/`, `domain/` o `context/`.
   `domain/` guarda los catálogos y las reglas que comparten las pantallas (ciudades, estados, cupos); no es UI.
4. Los estilos propios del feature viven en la carpeta del feature, con prefijo de clase propio
   (`us-` usuarios, `vu-` vuelos, `bu-` búsqueda) y usan SIEMPRE los tokens de `styles/tokens.css`.
