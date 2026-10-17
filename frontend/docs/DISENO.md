# Diseño de AeroTiquetes

Dirección visual, sistema de diseño y reglas de experiencia de compra. Es la referencia para cualquier
pantalla nueva. **Reemplaza el aspecto de los mockups de las HU**; estos siguen valiendo solo como referencia de
funciones y estructura (ver `MOCKUPS.md`).

## 1. Dirección

Una plataforma de viajes **elegante, clara y confiable**: superficies claras y aireadas, titulares editoriales con carácter,
un único acento cálido y una ilustración propia de marca (cielo, nubes y ruta de vuelo). Nada de efectos por efecto:
cada recurso (sombra, degradado, animación) cumple una función.

### Lo que se conservó de la identidad original
Los azules del proyecto son las anclas de la escala y siguen siendo reconocibles (◆ en `styles/tokens.css`):
`#244dbe` primario · `#3b62c8` barra · `#1a336c` marino · `#0b1936` noche · `#78d84f` verde de "activo".
La marca (avión sobre disco azul con órbita) se mantiene, refinada.

### Lo que cambió, y por qué
| Antes | Ahora | Motivo |
|---|---|---|
| Roboto + Roboto Mono en todos los títulos | Fraunces (titulares) + Plus Jakarta Sans (texto); mono solo para códigos | Roboto daba aspecto de plantilla; la serif aporta carácter y sensación premium |
| Barra azul con ☰ permanente | Cabecera clara con navegación visible, menú de cuenta; panel lateral solo en móvil | Descubribilidad y menos clics en escritorio |
| Tarjetas oscuras de degradado (admin, registro) | Superficies claras con jerarquía | Legibilidad, aspecto menos "panel administrativo" |
| Botones en MAYÚSCULAS | Frase normal, peso 600 | Más moderno y legible |
| Carrito inactivo en la barra | Se retiró | Un botón que no hace nada confunde; la ranura `cartSlot` queda lista para la Iteración 2 |
| Mensajes de error como texto suelto | `Notice` con icono y tono | Se distinguen de un vistazo |
| "Cargando…" en texto | Esqueletos con la forma del contenido | Menos salto visual |

## 2. Tokens (`src/styles/tokens.css`)
Todo valor visual sale de aquí: color (escala `--at-blue-50…900`, acento `--at-sun`, estados), tipografía y escala,
radios, sombras, movimiento. **Nunca** colores sueltos en un componente. Los nombres anteriores (`--at-blue`,
`--at-blue-dark`, `--at-muted`…) siguen existiendo como alias.

Contraste verificado (WCAG AA): texto `#131a2e` sobre blanco 17,3:1 · secundario `#556079` 6,3:1 · blanco sobre primario 7,3:1.
Los bordes de campos usan `--at-line-strong` (≥ 3:1).

## 3. Componentes (`src/components`)
| Grupo | Piezas |
|---|---|
| `ui/` | `Button` (primary · outline-primary · outline-secondary · ghost · danger · `size`) · `Input` (con mostrar/ocultar contraseña) · `Select` · `Modal` · `ConfirmDialog` · `Badge` · `Switch` · `Notice` · `Skeleton` · `Card` · `Icon` |
| `feedback/` | `LoadingState` · `ErrorState` · `EmptyState` · `useToast` · `ErrorBoundary` · `PagePlaceholder` |
| `layout/` | `MainLayout` (cabecera + pie) · `BareLayout` (pantalla completa) · `Header` · `Drawer` · `UserMenu` · `PageHeader` · `BackLink` · `Footer` |
| `brand/` | `Logo` · `Wordmark` · `SkyArt` (ilustración vectorial; variantes `tall` y `wide`) |
| `travel/` | `FlightCard` · `VueloDetalle` · `EstadoBadge` · `Stepper` (ver §5) |

Catálogo visual vivo: **`/dev/ui`** (solo en desarrollo).

Sin fotografías: el entorno de trabajo no permite descargarlas y no se usan imágenes con derechos dudosos. La ilustración
vectorial pesa pocos KB. Si el producto incorpora fotos de destinos, deben ser propias o licenciadas, optimizadas (WebP/AVIF),
con `alt` útil y sin cargar en móvil las de escritorio.

## 4. Experiencia y conversión en lo que ya existe
* **Menos fricción en formularios:** mostrar/ocultar contraseña, errores que se limpian al corregir, foco al primer error,
  `autocomplete` correcto, registro en dos secciones con sentido, hints donde hay reglas (contraseña).
* **Claridad de acciones:** una acción primaria por pantalla (botón relleno) y las secundarias con menos peso.
* **Confianza y transparencia:** el cambio de correo explica qué va a pasar ("te enviamos un enlace… tu correo actual
  seguirá activo"); eliminar pide confirmación y avisa de consecuencias; los errores dicen cómo corregir.
* **Retroalimentación:** carga con esqueletos, botones con estado de envío, avisos emergentes con icono.
* **Accesibilidad:** foco visible, navegación por teclado, `prefers-reduced-motion` respetado, áreas de toque ≥ 24 px.

## 5. Búsqueda, detalle y administración de vuelos

Las historias 5, 18 y 19 **no tienen mockup** en `Historias_de_Usuario.docx`, así que su referencia visual es este
documento. Estas son las pantallas ya construidas:

| Pantalla | Ruta | Quién | Qué muestra |
|---|---|---|---|
| Buscar vuelos | `/` | visitante y cliente | Formulario de criterios combinables y la lista de resultados |
| Detalle del vuelo | `/vuelos/:id` | visitante y cliente | `VueloDetalle`; al visitante se le invita a registrarse (la compra es de la Iteración 2) |
| Vuelos programados | `/admin/vuelos` | administrador | Filtros + tabla de solo lectura (HU19) |
| Programar vuelo | `/admin/vuelos/nuevo` | administrador | Formulario de HU18 con vista previa de lo que generará el backend |
| Consultar vuelo | `/admin/vuelos/:id` | administrador | `VueloDetalle` sin acciones |

### `FlightCard`
Solo presenta; no busca ni compra. Recibe de la API: código, aerolínea, origen/destino, salida/llegada **como instantes ISO con zona**,
`salidaZona`/`llegadaZona` (IANA), escalas, precio y moneda. Muestra la llegada **en hora local del destino** (criterio de la HU5)
y el "+1" si llega al día siguiente.
* `etiqueta` ("Más barato de esta búsqueda"): **solo** si existe un criterio real que la respalde. Sin etiqueta no se dibuja nada.
* `action`: el botón lo pone quien la usa, así la tarjeta nunca finge ser funcional.
* `detalles`: condiciones y restricciones (equipaje, cambios, cargos) **visibles en la tarjeta**, no escondidas.

### `VueloDetalle` y `EstadoBadge`
La ficha del vuelo (código, ruta, salida y llegada en hora local, duración, costo y cupos por clase) y la insignia de
estado (`programado` · `realizado` · `cancelado`, con los tonos de `Badge`). Las comparten el detalle público y la consulta
del administrador; `acciones` es opcional, así la misma ficha sirve en modo solo lectura.

### `Stepper`
Para reserva → pasajeros → pago → confirmación. `aria-current="step"` y pasos completados anunciados.
(Aún sin uso: la compra es de la Iteración 2.)

### Utilidades (`utils/format.js`)
`formatPrice` · `formatDuration` · `formatTime`/`formatDay` (en la zona del aeropuerto, no la del equipo) · `dayOffset` ·
`minutesBetween` · `formatDate`/`formatDateShort`/`formatDateTime` · `formatZone` · `todayISO` · `timeToMinutes`/`minutesToTime`.
Devuelven `—` cuando el instante falta o es inválido, para que un dato ausente de la API no rompa la pantalla.

### `domain/` (no es UI, pero manda en ella)
`ciudades.js` (catálogo y clasificación nacional/internacional), `estados.js` (catálogos de estado) y `vuelo.js`
(lecturas de cupos y disponibilidad) concentran las reglas que comparten las pantallas de búsqueda y de vuelos.
Es presentación, no negocio: las reglas de verdad las impone el backend.

### Reglas para el flujo de compra (de la brief de diseño)
1. **Precio claro y total antes de pagar**; ningún costo aparece al final.
2. **Resumen de la reserva** visible en cada paso relevante y antes de confirmar.
3. Botones distintos para **continuar / volver / modificar / confirmar**.
4. Conservar lo que el usuario ya escribió al retroceder.
5. Pantalla de confirmación con el resultado inequívoco.
6. **Persuasión ética:** nada de reseñas, cifras de compradores, "últimas plazas", precios tachados ni temporizadores que no
   vengan de datos reales. Una etiqueta o una cifra de disponibilidad solo se muestra si la API la respalda.
7. Ningún botón que parezca funcional y no lo sea.

## 6. Cómo verificar un cambio visual
```bash
npm run lint && npm test && npm run build
npm run dev            # en otra terminal:
npm run audit:ui       # desbordes, accesibilidad (axe) y áreas de toque en 6 anchos
```
`scripts/audit-ui.py` cubre el módulo Usuarios y las pantallas de vuelos (búsqueda, detalle, panel, programación y consulta)
simulando la API: no hace falta el backend levantado.

## 7. Patrones de presentación compartidos (armonía F1 ↔ F2)
Las pantallas de búsqueda y de vuelos se alinearon con el lenguaje del rediseño **reutilizando piezas**, no copiando estilos:
* **`.at-table`** (`styles/components.css`): la tabla de datos de la app. `.at-table__scroll` da scroll lateral cuando las
  columnas no caben y `.at-table--cards` convierte cada fila en tarjeta en móvil (≤ 767,98 px): el `thead` se oculta
  visualmente (sigue existiendo para lectores de pantalla) y cada celda se rotula con su `data-label`. Sustituye a la
  `table` de Bootstrap, cuyo fondo opaco pelea con la superficie de `.at-card`.
* **`.at-hero`** (se usa junto a `.at-sky` y `SkyArt variant="wide"`): franja de marca con el `PageHeader` en texto claro;
  es la portada del buscador y del detalle público del vuelo. Título y resumen van sobre la parte oscura del degradado
  (blanco sobre `#1d3b85` ≈ 10:1), por eso el degradado de marca empieza oscuro arriba.
* **`BackLink`** (`components/layout`): el único botón «Volver» de la app (flecha + texto, variante secundaria). Acepta `to`
  (enlace real, se puede abrir en otra pestaña) o `onClick` (volver a la pantalla anterior). Está en el núcleo porque lo
  usan F1 (perfil) y F2 (detalle y consulta del panel); ningún módulo debe repetir el enlace con «←».
* **`VueloDetalleSkeleton`** (`components/travel`): silueta con la forma de `VueloDetalle`, para el detalle público (HU5)
  y la consulta del panel (HU19). Las pantallas de vuelos **ya no** usan `LoadingState`.
* **Jerarquía y escalonamiento:** una sola acción primaria por pantalla (§4) —de ahí que «Ver detalle» en los resultados sea
  `outline-primary`— y las tarjetas entran con `at-enter`, `at-enter-2` y `at-enter-3`, igual que los paneles de F1.
