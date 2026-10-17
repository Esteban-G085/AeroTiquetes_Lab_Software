# AeroTiquetes — Frontend

React + Vite + Bootstrap. Parte del monorepo `aerotiquetes/` (carpeta `frontend/`).

## Arranque rápido

```bash
cd frontend
npm install
cp .env.example .env.local      # ajusta VITE_API_URL si hace falta
npm run dev                     # http://localhost:5173
```

Requiere Node 20.19+ (probado con 22). El backend debe permitir CORS para `http://localhost:5173`.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Vitest (una pasada; `npm run test:watch` para modo vigilancia) |
| `npm run test:coverage` | Pruebas + informe de cobertura (también en `coverage/index.html`) |
| `npm run e2e` | Recorrido de funcionalidades en navegador real contra un backend simulado (sesión, registro, perfil, panel root…) |
| `npm run audit:ui` | Auditoría en navegador real: desbordes, accesibilidad (axe) y áreas de toque en 6 anchos |
| `npm run lint` | ESLint, incluida la regla de modularidad |
| `npm run build` | Compilación de producción |

En desarrollo, `/dev/ui` muestra el catálogo de componentes base.

## Variables de entorno (`.env.local`, nunca en Git)

| Variable | Uso |
|---|---|
| `VITE_API_URL` | URL del backend FastAPI (por defecto `http://localhost:8000`) |
| `VITE_IDLE_MINUTES` | Minutos de inactividad antes de cerrar sesión (por defecto 30, RNF06) |
| `VITE_USE_MOCKS` | `true` → responde MSW (trabajar sin backend); `false` → API real |

Se leen **solo** desde `src/config/env.js`.

## Estructura

```text
src/
├── config/        env.js (variables) · roles.js (roles = claim `rol` del JWT)
├── styles/        tokens.css (colores, tipografía) · base.css (Bootstrap → tokens) · components.css
├── docs/          DISENO.md (sistema de diseño) · ESTADO_SPRINT1_F1.md (checklist) · GUIA_INTEGRACION.md · MOCKUPS.md (pantallas de F1 y diferencias con el plan) · CONTRATO_USUARIOS.md (API que F1 espera de B1) · mockups/
├── components/    UI compartida: ui/ · feedback/ · layout/ · brand/ · travel/ (FlightCard, Stepper)
├── features/      UN MÓDULO POR CARPETA: usuarios/ · vuelos/ · busqueda/   (ver features/README.md)
├── routes/        AppRouter (construido desde los features) · RouteGuard
├── pages/         Páginas transversales (404, /dev/ui)
├── services/      http.js (Axios) · apiError · tokenStorage · authApi
├── context/       AuthContext (sesión) · useIdleTimeout
├── mocks/         MSW                                (F2-01)
└── utils/
```

## Cómo se une el trabajo de los 4

* **F1** es dueño de `features/usuarios`, `components/`, `routes/`, `styles/`, `config/`.
* **F2** es dueño de `features/vuelos` y `features/busqueda`. En esas carpetas hay *stubs* mínimos
  para que el proyecto arranque completo; F2 los reemplaza sin tocar nada fuera de ellas.
* Un feature se registra en **una línea** (`features/index.js`) y declara sus propias rutas, roles y menú.
* Un feature **no** importa archivos internos de otro (`@/features/x/pages/Y`); ESLint lo impide.
* Cambiar la identidad visual = editar `styles/tokens.css`.
* Si F2 necesita un componente nuevo y compartido, lo propone en un PR pequeño a `components/` (revisa F1).

## Convenciones

* Una tarea = un PR pequeño, rama `feature/F1-02-axios-auth`. CI debe pasar (lint + test + build).
* Imports con alias `@/` (nunca `../../..`).
* Clases CSS propias con prefijo `at-`.
* Mensajes de error de la API: `{ "error": { "code", "message", "fields" } }`; `fields` se mapea al prop `error` de `Input`/`Select`.

## Sesión y permisos (F1-02)

* `useAuth()` → `{ user, rol, isAuthenticated, login, logout }`. Sin sesión, `rol` es `'visitante'`.
* El rol sale del claim `rol` del JWT; el token vive en `sessionStorage` (se pierde al cerrar la pestaña).
* La sesión se cierra sola por **inactividad** (`VITE_IDLE_MINUTES`), al **vencer el JWT**, o si el backend
  responde **401 con token** (un 401 del login con contraseña errónea NO cierra nada).
* `routes/RouteGuard` aplica los `roles` que declara cada ruta del feature. Es solo UX:
  **la seguridad real la impone el backend** (`require_roles`).
* Para llamar a la API desde un feature: `import { http } from '@/services/http'` y crear un `api.js`
  dentro del feature. Los errores llegan como `ApiError { status, code, message, fields }`.
* `services/authApi.js` es el único sitio que conoce la forma de la respuesta de `/auth/login`
  (**confirmar con B1** al publicar B1-00).
