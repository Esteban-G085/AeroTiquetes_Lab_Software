# Integración del Sprint 2 (B1 backend + F1 frontend) sobre el Sprint 1 final

Qué se unió, **cada cambio hecho en código de otros** y lo que queda pendiente. Hecho por B1 (Jhon Felipe Loaiza Restrepo).

## 1. Qué se unió y cómo

| Pieza | Origen |
|---|---|
| Sprint 1 final (Gmail SMTP, países, correcciones de B2/F2…) | zip `AeroTiquetes_Lab_Software-master` más reciente |
| Backend Sprint 2 (HU6–HU10) + retiro de roles (HU24) | `aerotiquetes-sprint2-b1.zip` (B1) |
| Frontend Sprint 2 (compra, reserva, billetera, noticias, admin de vuelos) | `aerotiquetes-frontend-sprint2.zip` (F1) |

Se hizo una **mezcla de tres vías** archivo por archivo (no se pisó nada a ciegas):

* Backend: base = Sprint 1 anterior · mío = B1 Sprint 2 · de ellos = Sprint 1 final.
* Frontend: base = rediseño de F1 sobre el que partió su Sprint 2 · mío = F1 Sprint 2 · de ellos = Sprint 1 final.
* Lo que solo cambió un lado se tomó tal cual; lo que cambiaron ambos se fusionó; los conflictos se resolvieron a mano (abajo).

## 2. Backend

| Archivo | Qué pasó |
|---|---|
| `core/email.py` | Fusionado sin conflicto: el cambio del Sprint 1 final (configuración leída en cada envío, Gmail SMTP) **y** mis `enviar_codigo_reserva` / `enviar_aviso_cancelacion`. |
| `usuarios/{router,schemas,service}.py` | Conflicto: el Sprint 1 final tocó el registro (país de nacimiento) y yo quité roles. Se dejó mi versión sin roles y se **reaplicó** lo del país y los envíos de correo con `email.enviar_*`. |
| `tests/test_roles.py` | Borrado (la gestión de roles se retiró, ver `CAMBIOS_SPRINT2.md`). |
| `static/perfiles/*.png` | Se **conservan** las dos fotos de prueba que venían en el zip de B1 (las que genera la suite al correr no se incluyen). |
| Migraciones | Cadena `001 → 008` intacta (`006_paises` del Sprint 1 final queda antes de `007_quitar_roles`). |

**Lo que le faltaba al backend para las pantallas de F1 (alcance de B2, hecho en esta integración)** — ver §2.1 y §2.2.

**Dos consultas nuevas** (módulo `compras`, solo `cliente`), que el frontend de F1 necesita y no existían:

* `GET /vuelos/{id}/regreso` → vuelos directos destino→origen posteriores a la llegada (trayecto completo).
* `GET /vuelos/{id}/mis-tiquetes` → `{ activos, maximo, disponibles }` (límite de 5 por vuelo).

Con 4 pruebas nuevas en `tests/test_compras.py`. Documentadas en `CONTRATO_COMPRAS.md` §8 y `backend/README.md`.

### 2.1 Noticias y suscripción (HU11, B2-15) — módulo nuevo `app/modules/noticias/`
* Tablas `noticia` y `suscripcion` (migración `009_noticias`). `GET /noticias`, `GET/PUT/DELETE /noticias/suscripcion`.
* La noticia se crea **sola al programar el vuelo** (usa el punto de extensión `ALPROGRAMAR_VUELO` que B2 ya había dejado en `vuelos/service.py`); a los suscritos se les
  envía un correo en segundo plano (`core/email.enviar_noticia_vuelo`). Vigencia 8 días y solo mientras el vuelo siga programado.
* Al arrancar la app se crean las noticias de los vuelos programados hace menos de 8 días que aún no tengan (los 20 de ejemplo).

### 2.2 Editar, cancelar y realizados (HU12–HU14, B2-12 … B2-14) — en `vuelos/` (código de B2, solo se **añadió**)
* `PUT /admin/vuelos/{id}`, `PATCH /admin/vuelos/{id}/cancelar`, `GET /admin/vuelos/realizados`. Reglas y errores en `frontend/docs/CONTRATO_ADMIN_VUELOS_NOTICIAS.md`.
* Cancelar con tiquetes pide causa de fuerza mayor y llama al gancho `compras.service.reintegrar_vuelo_cancelado` (reintegra a las billeteras, cancela reservas, devuelve cupos).
* Estados automáticos (HU22): `vuelos.service.actualizar_estados` (`programado → sucedido → realizado`), llamado cada 60 s desde la tarea de `main.py` y al consultar realizados, editar o cancelar.
* El panel del administrador (`GET /admin/vuelos`, `/admin/vuelos/{id}`) ahora devuelve también `tiquetes_vendidos` (campo nuevo, no cambia los existentes).
* **Cambios en código de B2 (a revisar):**
  * `vuelos/router.py`: `POST /admin/vuelos` recibe `BackgroundTasks` para avisar a los suscritos; los endpoints del panel usan `VueloAdminOut`.
  * `vuelos/schemas.py`, `vuelos/service.py`: solo se añadieron clases y funciones.
  * `tests/test_contrato_vuelos.py`: dos aserciones aceptan el campo nuevo `tiquetes_vendidos`. `tests/test_migraciones.py`: cadena hasta `009`. `tests/conftest.py`: importa los modelos de noticias.
  * `main.py` y `alembic/env.py`: registran el router y los modelos de noticias.
* **Cambio en código mío (B1):** `compras/service._tomar_cupos` ahora exige además `vuelo.estado = programado` en el mismo `UPDATE`, para que una compra que llega justo mientras se cancela el vuelo no deje tiquetes en un vuelo cancelado.
* Pruebas nuevas: `tests/test_admin_vuelos_noticias.py` (28).

## 3. Frontend

### 3.1 Capa adaptadora (el cambio importante)
F1 construyó las pantallas contra `docs/CONTRATO_SPRINT2.md` (una compra o reserva **por vuelo**, ids numéricos, vuelo con
`salida`/`precio`/`origen.ciudad`, `contacto_nombre`). Mi backend responde distinto (una **operación** con tiquetes de varios vuelos,
`salida_utc`, `costo`, `nombre_contacto`…). En vez de reescribir las pantallas, se reescribieron **solo dos archivos** que traducen entre ambas formas:

* `features/compra/api.js` — agrupa los tiquetes de una operación por vuelo y clase; el id de cada grupo es `operación:tiquetes`, así
  cancelar una compra de un vuelo envía los `tiquete_ids` de ese grupo. Traduce los errores por campo (`items.0.viajeros.1.correo` → `viajeros.1.correo`,
  `nombre_contacto` → `contacto_nombre`, y el error de `documento` al viajero correcto).
* `features/financiero/api.js` — tarjetas (`ultimos4` → `numero`, `fecha_expiracion` → `vencimiento`), saldo con `moneda: 'COP'`.

Pruebas nuevas: `compra/api.test.js`, `financiero/api.test.js`.

### 3.2 Diferencias respecto al contrato de F1 (decisiones)
| Contrato F1 | Lo real | Cómo se resolvió |
|---|---|---|
| Una reserva por vuelo | `POST /reservas` acepta varios ítems | Se hace una llamada por ítem (cada vuelo se paga y cancela aparte); si falla una, se cancelan las ya creadas. |
| `POST /reservas/{id}/pagar` | `POST /reservas/{id}/comprar` | Adaptador. |
| Códigos de error en mayúsculas | minúsculas (`saldo_insuficiente`) | La pantalla compara sin distinguir mayúsculas. |
| Editar tarjeta sin volver a escribir el número | El backend nunca devuelve el número completo | Al editar hay que escribir de nuevo el número; si no se escribe, no se envía y el backend conserva el actual. |
| Historial como una lista de compras/reservas por vuelo | `/mi-historial` pagina por **operación** | El adaptador pide todas las páginas (50 por página, máx. 20) y agrupa por vuelo. |

### 3.3 Cambios mínimos en código de otros (a revisar)
* **F1 `CarritoPage.jsx`** (1 línea): compara el código `saldo_insuficiente` sin importar mayúsculas para refrescar el saldo. Su prueba usa `getAllByRole` (hay dos enlaces "Buscar vuelos").
* **F1 `TarjetaDialog.jsx`** (1 línea): al editar, el número y el código arrancan vacíos (el backend solo devuelve los últimos 4).
* **F2 `busqueda/pages/DetalleVueloPage.jsx`**: el botón deshabilitado "próximamente" ahora es un enlace a `/comprar/{id}` ("Reservar o comprar") para clientes si el vuelo está `programado`; si no, un aviso. Su prueba se ajustó. Es el punto de entrada a la compra.
* **`utils/format.js`**: se conservan los formateadores de fecha de F2 (Sprint 1 final) y se añaden `formatDateOnly`, `formatRemaining`, `maskCard` que usa F1.
* **Roles (HU24):** se mantienen borrados `RolesPage`, `RolesMatrix` y sus pruebas, y `usuarios/api.js` sin `getRoles/updateRoles`.
* `components/travel/index.js`, `styles/components.css`: se unieron ambos lados.
* `features/vuelos`: se mantiene lo **real de F2** (Sprint 1) y se le suman, sin tocar sus páginas, las pantallas de F1 de editar, cancelar y realizados (§3.4).

### 3.4 Noticias y administración de vuelos (pantallas de F1, ahora con backend)
* **`features/noticias`**: copiado tal cual de F1 y registrado en `features/index.js` (`api.js` no necesitó traducción: el backend responde con la forma que F1 pidió). Se añadió `api.test.js`.
* **`features/vuelos`** (módulo de F2): se **sumaron** `pages/EditarVueloPage`, `CancelarVueloPage`, `VuelosRealizadosPage`, `components/VuelosTabla`, `rules.js` y sus pruebas
  (`GestionVuelos.test.jsx`, `rules.test.js`), más las rutas en `index.js` (las estáticas antes de `/:id`).
  * `api.js` (de F2) sumó `editarVuelo`, `cancelarVuelo`, `listarVuelosRealizados`, `obtenerVuelo`, `listarCiudades` y `adaptarVueloAdmin` (traduce `salida_utc/costo/origen.nombre` a la forma de las pantallas de F1); pruebas en `api.test.js`.
  * `VuelosAdminPage.jsx` y `VuelosTable.jsx` (de F2): solo se añadió el enlace **Vuelos realizados** y los botones **Editar** y **Cancelar** en los vuelos programados.
  * `rules.js`: la edición usa **hora de Colombia** (como HU18), no la del aeropuerto de origen; el texto del campo dice «Hora de Colombia».
  * `vuelos.css`: estilos de F1 añadidos al final; los de formulario van acotados con `.vu-gestion` para no cambiar el formulario de programar de F2.
* **Descartado de F1 (F2 ya tiene lo real):** su `VuelosAdminPage`, `ConsultarVueloPage`, `ProgramarVueloPage`, su `api.js` de vuelos y la prueba `VuelosAdmin.test.jsx` (lista/consulta/programar). De esa prueba se conservaron los casos de editar, cancelar y realizados.
* `features.test.js`: el menú del administrador ahora incluye `/noticias`.

## 4. Sin cambios de más
Ya **no hay carpeta de pendientes**: todo lo de F1 que tenía backend faltante se implementó. Las fotos de prueba de `backend/static/perfiles/` se conservan como venían en el zip de B1.

## 5. Para el resto del equipo
* **B2:** revisar §2.1 y §2.2 (código nuevo en su módulo). Quedan fuera del plan de este sprint y **sin hacer**: subir una **imagen alusiva** a la noticia (`imagen_url` sale `null`),
  **promociones** (`tipo: "promocion"`), editar el `estado` a mano (el plan lo lista en B2-12, pero HU12 solo permite fecha, hora, ruta, duración y costo) y las tablas `mensaje` / `respuesta` (Iteración 3–4).
* **F1/F2:** si cambia la respuesta de compras solo se toca `compra/api.js`; la de vuelos, `vuelos/api.js`.
* **Preexistente (no es de esta integración):** `scripts/e2e-flows.py`, sección [4] "Registro", falla porque "Lugar de nacimiento" ahora es un `<select>`.
  El `README` del Sprint 1 final enlazaba `Plan_Sprint_1.md` y `CAMBIOS_INTEGRACION.md`, que ya no vienen en ese zip; se quitaron los enlaces.

## 6. Verificación

| Qué | Resultado |
|---|---|
| Backend pytest | **303** pasan |
| Frontend Vitest | **386** pasan |
| ESLint · `vite build` | sin errores |
| Navegador real (Playwright) contra PostgreSQL 16 + API + Vite | **10/10 pasos de compra**: login, agregar saldo, tarjeta (enmascarada), carrito, compra, historial, cancelar con reintegro, reservar, pagar reserva y error de documento duplicado marcado en el campo |
| Navegador real: administración y noticias | **12/12 pasos**: editar vuelo (hora de Colombia, error de destino), noticia con el dato editado, suscripción, enlace de la noticia a comprar, edición bloqueada con tiquetes, cancelar exige causa, cancelar reintegra la billetera, la noticia desaparece y vuelos realizados con estado automático |
| Migración `009` | `upgrade head` sobre PostgreSQL con datos |

## 7. Cómo correrlo
```powershell
docker compose up -d
cd backend
alembic upgrade head
python -m app.modules.vuelos.seeds
uvicorn app.main:app --reload
# otra terminal
cd frontend
npm ci
npm run dev        # http://localhost:5173
```
Correos en Mailpit: http://localhost:8025.
