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
1. Cada persona trabaja dentro de **su** carpeta (`usuarios`, `compra` y `financiero` = F1; `vuelos`, `busqueda` y `noticias` = F2).
2. Un feature **no importa archivos internos de otro**; solo su index público
   (`@/features/vuelos`). ESLint lo bloquea.
3. Lo que usan 2+ features sube a `components/`, `services/`, `utils/`, `domain/` o `context/`.
   `domain/` guarda los catálogos y las reglas que comparten las pantallas (ciudades, estados, cupos); no es UI.
4. Los estilos propios del feature viven en la carpeta del feature, con prefijo de clase propio
   (`us-` usuarios, `vu-` vuelos, `bu-` búsqueda, `co-` compra, `fi-` financiero, `nt-` noticias) y usan SIEMPRE los tokens de `styles/tokens.css`.

## Reglas de integración entre módulos (Sprint 2)
* Los módulos se enlazan **solo por rutas (texto)**, nunca importándose: `/comprar/:vueloId`, `/carrito`, `/mis-viajes`, `/billetera`,
  `/admin/vuelos/:id/editar`, `/admin/vuelos/:id/cancelar`, `/admin/vuelos/realizados`.
* Lo compartido por 2+ módulos vive fuera: el carrito en `context/CartContext`, pestañas y filtros (`.at-tabs`, `.at-filters`) en `styles/components.css`,
  el adaptador `toFlightProps` en `components/travel`.
* En `vuelos/index.js` las rutas estáticas (`/admin/vuelos/nuevo`, `/realizados`) van **antes** de `/admin/vuelos/:id`.
* **Punto de unión con Búsqueda (Sprint 1):** el detalle de un vuelo termina en un enlace a `/comprar/<id del vuelo>` (ya hecho); también se llega desde las noticias (`/noticias`).
* **Punto de unión con Vuelos (Sprint 1):** se conserva la lista de F2 (F2-06); solo se le agregaron los enlaces `Editar` → `/admin/vuelos/:id/editar` y
  `Cancelar` → `/admin/vuelos/:id/cancelar` y el de `Vuelos realizados`.
