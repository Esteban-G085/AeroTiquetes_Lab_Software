# Cambios en componentes compartidos

Lo que otro módulo puede notar al integrar. Los cambios de un solo feature no se listan aquí.

## Parte 9 — Integración de búsqueda y vuelos (F2)

Los módulos `features/busqueda` y `features/vuelos` se construyeron sobre la base de F1. Todo lo que necesitaban
compartir subió al núcleo: **`features/usuarios` no tuvo que cambiar nada**.

**Nuevo**
* **`domain/`** (carpeta nueva): `ciudades.js` (catálogo de ciudades y `clasificarVuelo`, que decide nacional/internacional — RF04–RF06),
  `estados.js` (catálogos de estado de vuelo y sus etiquetas) y `vuelo.js` (lecturas de cupos y texto de disponibilidad por clase).
* **`components/travel`**: `VueloDetalle` (ficha completa del vuelo, compartida por el detalle público y el panel) y `EstadoBadge`.
* **`utils/`**: `useCiudades.js` (`GET /ciudades` con respaldo local si el backend no responde) y `ciudadesOpciones.js`
  (grupos Colombia/Internacional para el `Select`).
* **`utils/format.js`**: `formatDate`, `formatDateShort`, `formatDateTime`, `formatZone`, `todayISO`, `timeToMinutes` y `minutesToTime`.
* **`Select`** admite `groups: [{ label, options }]`, que se pintan como `<optgroup>` (lo usa el respaldo de ciudades).
* Estilos compartidos en `styles/components.css`: `.at-detail` (ficha del vuelo).

**Cambios que pueden notarse**
* `formatTime`, `formatDay` y `dayOffset` ahora devuelven `—` si el instante falta o no es válido. Antes lanzaban
  `RangeError: Invalid time value` y dejaban la pantalla en blanco cuando la API no enviaba la llegada (hay pruebas de regresión).
* Las funciones de formato trabajan con **instantes ISO**; para mostrar la hora local del aeropuerto se les pasa la zona IANA.

**Descartado del plan**
* **F2-01 (MSW):** no se usa. El front se construyó contra los contratos acordados (`docs/CONTRATO_USUARIOS.md` y
  `docs/CONTRATO_VUELOS.md`). Cuando B2 publicó su API (PR #5) las pantallas de vuelos dejaron de mostrar `ErrorState`
  y pasaron a consumir la API real. `src/mocks/` sigue vacío.

## Parte 10 — Armonía visual de las pantallas de vuelos (F2)
Alinea búsqueda y vuelos con el lenguaje del rediseño (ver `docs/DISENO.md` §7). Lo que otro módulo puede notar:
* **Tabla de datos compartida** (`styles/components.css`): `.at-table` + `.at-table__scroll` + el modificador `.at-table--cards`.
  Con 8 columnas ya no se recorta: hay scroll lateral cuando no caben y, en móvil (≤ 767,98 px), cada fila se vuelve una
  tarjeta y cada celda se rotula con su `data-label` (el `thead` se oculta visualmente, no se borra). La usa `VuelosTable`
  (HU19). Si otro módulo pinta tablas, **usar estas clases y no `table` de Bootstrap**: el fondo opaco de Bootstrap pelea
  con la superficie de `.at-card`.
* **`components/layout`: `BackLink`** — el único botón «Volver» (flecha + texto, `outline-secondary`). Acepta `to` (enlace
  real) u `onClick` (volver atrás con `useGoBack`). Reemplaza los enlaces con «←» de cada módulo: F1 ya lo usa en el perfil
  y F2 en el detalle y en la consulta del panel.
* **`components/travel`: `VueloDetalleSkeleton`** — silueta con la forma de `VueloDetalle` para los estados de carga.
* **Franja de marca `.at-hero`** (junto a `.at-sky` + `SkyArt variant="wide"`): portada con el `PageHeader` en texto claro.
  La usan el buscador y el detalle público del vuelo.
* **Jerarquía:** «Ver detalle» en los resultados de búsqueda pasa a `outline-primary` (una sola acción primaria por
  pantalla) y las pantallas de vuelos se escalonan con `at-enter-2` / `at-enter-3`, como los paneles de F1.
* Los estados de carga de estas pantallas **ya no usan `LoadingState`**: usan esqueletos con la forma del contenido.

## Parte 11 — Cierre del Sprint 1 tras integrar B2 (vuelos y búsqueda)

* **`config/env.js`:** se eliminó el flag `useMocks` y la variable `VITE_USE_MOCKS` (también de `.env.example`).
  MSW fue descartado (F2-01) y ningún módulo leía ese valor: era código muerto que además sugería que el proyecto
  usaba mocks. Quien tenga un `.env.local` viejo puede borrar la línea; el comportamiento no cambia.
* **Documentación al día:** el `README.md` raíz, `frontend/README.md` y `docs/ESTADO_SPRINT1.md` reflejan que B2 ya
  está integrado y que el front consume la API real de usuarios, vuelos y ciudades.

## Parte 8 — Rediseño visual integral
**Lo que otro módulo debe saber al integrar** (cambios que sí pueden notarse):
* **Tipografía:** Fraunces (titulares) + Plus Jakarta Sans (texto) reemplazan a Roboto; Roboto Mono solo para códigos.
* **Botones:** ya NO van en MAYÚSCULAS. Variantes vigentes: `primary`, `outline-primary`, `outline-secondary`, `ghost`, `danger`
  (y `size="sm|lg"`). `bright` sigue existiendo pero ya no se usa.
* **Cabecera:** nueva (navegación visible, menú de cuenta, panel lateral solo en móvil). **Se eliminó** la barra azul con título
  y el carrito inactivo; `Header` ya no recibe `title` ni `showCart` (sí `cartSlot`, que no dibuja nada hasta que se le pase algo).
  El `title` de cada ruta ahora solo define el título de la pestaña: cada pantalla pone su propio `<h1>` (usar `PageHeader`).
* **Tokens:** `--at-muted`, `--at-blue-bright` y varios más cambiaron de valor; hay una escala nueva `--at-blue-50…900`. Los nombres
  antiguos siguen como alias, pero no deben usarse en código nuevo.
* **Avisos en línea:** usar `<Notice tone>` en lugar de clases propias de alerta (`.us-form__alert` ya no existe).
* **`Input type="password"`** trae botón de mostrar/ocultar (su `aria-label` es "Mostrar contraseña"): si una prueba busca la
  etiqueta con una regex amplia (`/contraseña/i`) ahora puede encontrar dos elementos; usar la etiqueta exacta.
* `PagePlaceholder` ya no muestra el código de tarea al usuario final (solo en desarrollo).

**Nuevo**
* `components/ui`: `Icon`, `Notice`, `Skeleton`, `Card`. `components/layout`: `PageHeader`, `Footer`, `UserMenu`.
  `components/brand`: `Wordmark`, `SkyArt`. `components/travel`: `FlightCard`, `Stepper`. `utils/format.js`.
* `ErrorBoundary`, `docs/DISENO.md` (sistema de diseño y reglas de compra) y catálogo ampliado en `/dev/ui`.

## Parte 7 — F1-09 (cierre)
* **Nuevo `ErrorBoundary`** (en `App.jsx`): un error de render muestra un mensaje con "Recargar / Ir al inicio" en vez de pantalla en blanco.
* **Cambios visibles en tokens** por accesibilidad (contraste WCAG AA): `--at-muted` `#787f85 → #656c75` y `--at-blue-bright` `#3675f2 → #2f6bea`.
  Los enlaces ahora usan el azul del proyecto (faltaban las variables `--bs-link-color-rgb`).
* Botón de cerrar de los diálogos y los interruptores con área de toque mayor.
* Nuevos comandos: `npm run test:coverage` y `npm run audit:ui`; `scripts/audit-ui.py` (requiere Playwright).
* `.github/pull_request_template.md` con la definición de terminado común.

## Parte 6 — F1-07 / F1-08
* **Nuevos componentes de `components/ui`:** `Badge` (`tone`: success · warning · danger · neutral) para estados como ACTIVO/PENDIENTE
  (F2 puede usarlo para programado/realizado/cancelado) y `Switch` (interruptor accesible con `role="switch"`).
  Ambos se ven en `/dev/ui`.
* **Nuevo hook `utils/useAsyncData(fetcher)`** → `{ status, data, error, reload, refresh }`: carga al montar con estados loading/ready/error.
  Pensado para los listados de F2 (`status` + `LoadingState` / `ErrorState` / `EmptyState`).
* `usePerfil` ahora se apoya en `useAsyncData` (misma API para quien lo use).

## Parte 5 — F1-05 / F1-06
* **FIX `Modal` y `Drawer`:** el efecto de foco dependía de `onClose`; con un `onClose` inline el foco volvía al diálogo
  **en cada tecla** y no se podía escribir en formularios dentro de un modal. Ahora depende solo de `open`, y respeta
  un `autoFocus` interno. Hay prueba de regresión (`ui.test.jsx`). *Si F2 ya tenía una solución propia, descartarla.*
* `AuthContext` expone `updateUser(patch)` (refresca el nombre del menú tras editar el perfil).
* Nuevos: `utils/media.js` (`resolveMediaUrl`: ruta de imagen del backend → URL), `utils/useGoBack.js` (botón "Atrás").
* `services/api` de Usuarios añade `obtenerPerfil`, `actualizarPerfil`, `solicitarCambioCorreo`, `cambiarPassword`.

## Parte 4 — F1-04
* Nuevos botones de estilo: `variant="ghost"` (texto azul, "CANCELAR") y `variant="bright"`.
* `test/setup.js` simula `URL.createObjectURL` (vista previa de fotos en jsdom).

## Partes 1–3
* Sistema visual en `styles/tokens.css` (Roboto / Roboto Mono, azules de los mockups); botones en MAYÚSCULAS.
* Layouts: `MainLayout` (barra + menú lateral) y `BareLayout` (pantalla completa). Cada ruta declara `layout` y `title`.
* Contrato de feature: `{ path, title, layout?, Component, roles?, nav? }` (ver `src/features/README.md`).
