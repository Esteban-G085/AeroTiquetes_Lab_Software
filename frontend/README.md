# AeroTiquetes — Frontend

React + Vite + Bootstrap. Es la carpeta `frontend/` del monorepo (ver el [README raíz](../README.md)).

## Arranque rápido

```bash
cd frontend
npm ci
cp .env.example .env.local      # ajusta VITE_API_URL si hace falta
npm run dev                     # http://localhost:5173
```

Requiere **Node ≥ 22.19** (`jsdom@30` y `undici@8`, que usa las pruebas, lo exigen; el CI corre con Node 22).
El backend debe permitir CORS para `http://localhost:5173`.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Vitest (una pasada; `npm run test:watch` para modo vigilancia) |
| `npm run test:coverage` | Pruebas + informe de cobertura (también en `coverage/index.html`) |
| `npm run lint` | ESLint, incluida la regla de modularidad |
| `npm run build` | Compilación de producción |
| `npm run e2e` | Recorrido de funcionalidades en navegador real contra un backend simulado (sesión, registro, perfil, panel root…) |
| `npm run audit:ui` | Auditoría en navegador real: desbordes, accesibilidad (axe) y áreas de toque en 6 anchos |

`e2e` y `audit:ui` necesitan `pip install playwright && playwright install chromium` y `npm run dev` en otra terminal;
el backend se simula con respuestas de ejemplo, así que no hace falta tenerlo levantado.

En desarrollo, **`/dev/ui`** muestra el catálogo de componentes base.

## Variables de entorno (`.env.local`, nunca en Git)

| Variable | Uso |
|---|---|
| `VITE_API_URL` | URL del backend FastAPI (por defecto `http://localhost:8000`) |
| `VITE_IDLE_MINUTES` | Minutos de inactividad antes de cerrar sesión (por defecto 30, RNF06) |
| `VITE_USE_MOCKS` | Reservada: existe la variable, pero ningún módulo la consulta (el proyecto **no usa MSW**; ver `features/README.md` y el plan) |

Se leen **solo** desde `src/config/env.js`. Nadie más lee `import.meta.env`.

## Estructura

```text
src/
├── config/        env.js (variables) · roles.js (roles = claim `rol` del JWT)
├── styles/        tokens.css (colores, tipografía) · base.css (Bootstrap → tokens) · components.css
├── domain/        Reglas y catálogos del negocio: ciudades.js · estados.js · vuelo.js
├── docs/          DISENO.md (sistema de diseño) · ESTADO_SPRINT1.md (checklist) · MOCKUPS.md ·
│                  CONTRATO_USUARIOS.md (API de B1) · CONTRATO_VUELOS.md (API de B2) · mockups/
├── components/    UI compartida: ui/ · feedback/ · layout/ · brand/ · travel/
├── features/      UN MÓDULO POR CARPETA: usuarios/ · busqueda/ · vuelos/   (ver features/README.md)
├── routes/        AppRouter (construido desde los features) · RouteGuard
├── pages/         Páginas transversales (404, /dev/ui)
├── services/      http.js (Axios) · apiError · tokenStorage · authApi
├── context/       AuthContext (sesión) · useIdleTimeout
└── utils/         format · useAsyncData · useCiudades · ciudadesOpciones · useGoBack · media · cn · jwt
```

## Piezas compartidas (reutilizar antes de crear)

| Necesidad | Usar |
|---|---|
| Botones, campos, selects, modal, confirmación, insignias, interruptor, avisos, esqueletos, tarjetas, iconos | `@/components/ui` (catálogo visual en `/dev/ui`) |
| Encabezado de pantalla (título + subtítulo + acciones) | `PageHeader` de `@/components/layout` |
| Tarjeta de vuelo, pasos de la compra, formato de precio/duración/hora | `@/components/travel` y `@/utils/format` (ver `docs/DISENO.md` §5) |
| Ficha del vuelo e insignia de estado | `VueloDetalle` y `EstadoBadge` de `@/components/travel` |
| Catálogo de ciudades (`GET /ciudades`) y grupos Colombia/Internacional del `Select` | `@/utils/useCiudades` y `@/utils/ciudadesOpciones` |
| Reglas nacional/internacional, catálogos de estado y lecturas de cupos | `@/domain/ciudades`, `@/domain/estados`, `@/domain/vuelo` |
| Cargando / error con reintento / vacío | `@/components/feedback` (`LoadingState`, `ErrorState`, `EmptyState`) |
| Avisos emergentes | `useToast()` → `toast.success / error / info` |
| Llamar a la API | `import { http } from '@/services/http'` (ya agrega el JWT y normaliza errores) |
| Cargar un listado | `useAsyncData(fetcher)` → `{ status, data, error, reload, refresh }` |
| Errores por campo del backend | `ApiError.fields` → prop `error` de `Input`/`Select` |
| Fotos e imágenes que devuelve el backend | `resolveMediaUrl(path)` |
| Volver atrás | `useGoBack(fallback)` |
| Rol y sesión | `useAuth()` → `{ user, rol, isAuthenticated, login, logout }` |

## Cómo trabajamos

* **F1** es dueño de `features/usuarios`, `components/`, `routes/`, `styles/`, `config/`, `context/`, `services/` y `domain/`.
* **F2** es dueño de `features/busqueda` y `features/vuelos`, integrados sobre la base de F1 (ramas `feature/F2-*` → PR a `master`); ya **no** son *stubs*.
* Un feature se registra en **una línea** (`features/index.js`) y declara sus propias rutas, roles y menú.
* Un feature **no** importa archivos internos de otro (`@/features/x/pages/Y`); ESLint lo impide.
* Lo que usan **dos o más** features sube a `components/`, `services/`, `utils/`, `domain/` o `context/`.
* Cambiar la identidad visual = editar `styles/tokens.css`. Las clases propias llevan prefijo por módulo (`us-`, `bu-`, `vu-`).
* Una tarea = **un PR pequeño**, rama `feature/<tarea>`, y CI en verde (lint + pruebas + build).
* Imports con alias `@/` (nunca `../../..`).

## Mensajes de error de la API

Formato acordado: `{ "error": { "code", "message", "fields" } }`; `fields` se mapea al prop `error` de
`Input`/`Select` para que el mensaje salga en el campo que corresponde.

## Sesión y permisos

* `useAuth()` → `{ user, rol, isAuthenticated, login, logout }`. Sin sesión, `rol` es `'visitante'`.
* El rol sale del claim `rol` del JWT; el token vive en `sessionStorage` (se pierde al cerrar la pestaña).
* La sesión se cierra sola por **inactividad** (`VITE_IDLE_MINUTES`), al **vencer el JWT**, o si el backend
  responde **401 con token** (un 401 del login con contraseña errónea NO cierra nada).
* `routes/RouteGuard` aplica los `roles` que declara cada ruta del feature. Es solo UX:
  **la seguridad real la impone el backend** (`require_roles`).
* Para llamar a la API desde un feature: `import { http } from '@/services/http'` y crear un `api.js`
  dentro del feature. Los errores llegan como `ApiError { status, code, message, fields }`.
* `services/authApi.js` es el único sitio que conoce la forma de la respuesta de `/auth/login`.
* Para la prueba de humo con el backend real, ver `docs/ESTADO_SPRINT1.md`.

## Documentación

* `docs/DISENO.md` — sistema de diseño (tokens, componentes y reglas de experiencia).
* `docs/ESTADO_SPRINT1.md` — estado del sprint y checklist de terminado por historia.
* `docs/MOCKUPS.md` — comparación entre los mockups de las historias y lo implementado.
* `docs/CONTRATO_USUARIOS.md` — API que el front espera de B1 (acordada).
* `docs/CONTRATO_VUELOS.md` — API que el front espera de B2 (por acordar).
* `src/features/README.md` — contrato de un módulo (feature).
