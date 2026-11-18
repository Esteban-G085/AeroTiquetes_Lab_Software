# Contrato Frontend (F1/F2) ⇄ Backend (B1/B2) — Sprint 2

> **Nota tras la integración:** este documento es lo que el front **esperaba**. Lo que el backend **implementó** está en
> [`CONTRATO_COMPRAS.md`](./CONTRATO_COMPRAS.md) (B1) y [`CONTRATO_ADMIN_VUELOS_NOTICIAS.md`](./CONTRATO_ADMIN_VUELOS_NOTICIAS.md) (noticias y administración de vuelos).
> Las diferencias las absorben `features/compra/api.js`, `features/financiero/api.js` y `features/vuelos/api.js`.

**Para quién:** B1 (compra, reserva, billetera, tarjetas) y B2 (vuelos de administrador y noticias).
**Qué es:** lo que el frontend ya envía y espera, endpoint por endpoint, con los nombres de campo exactos. El front está construido contra **esta** forma y
contra la **API real** (sin mocks). Si algo del backend va a ser distinto, avisen: cada módulo tiene su propio `api.js` (se indica cuál) y el cambio en el front es pequeño.

Marcas: ✅ está en el plan del Sprint 2 · 🔜 **no está en el plan**; es una propuesta del front que necesita respuesta (ver «Preguntas abiertas», al final).

Convenciones (las mismas de `CONTRATO_USUARIOS.md`): JWT en `Authorization: Bearer`; campos en `snake_case`; fechas ISO 8601; errores
`{ "error": { "code", "message", "fields" } }`. El front muestra `message` tal cual al usuario (en español) y pinta `fields` en el campo del formulario con **el mismo nombre**.
Solo el rol `cliente` puede comprar/reservar/usar billetera (403 para root y administrador, SRS Usuarios RF11 y RF05). Solo `administrador` usa `/admin/*`.

---
## 1. Vuelo (lo usan casi todas las pantallas)
```json
{ "id": 12, "codigo": "AT-204", "tipo": "nacional", "estado": "programado",
  "origen": { "ciudad": "Bogotá", "codigo": "BOG" }, "destino": { "ciudad": "Medellín", "codigo": "MDE" },
  "salida": "2027-03-12T13:15:00Z", "llegada": "2027-03-12T14:10:00Z",
  "salida_zona": "America/Bogota", "llegada_zona": "America/Bogota", "duracion_min": 55,
  "precio": 250000, "moneda": "COP",
  "cupos_disponibles": 40, "tiquetes_cliente": 0, "tiquetes_vendidos": 0 }
```
* `tipo`: `nacional` | `internacional`. `estado`: `programado` | `sucedido` | `realizado` | `cancelado` (SRS Vuelos RF11–RF13).
* `precio` es **por persona y único**, sin distinción de clase (SRS Vuelos RF03). `llegada` ya considera la zona horaria del destino; el front muestra cada hora en la zona de su aeropuerto.
* `tiquetes_cliente` (solo si hay un cliente con sesión): tiquetes **activos** —compra o reserva— que ese cliente ya tiene en este vuelo. `0` en otro caso.
* `tiquetes_vendidos`: total vendido del vuelo (solo para `/admin/*` y la lista de administración).

| Método y ruta | Quién | Respuesta |
|---|---|---|
| ✅ `GET /vuelos/{id}` (Sprint 1) | todos | el vuelo de arriba. 404 si no existe |
| 🔜 `GET /vuelos/{id}/regreso` | cliente | vuelos **directos** `destino → origen` posteriores a la `llegada` del vuelo `{id}` (para elegir la vuelta de un trayecto completo, Compra RF20). Cada uno con `tiquetes_cliente` |
| ✅ `GET /vuelos` (Sprint 1) | administrador | lista (array o `{ "items": [...] }`) con `estado` y `tiquetes_vendidos`. La usa la pantalla «Vuelos programados» |
| 🔜 `GET /ciudades` | administrador | `[ { "codigo": "BOG", "ciudad": "Bogotá" } ]` para los selectores de origen y destino del formulario de edición |

---
## 2. Compra y reserva — B1-11 … B1-15  (`src/features/compra/api.js`)
**Ítem** = un viaje (uno o dos tramos). Un trayecto completo (ida y vuelta) es **un solo ítem** con `vuelo_id` y `vuelo_regreso_id`; genera una sola compra o reserva.
```json
{ "items": [ { "vuelo_id": 12, "clase": "economica",
               "viajeros": [ { "documento": "A12345", "nombres": "Ana María", "apellidos": "Gómez", "fecha_nacimiento": "1990-04-20",
                               "genero": "femenino", "telefono": "3001234567", "correo": "ana@correo.com",
                               "contacto_nombre": "Luis Gómez", "contacto_telefono": "3007654321" } ] } ] }
```
`clase`: `economica` | `primera`. `genero`: `femenino` | `masculino` | `otro` (pregunta 4). `documento`: el front acepta 5–20 caracteres alfanuméricos y guion.

### ✅ POST `/reservas`  (B1-12) → 201
```json
{ "reservas": [ { "id": 5, "vuelo": { …vuelo… }, "clase": "economica", "estado": "activa",
                  "creada_en": "…", "expira_en": "…(creada_en + 24 h)",
                  "tiquetes": [ { "id": 31, "codigo_reserva": "AB12CD", "viajero": { …como se envió… } } ] } ] }
```
Una reserva por ítem. Genera un código de reserva **por viajero** y lo envía por correo (B1-17). Se libera sola a las 24 h (`estado: "vencida"`).

### ✅ POST `/compras`  (B1-13) → 201
Mismo cuerpo. Verifica saldo, descuenta de la billetera (precio × viajeros de cada ítem) y devuelve:
```json
{ "compras": [ { "id": 9, "vuelo": { … }, "clase": "economica", "estado": "confirmada", "total": 500000, "creada_en": "…",
                 "tiquetes": [ { "id": 40, "codigo_reserva": "EF34GH", "viajero": { … } } ] } ],
  "total": 500000, "saldo": 1300000, "correo": "ana@correo.com" }
```
Una compra por ítem. `correo` = dirección a la que se enviaron los códigos. **Atómico:** si un ítem falla, no se cobra nada.
`tiquetes[].numero_silla` es **texto** (`"12A"`). El mapa de selección ya está integrado: se envían IDs de `Asiento` en `asientos` / `asientos_regreso` (uno por viajero y tramo); sin ellos, el backend elige sillas disponibles. Los asientos se generan en configuración **3-3 (A–F)**: A/F ventana, B/E medio, C/D pasillo. El front deriva la posición de `columna`, así que el contrato de la API no cambia.

### Errores de reserva y compra
| Regla del SRS / plan §7 | HTTP | `code` sugerido | Notas |
|---|---|---|---|
| Saldo insuficiente | 409 | **`SALDO_INSUFICIENTE`** | El front vuelve a consultar el saldo al recibir exactamente este `code` |
| Máximo 5 tiquetes por vuelo y cliente (compra o reserva) | 409 | `LIMITE_TIQUETES` | |
| Compra y reserva activas del mismo vuelo | 409 | `COMPRA_Y_RESERVA` | |
| Viajero duplicado dentro del vuelo | 409 | `VIAJERO_DUPLICADO` | `fields: { "viajeros.1.documento": "…" }` |
| Menor de edad sin acompañante mayor de 18 | 422 | `MENOR_SOLO` | |
| Sin cupos | 409 | `CUPO_AGOTADO` | |
| Vuelo ya sucedido, cancelado o realizado | 409 | `VUELO_NO_DISPONIBLE` | |
| Rol distinto de cliente | 403 | `SIN_PERMISO` | |

**Errores por viajero:** la clave es `viajeros.<posición>.<campo>` (posición desde 0 en la lista enviada); el front la pinta en el campo del viajero correcto.

### ✅ GET `/mi-historial`  (B1-15)
`{ "compras": [ … ], "reservas": [ … ] }` — activas **y** canceladas, con la forma de arriba.
* Compra: `estado` = `confirmada` | `realizada` | `cancelada`; si fue cancelada, `reintegro` (monto). Opcional `puede_cancelar` (bool); si no viene, el front lo calcula (hasta 1 h antes de `vuelo.salida`).
* Reserva: `estado` = `activa` | `cancelada` | `vencida`. El front además muestra como «vencida» una `activa` con `expira_en` pasado.

### ✅ POST `/compras/{id}/cancelar`  (B1-14)
Solo hasta **1 h antes** de la salida. Cancela **toda** la compra (todos sus tiquetes) y **reintegra a la billetera** → `{ "reintegro": 250000, "saldo": 900000 }`. Fuera de plazo: 409 `FUERA_DE_PLAZO` con `message` claro. Envía correo del reintegro (B1-17).

### ✅ POST `/reservas/{id}/cancelar`  (B1-14)
Solo dentro de las 24 h de vigencia. Libera cupo y tiquetes. 409 `NO_CANCELABLE` si ya venció.

### 🔜 POST `/reservas/{id}/pagar` → `{ "compra": { … }, "saldo": … }`
Convierte una reserva activa en compra (cobra a la billetera y emite la compra con los mismos códigos). Pregunta 1.

### `GET /me` (Sprint 1)
El botón «Usar mis datos» del primer viajero toma `dni`, `nombres`, `apellidos`, `fecha_nacimiento`, `genero`, `correo` si vienen.

---
## 3. Gestión financiera — B1-16  (`src/features/financiero/api.js`)
La billetera se crea con **saldo 0** al primer acceso del cliente (plan §7). El front nunca muestra un número completo de tarjeta ni su código.

| Método y ruta | Cuerpo | Respuesta | |
|---|---|---|---|
| ✅ `GET /mi-billetera` | — | `{ "saldo": 500000, "moneda": "COP" }` | consultar saldo |
| 🔜 `POST /mi-billetera/saldo/agregar` | `{ "monto": 50000 }` | `{ "saldo": … }` | SRS RF02. **No está en B1-16** (pregunta 1) |
| 🔜 `PUT /mi-billetera/saldo` | `{ "saldo": 0 }` | `{ "saldo": … }` | SRS RF03. **No está en B1-16** (pregunta 2) |
| ✅ `GET /tarjetas` | — | `[ { "id", "tipo", "numero", "titular", "vencimiento" } ]` | consultar |
| ✅ `POST /tarjetas` | `{ "tipo", "numero", "titular", "vencimiento", "codigo" }` | la tarjeta | agregar |
| ✅ `PUT /tarjetas/{id}` | igual (el código se vuelve a enviar) | la tarjeta | editar |
| ✅ `DELETE /tarjetas/{id}` | — | 204/200 | eliminar |

* Las **rutas de tarjetas** no están fijadas en el plan («endpoints de `tarjetas`»): el front usa `/tarjetas` y `/tarjetas/{id}` (pregunta 3).
* `tipo`: `credito` | `debito`. `numero`: solo dígitos, 13–19. `vencimiento`: `MM/AA`, no vencida. `codigo`: 3–4 dígitos.
* `GET /tarjetas` **no debe devolver `codigo`**. Se acepta que el número completo se almacene (SRS Financiero RF10); el front solo muestra `•••• 1234`.
* Sin historial de movimientos ni comprobantes (SRS RF19, RF20): no hay endpoint ni pantalla.
* Errores de validación: `fields` con los nombres `monto`, `saldo`, `tipo`, `numero`, `titular`, `vencimiento`, `codigo`.

---
## 4. Noticias — B2-15  (`src/features/noticias/api.js`)
| Método y ruta | Respuesta |
|---|---|
| ✅ `GET /noticias` | `[ { "id", "tipo": "vuelo" \| "promocion", "titulo"?, "vuelo_id", "origen", "destino", "salida", "salida_zona", "precio", "moneda", "imagen_url"?, "publicada_en", "vigente_hasta", "descuento_pct"?, "precio_original"? } ]` |
| ✅ `GET /noticias/suscripcion` (cliente) | `{ "suscrito": false, "correo": "ana@correo.com" }` (`correo` = el de la cuenta) |
| ✅ `PUT /noticias/suscripcion` (cliente) | cuerpo `{ "correo" }` → `{ "suscrito": true, "correo" }` |
| ✅ `DELETE /noticias/suscripcion` (cliente) | 204/200 — **cancelar suscripción** |

* La noticia de un vuelo la crea el backend **sola** al programarlo y la retira a los 8 días o cuando el vuelo se realiza (Noticias RF05, RF06); el front no filtra nada.
* `imagen_url`: si es `null`, el front dibuja una portada con los códigos de la ruta (pregunta 6). `descuento_pct` y `precio_original` solo se muestran si vienen.
* Los correos a suscritos los envía el backend con SMTP real.
* Cliente y administrador **ven** `/noticias`; solo el cliente se suscribe.

---
## 5. Administración de vuelos — B2-12 … B2-14  (`src/features/vuelos/api.js`)

### ✅ PUT `/admin/vuelos/{id}` — editar vuelo (B2-12)
```json
{ "fecha": "2027-03-15", "hora": "08:15", "origen": "BOG", "destino": "MDE", "duracion_min": 55, "precio": 280000 }
```
* `fecha` y `hora` son **locales del aeropuerto de origen** (zona del origen); `origen`/`destino` son los `codigo` de ciudad. El front manda siempre los seis campos.
* El front **no manda `estado`** (pregunta 5). Devuelve el vuelo actualizado.
* Errores: `fields` con `fecha`, `hora`, `origen`, `destino`, `duracion_min`, `precio` → se pintan en su campo; otros → aviso arriba del formulario.
* Reglas que el front ya anticipa (y el backend debe imponer): solo si **no ha sucedido, no tiene tiquetes vendidos y no está realizado** (HU20 del documento); respuesta 409 con `message` si no se cumple.

### ✅ PATCH `/admin/vuelos/{id}/cancelar` — cancelar vuelo (B2-13)
Cuerpo: `{}` o `{ "motivo": "Cierre del aeropuerto por tormenta" }`.
* Pasa el vuelo a `cancelado` y **libera los cupos**. No se cancela un vuelo `realizado` ni `sucedido` (409).
* Con **tiquetes vendidos** solo se permite si hay **causa de fuerza mayor**: el front exige `motivo` (10–300 caracteres) en ese caso; el backend debe validarlo y responder 422/409 con `fields.motivo` o `message`.
* Qué pasa con los tiquetes ya vendidos (reintegro o reubicación) queda fuera del plan del Sprint 2; pregunta 7.

### ✅ GET `/admin/vuelos/realizados` (B2-14)
Array (o `{ "items": [...] }`) de vuelos con `estado` `sucedido` | `realizado`, con `tiquetes_vendidos` y `tipo`. El paso de «sucedido» a «realizado» es **automático** del backend (HU22); el front solo lista (con total, nacionales/internacionales, búsqueda por código y filtros).

---
## Preguntas abiertas (necesitamos respuesta para cerrar el Sprint)
1. ✅ **B1 — Depositar saldo (resuelto).** Se implementa `POST /mi-billetera/agregar-saldo` (`monto > 0`); la billetera se crea con saldo 0 en el primer acceso. Sin esa recarga un cliente nuevo no podría comprar.
2. ✅ **B1 — «Establecer saldo» (resuelto).** Se eligió **solo recargas**: se retiró `PUT /mi-billetera` y el modo «Establecer saldo» del front para evitar edición libre de saldo (SRS RF03). Todo cambio de saldo queda auditado internamente (recarga, compra o reintegro), sin exponer historial al cliente (RF19/RF20).
3. **B1 — Rutas de tarjetas.** ¿`/tarjetas`, o `/mi-billetera/tarjetas`? El front usa `/tarjetas` (un solo cambio en `financiero/api.js`).
4. **B1 — Enum de `genero`** y regla de `documento` (ver arriba).
5. **B2 — `estado` en la edición.** B2-12 lista `estado` entre los campos editables, pero el documento de HU (HU20) y el SRS RF09 solo permiten editar **fecha, hora y costo**, y solo si el vuelo no ha sucedido ni tiene tiquetes. El front manda los seis campos del plan salvo `estado`, y bloquea el formulario cuando no se puede editar. El estado cambia por acciones propias (cancelar; sucedido/realizado automático). ¿Se confirma? Si el PO decide que solo fecha/hora/costo son editables, se quitan origen, destino y duración del formulario.
6. **B2 — Imagen de las noticias:** ¿URL en `imagen_url` o la genera el front a partir del destino?
7. **B2 — Cancelar vuelo con tiquetes vendidos:** el plan solo dice «cambia el estado y libera cupos». ¿Quién reintegra a los compradores (SRS Vuelos RF18)? ¿Va en la Iteración 3? El front no muestra nada de eso.
8. **B1 — Pagar una reserva** (`POST /reservas/{id}/pagar`): por la regla «no compra y reserva activas del mismo vuelo», sin este endpoint el cliente debe cancelar la reserva y volver a comprar (y perdería sus cupos). El front trae el botón «Pagar reserva» (mockup HU12 «Confirmar reserva»). Si no se implementa, se quita en `HistorialCard.jsx`.
9. **B1/B2 — Vencimiento de reservas** (tarea programada o al consultar). El front ya trata como vencida una reserva `activa` con `expira_en` pasado.
10. **B2 — `GET /vuelos` para el administrador** ¿incluye `estado` y `tiquetes_vendidos`? ¿Devuelve también los cancelados (el front tiene el filtro «Cancelados»)?
11. **B1/B2 — `GET /vuelos/{id}`** debe traer `cupos_disponibles`, `tiquetes_cliente`, `tiquetes_vendidos` y `estado`; y `GET /vuelos/{id}/regreso` y `GET /ciudades` (marcados 🔜) no existen hoy en el plan.

## Fuera del Sprint 2 (no hay nada en el front)
Check-in, pasabordo, sillas, mapa y cambio de silla (Iteración 3); recomendación y chatbot (Iteración 4); mensajes cliente→administrador (`mensaje`, `respuesta`); promociones.
