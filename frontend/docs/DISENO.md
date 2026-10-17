# Diseño de AeroTiquetes

Dirección visual, sistema de diseño y reglas de experiencia de compra. Es la referencia para F2 y para cualquier
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
| `layout/` | `MainLayout` (cabecera + pie) · `BareLayout` (pantalla completa) · `Header` · `Drawer` · `UserMenu` · `PageHeader` · `Footer` |
| `brand/` | `Logo` · `Wordmark` · `SkyArt` (ilustración vectorial; variantes `tall` y `wide`) |
| `travel/` | `FlightCard` · `Stepper` (ver §5) |

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

## 5. Para F2: pantallas de búsqueda y compra
Estas pantallas **aún no existen**, así que el rediseño dejó listas las piezas y las reglas, no pantallas con datos inventados.

### `FlightCard`
Solo presenta; no busca ni compra. Recibe de la API: código, aerolínea, origen/destino, salida/llegada **como instantes ISO con zona**,
`salidaZona`/`llegadaZona` (IANA), escalas, precio y moneda. Muestra la llegada **en hora local del destino** (criterio de la HU5)
y el "+1" si llega al día siguiente.
* `etiqueta` ("Más barato de esta búsqueda"): **solo** si existe un criterio real que la respalde. Sin etiqueta no se dibuja nada.
* `action`: el botón lo pone quien la usa, así la tarjeta nunca finge ser funcional.
* `detalles`: condiciones y restricciones (equipaje, cambios, cargos) **visibles en la tarjeta**, no escondidas.

### `Stepper`
Para reserva → pasajeros → pago → confirmación. `aria-current="step"` y pasos completados anunciados.

### Utilidades (`utils/format.js`)
`formatPrice` · `formatDuration` · `formatTime`/`formatDay` (en la zona del aeropuerto, no la del equipo) · `dayOffset` · `minutesBetween`.

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
