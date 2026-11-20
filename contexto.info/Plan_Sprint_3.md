# Plan del Sprint 3 — Iteración 3

**Proyecto:** AeroTiquetes — Sistema de gestión de compra y reserva de tiquetes aéreos en línea  
**Equipo:** 2 Backend (B1, B2) · 2 Frontend (F1, F2)  
**Stack:** React + Vite + Bootstrap · Python + FastAPI + SQLAlchemy + Alembic · PostgreSQL · generación de PDF con `reportlab` o `fpdf2`  
**Fuentes:** `Historias de Usuario_1.docx` (23/09/2026), `Plan_Sprint_1.md`, `Plan_Sprint_2.md`, SRS IEEE 830, `Requerimientos Lab Soft.md` y los contratos de `frontend/docs/`  
**Estado:** aprobado en sesión de planificación. Las decisiones abiertas quedan cerradas en la sección 5.

---

## 1. Objetivo del sprint

Dejar funcionando de punta a punta, con **API real, PostgreSQL real y correo SMTP real**, el ciclo posterior a la compra de un tiquete:

- El cliente o un visitante realiza el **check-in** y obtiene el **pasabordo en PDF**.
- El cliente **consulta su tiquete**, ve el **mapa de asientos** y cambia su silla **una sola vez, antes del check-in**.
- El administrador **aplica promociones** y **gestiona cancelaciones de vuelo** con decisión individual por pasajero: **reubicación o reintegro**.
- El cliente **publica mensajes** y **consulta las respuestas** de los administradores.

> Nota: el check-in **no está implementado actualmente**. Sprint 2 dejó la base (tiquete con silla asignada al azar, tabla `asiento`, detalle de tiquete, autocompletado de viajero), pero no hay rutas, modelos, migraciones ni pantallas de check-in/pasabordo. Toda esa funcionalidad es nueva en este sprint.

**Demo de cierre (flujo que debe poder mostrarse y debe ser 100 % funcional):**

1. El administrador aplica una promoción a un vuelo programado; la búsqueda y el detalle muestran el precio efectivo con descuento.
2. Un cliente compra, abre el detalle de su tiquete, consulta el mapa y cambia su silla una vez.
3. El cliente hace check-in dentro de la ventana permitida; recibe el pasabordo por correo y puede descargarlo en PDF.
4. Un visitante hace check-in rápido con código de reserva + documento y elige silla reutilizando el mismo mapa.
5. El administrador cancela un vuelo con tiquetes vendidos; ve la lista de pasajeros afectados, reubica a uno en un vuelo alternativo y reintegra a otro.
6. El cliente publica un mensaje y ve la respuesta con el nombre del administrador que respondió.

---

## 2. Alcance: historias de la Iteración 3

La lista del documento de historias tiene **13 marcas `(3)`**, que corresponden a **11 fichas detalladas**: los tres ítems «Seleccionar silla», «Cambiar silla» y «Consultar mapa de asientos» se unifican en la HU37.

| HU | Nombre | Rol | Prioridad | Responsable en el doc | Módulo |
|----|--------|-----|-----------|-----------------------|--------|
| 25 | Aplicar promoción | Administrador | Media | Desarrollador 4 | Vuelos |
| 26 | Gestionar cancelación de vuelo | Administrador | Alta | Desarrollador 4 | Vuelos + compras |
| 27 | Reubicar pasajero | Administrador | Alta | Desarrollador 4 | Compras |
| 28 | Reintegrar dinero | Administrador | Alta | Desarrollador 4 | Financiero |
| 32 | Publicar mensaje a administradores | Cliente | Media | Desarrollador 4 | Mensajería |
| 33 | Consultar mensajes y respuestas (cliente) | Cliente | Media | Desarrollador 4 | Mensajería |
| 34 | Realizar check-in | Cliente | Alta | Desarrollador 4 | Check-in |
| 35 | Realizar check-in rápido | Visitante | Alta | Desarrollador 3 | Check-in |
| 36 | Consultar tiquete | Cliente | Media | Desarrollador 3 | Compras |
| 37 | Consultar mapa de asientos y seleccionar/cambiar silla | Cliente | Media | **Vacío → B1/F1** | Asientos |
| 38 | Seleccionar silla durante el check-in rápido | Visitante | Media | Desarrollador 3 | Asientos + check-in |

**Equivalencia con la lista marcada con `(3)`:**

| Ítems de la lista | HU |
|---|---|
| Publicar mensaje a administradores | HU32 |
| Consultar mensajes (y respuestas) | HU33 |
| Realizar check-in | HU34 |
| Realizar check-in rápido | HU35 |
| Consultar tiquete | HU36 |
| Seleccionar silla · Cambiar silla · Consultar mapa de asientos | HU37 |
| Seleccionar silla durante el check-in rápido | HU38 |
| Aplicar promoción | HU25 |
| Gestionar cancelación de vuelo | HU26 |
| Reubicar pasajero | HU27 |
| Reintegrar dinero | HU28 |

> **HU24 «Gestionar roles» queda explícitamente fuera**, según instrucción del equipo. Tampoco se tocan las HU39–HU46, que pertenecen a la Iteración 4.

---

## 3. Reparto del equipo

El documento de historias reparte entre «Desarrollador 3» y «Desarrollador 4», pero el equipo real del proyecto es 2 backend + 2 frontend. Se mantiene el esquema de los sprints anteriores:

| Persona | Rol | Módulo principal | HU |
|---------|-----|------------------|----|
| **B1** | Backend | Tiquetes, asientos, check-in, reubicación y reintegro | 27, 28, 34, 35, 36, 37, 38 |
| **B2** | Backend | Vuelos, promociones, cancelación y mensajería | 25, 26, 32, 33 |
| **F1** | Frontend | Cliente y visitante: tiquete, mapa, check-in, mensajes | 32, 33, 34, 35, 36, 37, 38 |
| **F2** | Frontend | Panel administrativo: promoción y cancelación | 25, 26, 27, 28 |

**Parejas de trabajo:**

- **B1 ↔ F1:** experiencia del pasajero. Dueños del contrato de check-in, sillas y tiquete.
- **B2 ↔ F2:** panel del administrador. Dueños del contrato de promociones, cancelación y mensajería.

**Acoplamiento crítico:** HU26 ↔ HU27/HU28. B2 cancela el vuelo y publica la lista de afectados; B1 ejecuta la decisión por tiquete.

---

## 4. Mapa de módulos (SRS)

| Módulo (SRS) | Qué incluye en este sprint | Back | Front |
|--------------|----------------------------|------|-------|
| **Check-in y pasabordo** | Validación de ventana, check-in con sesión, check-in rápido, PDF y envío por correo | B1 | F1 |
| **Asientos** | Mapa interactivo, cinco estados visuales, cambio único de silla | B1 | F1 |
| **Cancelación y continuidad del viaje** | Afectados por vuelo cancelado, alternativas, reubicación, reintegro | B1 + B2 | F2 |
| **Promociones** | Descuento porcentual sobre cupos disponibles y precio efectivo | B2 | F2 |
| **Mensajería** | Muro cliente → administradores, consulta de respuestas, respuesta mínima del admin | B2 | F1 + F2 |

**Tablas nuevas:** `promocion`, `pasabordo`.  
**Tablas reutilizadas:** `tiquete`, `viajero`, `asiento`, `billetera`, `movimiento_billetera`, `mensaje`, `respuesta`, `vuelo`, `ciudad`, `compra`, `reserva`.

`mensaje` y `respuesta` ya existen desde la migración `007_noticias`; no requieren migración nueva.

---

## 5. Decisiones confirmadas

| # | Tema | Decisión | Origen |
|---|------|----------|--------|
| D1 | **Silla en la compra/reserva** | Se eliminan `asientos` y `asientos_regreso` del contrato de `POST /reservas` y `POST /compras`. El backend siempre asigna una libre al azar. La elección ocurre después, antes del check-in. | Ya decidida por el equipo en Sprint 2; se ejecuta en este sprint |
| D2 | **Check-in como estado** | No se crea un `EstadoTiquete` nuevo. Se agrega `tiquete.checkin_en`; `estado` sigue siendo `comprado`. Así no se rompen `_estado_de_compra`, el historial ni los reintegros. | Equipo |
| D3 | **Bloqueo posterior al check-in** | Una vez con `checkin_en`, `numero_silla` es inmutable. El payload de check-in permite elegir/confirmar silla, pero no se puede volver a `PATCH`. | Equipo |
| D4 | **Un solo cambio de silla** | Columna `tiquete.cambios_silla` con default 0. La asignación aleatoria inicial **no cuenta**. La reubicación por cancelación de vuelo **tampoco cuenta**: es operación de la aerolínea. | PO confirmado |
| D5 | **Estados del mapa** | BD mantiene `DISPONIBLE / OCUPADO / BLOQUEADO`. La UI muestra `disponible / no disponible / reservada / mía`. «Espacio extra para piernas» es un atributo visual calculado, no un estado de ocupación. | Equipo |
| D6 | **Promociones** | Una promoción activa por vuelo, porcentaje 1–100, vigente hasta `vuelo.salida_utc`. Aplica a económica y primera sobre su tarifa vigente. No modifica `vuelo.costo` ni tiquetes ya vendidos. | PO confirmado |
| D7 | **Cancelación de vuelo** | `PATCH /admin/vuelos/{id}/cancelar` deja de reintegrar automáticamente. Marca los tiquetes con `decision_cancelacion = pendiente` y devuelve la lista de afectados. El reintegro o la reubicación se ejecuta por tiquete. | PO confirmado — modifica comportamiento ya publicado en Sprint 2 |
| D8 | **«Mismo valor» en HU27** | Se compara contra `tiquete.precio` pagado, no contra `vuelo.costo` base. Evita cobrar diferencias cuando hay promoción activa. | PO confirmado |
| D9 | **Respuesta del administrador** | Se anticipa el endpoint mínimo `POST /admin/mensajes/{id}/respuesta` y una acción pequeña en el panel para que HU33 sea demostrable. La bandeja completa (HU41) y la gestión completa de respuestas (HU42) quedan para Iteración 4. | PO confirmado |
| D10 | **Pasabordo** | Tabla `pasabordo` con `anulado_en`. Al reubicar o cancelar un tiquete con check-in, se anula el pasabordo. Si el vuelo nuevo está dentro de la ventana, se hace check-in nuevamente. | Equipo |
| D11 | **Responsable de HU37** | El campo vacío del documento se asigna a **B1/F1**. | PO confirmado |
| D12 | **Cancelación después del check-in** | El cliente no puede cancelar una vez hecho el check-in. El administrador sí puede cancelar el vuelo, anulando el pasabordo y dejando la decisión de reubicación/reintegro al pasajero. | PO confirmado |

---

## 6. Entorno y convenciones técnicas

| Servicio | Puerto / dato | Notas |
|----------|---------------|-------|
| FastAPI (uvicorn) | `127.0.0.1:8001` | Swagger en `/docs`, esquema en `/openapi.json` |
| Vite preview | `5173` | `npm run build` con `VITE_API_URL=http://127.0.0.1:8001` |
| PostgreSQL | `localhost:5432` | Contenedor `aerotiquetes-postgres`, BD `aerotiquetes`, usuario/contraseña `aerotiquetes` |
| SMTP | `smtp.gmail.com:587` | Usuario `smtp.aerolineas@gmail.com`; contraseña **solo** en `backend/.env` |

- Todo lo entregado consume **API real**, **PostgreSQL real** y **correo real**; sin MSW ni mocks.
- `backend/.env` sigue ignorado por Git. No subir credenciales, tokens ni contraseñas.
- Ramas: `feature/HU-34-check-in`, `feature/HU-26-cancelacion-vuelo`, etc. Un PR por tarea, CI en verde antes de mergear.
- Alembic: una sola cadena de revisiones desde `020_geografia_por_pais`. No editar migraciones ya mergeadas; si aparecen dos cabezas, `alembic merge`.
- Fechas y horas: se guardan en UTC y se validan contra `vuelo.salida_utc`.
- Respuesta de error única: `{ "error": { "code", "message", "fields" } }`.

---

## 7. Cambios de datos y migraciones

No se borra ningún dato existente. Se conservan: **4 cuentas, 20 vuelos, 3900 sillas, 23 noticias, 135 departamentos, 135 ciudades de catálogo y 37 ciudades de vuelos**.

| Migración | Cambio |
|-----------|--------|
| `021_promociones` | Tabla `promocion`: `id`, `id_vuelo` (FK CASCADE), `id_administrador` (FK SET NULL), `porcentaje` (1–100), `creada_en`, `activa`. Índice único parcial: una promoción activa por vuelo. |
| `022_checkin_pasabordo` | Columnas nuevas en `tiquete`: `checkin_en` (UTC, nullable), `cambios_silla` (entero, default 0), `decision_cancelacion` (`pendiente / reubicado / reintegrado`, nullable), `pasabordo_id` (FK nullable). Tabla `pasabordo`: `id`, `codigo` único, `id_tiquete` (FK), `generado_en`, `ruta_pdf`, `anulado_en`. Backfill: `cambios_silla = 0`, el resto en `NULL`. |

**Ampliación de esquemas Pydantic:**

- `TiqueteOut`: agrega `checkin_en`, `cambios_silla`, `decision_cancelacion`, `pasabordo` con su estado.
- `AsientoOut`: agrega `espacio_extra` y `estado_visual` calculado (`disponible`, `no_disponible`, `reservada`, `mia`).
- `VueloOut`: ya tiene `precio_efectivo`; se alimenta desde la promoción activa.
- Nuevos esquemas: `PromocionIn/Out`, `CheckInIn`, `CheckInOut`, `CheckInRapidoIn`, `SillaCambioIn`, `MensajeIn/Out`, `RespuestaIn`, `AlternativaOut`, `AfectadoOut`, `PasabordoOut`.

**Nueva dependencia:** agregar `reportlab` o `fpdf2` a `backend/requirements.txt` para generar el PDF del pasabordo.

---

## 8. Tareas por persona

Tamaño relativo: **S** (≤ ½ día) · **M** (1–2 días) · **L** (3+ días). Numeración continua desde el Sprint 2.

### 8.1 Backend 1 (B1) — Tiquetes, sillas, check-in y decisiones de cancelación

| ID | Tarea | HU | Tam. | Depende de |
|----|-------|----|------|------------|
| B1-19 | Cerrar `asientos`/`asientos_regreso` en compras y reservas; migración `022`; modelo `Pasabordo` | 34–38 | M | Sprint 2 |
| B1-20 | `GET /tiquetes/{id}` y ampliación de `TiqueteOut` con `checkin_en`, silla y pasabordo | 36 | S | B1-19 |
| B1-21 | Mapa y cambio de silla: `GET .../asientos`, `PATCH .../silla`, regla de un cambio y bloqueo post check-in | 37 | M | B1-20 |
| B1-22 | Check-in con sesión, generación y envío de pasabordo PDF | 34 | L | B1-21, correo |
| B1-23 | Check-in rápido: validar, mapa y confirmar con código + documento | 35, 38 | L | B1-22 |
| B1-24 | Reubicar y reintegrar por tiquete; refactor de `reintegrar_vuelo_cancelado`; anulación de pasabordo | 27, 28 | L | B2-18, B2-19 |
| B1-25 | Pytest: sillas, check-in, PDF, reubicación, reintegro y no duplicidad | 27–38 | M | continuo |

### 8.2 Backend 2 (B2) — Vuelos, promociones, cancelación y mensajería

| ID | Tarea | HU | Tam. | Depende de |
|----|-------|----|------|------------|
| B2-17 | Migración `021`, modelo `Promocion`, endpoints aplicar/desactivar y precio efectivo | 25 | M | Sprint 2 |
| B2-18 | Ajustar cancelación de vuelo: afectados con decisión pendiente, sin auto-reintegro | 26 | M | B1-24 |
| B2-19 | `GET /admin/vuelos/{id}/alternativas`: mismo destino, mismo precio pagado, cupo y salida futura | 27 | M | B2-17 |
| B2-20 | Servicio y rutas de mensajería, incluida respuesta mínima del admin | 32, 33 | M | D9 |
| B2-21 | Pytest: promociones, cancelación, alternativas y mensajería | 25, 26, 32, 33 | M | continuo |

### 8.3 Frontend 1 (F1) — Cliente y visitante

| ID | Tarea | HU | Tam. | Depende de |
|----|-------|----|------|------------|
| F1-17 | Publicar mensaje y consultar propios mensajes con respuesta y administrador | 32, 33 | M | B2-20 |
| F1-18 | Ruta `/tiquetes/:id` y ampliación del modal de detalle | 36 | S | B1-20 |
| F1-19 | Componente reutilizable `MapaAsientos` con los cinco estados visuales | 37, 38 | L | B1-21 |
| F1-20 | Cambio de silla único desde el detalle del tiquete | 37 | M | F1-19 |
| F1-21 | Pantalla de check-in con sesión: ventana, autocompletado, confirmación y descarga PDF | 34 | L | B1-22 |
| F1-22 | Pantalla de check-in rápido para visitante, reutilizando el mapa | 35, 38 | L | B1-23 |
| F1-23 | Vitest y revisión responsive de mensajería, tiquete, mapa y check-in | 32–38 | M | continuo |

### 8.4 Frontend 2 (F2) — Panel administrativo

| ID | Tarea | HU | Tam. | Depende de |
|----|-------|----|------|------------|
| F2-16 | Aplicar/desactivar promoción en el panel de vuelos; mostrar precio efectivo | 25 | M | B2-17 |
| F2-17 | Gestión de cancelación: afectados, alternativas, reubicar y reintegrar | 26–28 | L | B2-18, B2-19 |
| F2-18 | Acción mínima de respuesta a mensaje | 33 | S | D9 |
| F2-19 | Vitest del panel Sprint 3 | 25–28 | M | continuo |

---

## 9. Contrato de API

| Método | Ruta | Acceso | HU | Dueños |
|--------|------|--------|----|--------|
| POST | `/admin/vuelos/{id}/promocion` `{ porcentaje }` | Administrador | 25 | B2 / F2 |
| DELETE | `/admin/vuelos/{id}/promocion` | Administrador | 25 | B2 / F2 |
| PATCH | `/admin/vuelos/{id}/cancelar` **ajustado** | Administrador | 26 | B2 / F2 |
| GET | `/admin/vuelos/{id}/alternativas` | Administrador | 27 | B2 / F2 |
| GET | `/tiquetes/{id}` | Cliente dueño | 36 | B1 / F1 |
| GET | `/tiquetes/{id}/asientos` | Cliente dueño | 37 | B1 / F1 |
| PATCH | `/tiquetes/{id}/silla` `{ asiento_id }` | Cliente dueño | 37 | B1 / F1 |
| POST | `/tiquetes/{id}/check-in` `{ asiento_id? }` | Cliente dueño | 34 | B1 / F1 |
| GET | `/tiquetes/{id}/pasabordo` → `application/pdf` | Cliente dueño | 34 | B1 / F1 |
| POST | `/check-in/rapido/validar` `{ codigo_reserva, documento }` | Público | 35 | B1 / F1 |
| GET | `/check-in/rapido/asientos?codigo_reserva=&documento=` | Público, previa validación | 38 | B1 / F1 |
| POST | `/check-in/rapido/confirmar` `{ codigo_reserva, documento, asiento_id? }` | Público | 35, 38 | B1 / F1 |
| POST | `/admin/tiquetes/{id}/reubicar` `{ id_vuelo }` | Administrador | 27 | B1 / F2 |
| POST | `/admin/tiquetes/{id}/reintegrar` | Administrador | 28 | B1 / F2 |
| POST | `/mensajes` `{ asunto, contenido }` | Cliente | 32 | B2 / F1 |
| GET | `/mensajes/mios` | Cliente | 33 | B2 / F1 |
| POST | `/admin/mensajes/{id}/respuesta` `{ contenido }` | Administrador | 33 | B2 / F2 |

**Endpoints existentes reutilizados o ajustados:**

- `GET /admin/vuelos/{id}/asientos` se mantiene para administración; su servicio se reutiliza en las rutas nuevas.
- `GET /vuelos`, `GET /vuelos/{id}` y el carrito deben mostrar `precio_efectivo` cuando haya promoción activa.
- `GET /mi-historial` debe reflejar `checkin_en` y el estado del pasabordo.
- `PATCH /admin/vuelos/{id}/cancelar` pasa a devolver `{ vuelo, afectados: AfectadoOut[] }` y **no** acredita dinero automáticamente.

---

## 10. Reglas de negocio y criterios de terminado por historia

El criterio oficial de aceptación de todas es *«El Product Owner confirma la historia»*. Para llegar a esa confirmación, cada historia debe cumplir como mínimo:

**HU25 · Aplicar promoción**
- [ ] Porcentaje entero entre 1 y 100.
- [ ] Una sola promoción activa por vuelo; al aplicar otra se desactiva la anterior sin borrarla.
- [ ] Vigente hasta `vuelo.salida_utc`; después de la salida el precio vuelve al normal.
- [ ] Aplica a económica y primera sobre su tarifa vigente.
- [ ] `precio_efectivo` se refleja en búsqueda, detalle de vuelo y carrito.
- [ ] No modifica `vuelo.costo` ni el precio de tiquetes ya vendidos.

**HU26 · Gestionar cancelación de vuelo**
- [ ] Solo se cancelan vuelos `programado` que no hayan salido.
- [ ] Causa prefijada obligatoria si hay tiquetes vendidos (los 6 códigos ya publicados).
- [ ] Se listan los tiquetes afectados con estado de decisión `pendiente`.
- [ ] No hay reintegro automático; el reintegro o la reubicación se decide por tiquete.
- [ ] La pantalla distingue pendientes y resueltos, y bloquea decisiones duplicadas.

**HU27 · Reubicar pasajero**
- [ ] Alternativas con mismo `id_destino`, salida futura, estado `programado` y cupo en la clase del tiquete.
- [ ] Se respeta «mismo valor» contra `tiquete.precio`, no contra `vuelo.costo`.
- [ ] Se conserva el código de reserva y la clase del tiquete.
- [ ] Se libera la silla antigua y se asigna una libre al azar en el vuelo nuevo.
- [ ] Se anula el pasabordo anterior y se envía correo real con el nuevo vuelo.
- [ ] La reubicación no consume el cambio único de silla de HU37.

**HU28 · Reintegrar dinero**
- [ ] Aplica solo a tiquetes comprados, no a reservas.
- [ ] Acredita en la billetera del cliente usando `TipoMovimiento.REINTEGRO` con referencia.
- [ ] Una sola vez por tiquete; marcas `decision_cancelacion = reintegrado`.
- [ ] Actualiza el estado de la compra como corresponde (`pagada`, `parcialmente_cancelada`, `cancelada`).

**HU32 · Publicar mensaje a administradores**
- [ ] Muro asíncrono, no chat en tiempo real.
- [ ] Campos asunto y contenido obligatorios con longitudes definidas.
- [ ] El mensaje queda visible para todos los administradores.
- [ ] Confirmación visible al cliente tras publicar.

**HU33 · Consultar mensajes y respuestas (cliente)**
- [ ] El cliente ve solo sus propios mensajes.
- [ ] Si hay respuesta, muestra contenido, fecha y el administrador que respondió.
- [ ] Si no hay respuesta, el estado «sin respuesta» es claro.
- [ ] La respuesta mínima del administrador queda registrada con `id_administrador`.

**HU34 · Realizar check-in**
- [ ] Solo tiquetes con estado `comprado`; reservas y cancelados se rechazan.
- [ ] Ventana: desde 24 h antes hasta 1 h antes de `vuelo.salida_utc`.
- [ ] Si el viajero es usuario registrado y su documento coincide, se autocompletan sus datos reutilizando la lógica de Sprint 2.
- [ ] Se puede confirmar o elegir silla antes de confirmar; después queda bloqueada.
- [ ] Se genera y envía el pasabordo PDF por correo real y se puede descargar.

**HU35 · Realizar check-in rápido**
- [ ] Sin sesión: valida `codigo_reserva + documento` normalizando espacios, puntos y guiones.
- [ ] Mismas restricciones de ventana y estado de pago que HU34.
- [ ] Muestra el detalle del tiquete y permite llegar al mapa de sillas.
- [ ] Genera y envía el pasabordo PDF al correo del viajero.

**HU36 · Consultar tiquete**
- [ ] Muestra vuelo (código, ruta, salida y llegada), clase, silla y estado.
- [ ] Accesible desde el historial y mediante ruta directa `/tiquetes/:id`.
- [ ] Refleja si ya tiene check-in y si el pasabordo está vigente o anulado.

**HU37 · Mapa de asientos, seleccionar y cambiar silla**
- [ ] 150 sillas en vuelos nacionales y 250 en internacionales.
- [ ] Cinco estados visuales: disponible, no disponible, reservada, mía y espacio extra para piernas.
- [ ] Un único cambio por tiquete, controlado por `cambios_silla`.
- [ ] Solo antes del check-in; después se rechaza con error claro.
- [ ] No se puede elegir silla durante la compra o la reserva.

**HU38 · Seleccionar silla durante check-in rápido**
- [ ] Reutiliza el mismo componente `MapaAsientos` de HU37.
- [ ] Funciona sin sesión, tras validar código de reserva + documento.
- [ ] Aplica las mismas reglas de cambio único y bloqueo posterior al check-in.

**Definición de terminado común**
- [ ] PR revisado y mergeado; CI en verde (Pytest/Vitest).
- [ ] Endpoint visible y probado en `/docs`; contrato actualizado en `frontend/docs/`.
- [ ] Pantalla probada en web y móvil con la **API real** (sin mocks).
- [ ] PostgreSQL real y correo SMTP real.
- [ ] Sin contraseñas ni tokens en logs ni en el repositorio.
- [ ] Datos existentes conservados; `EXT-*` sigue en 0; `/catalogos/ciudades` sigue siendo el catálogo de facturación; `lugar_nacimiento` sigue siendo solo país.

---

## 11. Hitos de sincronización

```text
Etapa 1  Contratos y fundaciones
   B1: B1-19 → B1-20      B2: B2-17 → B2-18 → B2-19
   F1: F1-18 → F1-19      F2: F2-16

   🏁 Hito A: mapa de asientos y detalle de tiquete listos

Etapa 2  Check-in
   B1: B1-21 → B1-22 → B1-23
   F1: F1-20 → F1-21 → F1-22

   🏁 Hito B: check-in con sesión y rápido generando pasabordo real

Etapa 3  Cancelación y mensajería
   B1: B1-24             B2: B2-20
   F1: F1-17             F2: F2-17 → F2-18

   🏁 Hito C: cancelación por pasajero y mensajes con respuesta

Etapa 4  QA cruzado, corrección, ensayo y demo
   Todos: B1-25, B2-21, F1-23, F2-19 + checklist de la sección 10
```

**Bloqueos cruzados a vigilar**

| Quién espera | A quién | Qué |
|--------------|---------|-----|
| B1 (B1-24) | B2 (B2-18, B2-19) | Vuelo cancelado con afectados y lista de alternativas |
| B2 (B2-18) | B1 (B1-24) | Servicio de decisión por tiquete para no auto-reintegrar |
| F1 (F1-19, F1-22) | B1 (B1-21, B1-23) | Contrato del mapa y del check-in rápido |
| F2 (F2-17) | B2 + B1 | Contrato de afectados, alternativas, reubicar y reintegrar |
| Todos | B2 (B2-17) | Precio efectivo disponible antes de probar promociones en el front |

**Rutina sugerida:** daily corto de 10 minutos, PRs pequeños (una tarea = un PR) e integración front-back apenas exista cada endpoint, no al final del sprint.

---

## 12. Verificación y pruebas

**Línea base que debe mantenerse y superarse:**

- Backend: **368/368** tests en verde.
- Frontend: **438/438** tests en verde; `npm run lint` limpio.
- `npm run build` con `VITE_API_URL=http://127.0.0.1:8001`.

**Verificación adicional del sprint:**

1. `/openapi.json` publica todos los endpoints nuevos y el enum de causas de cancelación sigue con los 6 códigos.
2. Levantar servicios reales:
   - `docker start aerotiquetes-postgres`
   - uvicorn en `backend` sobre `127.0.0.1:8001`
   - `npx vite preview --host 0.0.0.0 --port 5173 --strictPort` en `frontend`
3. Demostrar los seis pasos de la sección 1 contra la base real, sin mocks.
4. Verificar que el correo del pasabordo y el correo de reubicación llegan realmente por SMTP.
5. Verificar que no se duplican reintegros ni cambios de silla mediante pruebas de integración y restricciones de BD.
6. Al terminar, apagar servicios y confirmar que los puertos `8001` y `5173` quedan libres y el contenedor `aerotiquetes-postgres` queda detenido.

---

## 13. Fuera de alcance

- **HU24 · Gestionar roles**, por instrucción del equipo.
- **Iteración 4:** HU39 gestionar noticias, HU40 gestionar promociones (CRUD completo), HU41 bandeja de administrador, HU42 respuesta completa de mensajes, HU43–HU46 recomendaciones y chatbot.
- Cambios en la geografía de facturación ya publicada: `/catalogos/ciudades` sigue siendo el catálogo, `/ciudades` devuelve 37, `EXT-*` permanece desactivado y Colombia conserva 32 departamentos.
- Cambios en `lugar_nacimiento`, que sigue siendo solo país.
- Reabrir la selección de silla durante la reserva o la compra.
- Borrado o reprocesamiento de datos reales sin autorización.

---

## 14. Cierre

Con este plan quedan cerradas las 11 historias de la Iteración 3 y las 7 decisiones que estaban abiertas. El siguiente paso es la ejecución por ramas cortas, empezando por el contrato de tiquetes/asientos (B1-19 a B1-21 y F1-18 a F1-20), que desbloquea el check-in y el resto del sprint.
