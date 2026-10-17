# Cambios en componentes compartidos (para F2 y para la unión final)

Lo que otro módulo puede notar al integrar. Los cambios de un solo feature (`features/usuarios`) no se listan aquí.

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
