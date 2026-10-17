# Guía de integración (para F2 y para la unión final)

## Arrancar
```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev            # http://localhost:5173
npm run lint && npm test && npm run build     # lo que corre el CI
```

## Quién es dueño de qué
| Carpeta | Dueño | Nota |
|---|---|---|
| `src/features/usuarios/` | F1 | Hecho |
| `src/features/vuelos/` · `src/features/busqueda/` | **F2** | Integrados sobre la base de F1 (`feature/integracion-f2`); ya no son stubs |
| `src/components/`, `src/routes/`, `src/styles/`, `src/config/`, `src/context/`, `src/services/` | F1 | Si F2 necesita algo compartido, PR pequeño a F1 |

## Cómo F2 reemplaza sus módulos
1. Trabajar solo dentro de `features/vuelos` y `features/busqueda` (páginas, componentes, `api.js`, hooks, CSS).
2. Mantener el **contrato**: cada `index.js` exporta `{ name, routes: [{ path, title, layout?, Component, roles?, nav? }] }` (ver `src/features/README.md`).
   Las rutas y textos de menú ya están declarados en los stubs: se conservan y se cambia el `Component` por la pantalla real.
3. Prefijos de clase CSS propios (`vu-`, `bu-`) y **siempre** los tokens de `styles/tokens.css` (nunca colores sueltos).
4. No importar archivos internos de otro feature (`@/features/x/pages/Y`): ESLint lo bloquea. Se usa solo el `index` público.

## Qué ya existe para reutilizar
| Necesidad | Usar |
|---|---|
| Botones, campos, selects, modal, confirmación, insignias, interruptor, avisos (`Notice`), esqueletos, tarjetas, iconos | `@/components/ui` (catálogo visual en `/dev/ui`) |
| Encabezado de pantalla (título + subtítulo + acciones) | `PageHeader` de `@/components/layout` (cada pantalla pone su `<h1>`) |
| Tarjeta de vuelo, pasos de la compra, formato de precio/duración/hora | `@/components/travel` y `@/utils/format` (ver `DISENO.md` §5) |
| Ficha del vuelo (detalle público y del panel) | `VueloDetalle` y `EstadoBadge` de `@/components/travel` |
| Catálogo de ciudades (`GET /ciudades`) y selects Colombia/Internacional | `@/utils/useCiudades` y `@/utils/ciudadesOpciones` |
| Reglas nacional/internacional, catálogos de estado y lecturas de cupos | `@/domain/ciudades`, `@/domain/estados`, `@/domain/vuelo` |
| Cargando / error con reintento / vacío ("No existen vuelos…") | `@/components/feedback` (`LoadingState`, `ErrorState`, `EmptyState`) |
| Avisos | `useToast()` → `toast.success / error / info` |
| Llamar a la API | `import { http } from '@/services/http'` (ya agrega el JWT y normaliza errores) |
| Cargar un listado | `useAsyncData(fetcher)` → `{ status, data, error, reload, refresh }` |
| Errores por campo del backend | `ApiError.fields` → prop `error` de `Input`/`Select` |
| Fotos / imágenes del backend | `resolveMediaUrl(path)` |
| Volver atrás | `useGoBack(fallback)` |
| Rol y sesión | `useAuth()` → `{ rol, user, isAuthenticated, login, logout }` |

Ejemplo mínimo de un listado:
```jsx
import { useAsyncData } from '@/utils/useAsyncData'
import { http } from '@/services/http'
import { LoadingState, ErrorState, EmptyState } from '@/components/feedback'

const cargar = async () => (await http.get('/vuelos', { params })).data

const { status, data, error, reload } = useAsyncData(cargar)
if (status === 'loading') return <LoadingState />
if (status === 'error') return <ErrorState message={error.message} onRetry={reload} />
if (!data.length) return <EmptyState title="No existen vuelos para tu búsqueda" />
```

## Diseño
* Todo sale de los mockups de `Historias_de_Usuario.docx`; los de F1 están en `docs/mockups/`.
* Pantallas completas sin cabecera: `layout: 'bare'`; con cabecera y pie: layout por defecto. El `title` de la ruta define el título de la pestaña; el `<h1>` lo pone cada pantalla.
* Titulares en Fraunces, texto en Plus Jakarta Sans, botones en frase normal. Reglas y tokens en `docs/DISENO.md`.
* Contraste: usar `--at-muted` para texto secundario; el gris más claro no cumple AA.
* Antes de pedir revisión: `npm run audit:ui` (desbordes, accesibilidad, tamaños de toque). Ver `scripts/audit-ui.py` para agregar sus pantallas.

## Unir el trabajo
1. `main` recibe primero la base de F1. F2 hace *rebase* y reemplaza sus módulos.
2. Puntos donde suele haber conflicto:
   * `package.json` / `package-lock.json`: resolver y correr `npm install`.
   * `src/features/index.js`: una línea por feature; conservar las tres.
   * `src/styles/tokens.css`: solo lo toca F1.
3. Tras unir: `npm run lint && npm test && npm run build && npm run audit:ui`, y la **prueba de humo** de `ESTADO_SPRINT1_F1.md`.

## Contrato con el backend
Todo lo que el front espera de la API está en `CONTRATO_USUARIOS.md`. F2 puede tomarlo de modelo para el suyo
(vuelos y búsqueda) y acordar con B2 los nombres de campos en `snake_case`, idénticos en formulario y `error.fields`.
