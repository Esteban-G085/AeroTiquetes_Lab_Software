# Estado del Sprint 2 — Frontend (F1 + F2)

> **Actualización tras la integración:** la parte de compra, reserva, historial y billetera **ya se ejecutó y se probó** contra el backend real de B1
> (Vitest 413/413, ESLint limpio, `vite build`, recorrido HTTP real sobre PostgreSQL). La tabla "Lo que se verificó" de abajo es la del entregable
> original, escrita sin internet; se conserva como historia. Noticias y la administración de vuelos (editar, cancelar, realizados) también quedaron conectadas: el backend se implementó en la integración (`CONTRATO_ADMIN_VUELOS_NOTICIAS.md`).
> **Cierre adicional (17/11/2026):** borrado lógico de noticias (solo administrador) y Gmail como correo por defecto; ver [verificación final](#-verificación-final-17112026-borrado-de-noticias-y-gmail).
> **Cierre de avisos (18/11/2026):** al publicar una noticia manual también se avisa por correo a los suscriptores; ver [verificación de avisos](#-verificación-de-avisos-de-noticias-18112026).
> **Mapa de sillas (19/11/2026):** selección 3-3 A–F con pasillo, leyenda de ventana/medio/pasillo y tooltips; ver [verificación de sillas](#-verificación-del-mapa-de-sillas-19112026).

Alcance según `Plan_Sprint_2_nuevo.md`: **producción real** (API real, sin mocks), HU 6–14:
compra y reserva (6–9), billetera y tarjetas (10), noticias y suscripción (11), y administración de vuelos: editar (12), cancelar (13) y realizados (14).
Las tareas de backend (B1-11 … B2-16) **no** están en este entregable: el front las consume según **`CONTRATO_SPRINT2.md`** (documento para B1 y B2, con 11 preguntas abiertas).
Fuera de alcance, y por eso **no existen** en el código: check-in y pasabordo (Iteración 3), recomendación y chatbot (Iteración 4). La selección de sillas con mapa sí quedó integrada en compra/reserva.

## ⚠️ Lo que se verificó y lo que NO (leer primero)
Este entregable se armó en un entorno **sin acceso a internet**: no se pudo ejecutar `npm install`, así que **Vitest, ESLint y `vite build` no se corrieron aquí**.

| Verificación | Resultado |
|---|---|
| Todo el código y todas las pruebas se empaquetan con esbuild sin errores de sintaxis, importaciones ni exportaciones inexistentes; sin imports sin usar | ✅ |
| Lógica pura (reglas de compra, validadores de billetera, reglas de administración de vuelos): **34 pruebas** ejecutadas en Node con un ejecutor mínimo | ✅ 34/34 |
| Componentes principales renderizados en Node (viajeros, resumen, historial, confirmaciones, tarjetas, noticias, tabla de vuelos) sin `undefined`/`NaN` | ✅ |
| Pruebas de pantallas (Vitest + Testing Library): **111 pruebas nuevas** en 12 archivos (77 son de pantallas y no se ejecutaron) + 1 ajustada de Sprint 1 (menú del administrador) | ⏳ **escritas, no ejecutadas** |
| `npm run lint`, `npm run build`, `npm run e2e`, `npm run audit:ui` | ⏳ **no ejecutados** |
| Integración con el backend real | ⏳ **no probada** (no hay backend todavía) |

**Antes de mergear:** `npm ci && npm run lint && npm test && npm run build`. Si una prueba de pantalla falla, lo más probable es un nombre accesible de botón o campo
en el selector (no un defecto de la lógica). Luego, probar contra B1/B2 y ampliar `audit-ui.py` y `e2e-flows.py` con las pantallas nuevas (no se modificaron).

## Tareas

| Tarea | Entregable | Dónde | Estado |
|---|---|---|---|
| F1-11 | Formulario de reserva/compra: vuelo, trayecto (solo ida / ida y vuelta), clase, datos de cada viajero | `features/compra` · `/comprar/:vueloId` | ✅ |
| F1-12 | Carrito con tiquetes de distintos vuelos y pago con la billetera | `context/CartContext` · `/carrito` | ✅ |
| F1-13 | Cancelar reserva/compra con confirmación y reintegro | `/mis-viajes` | ✅ |
| F1-14 | Historial de compras y reservas (activas y canceladas), con detalle | `/mis-viajes` | ✅ |
| F1-15 | Billetera: saldo y tarjetas (agregar, editar, eliminar) | `features/financiero` · `/billetera` | ✅ · saldo: preguntas 1 y 2 |
| F1-16 | Vitest: formularios, carrito, historial, billetera | `*.test.js(x)` | ✅ escritas · ⏳ por ejecutar |
| F2-11 | Editar vuelo | `features/vuelos` · `/admin/vuelos/:id/editar` | ✅ · alcance: pregunta 5 |
| F2-12 | Cancelar vuelo (con causa de fuerza mayor si hay tiquetes vendidos) y estado | `/admin/vuelos/:id/cancelar` + lista `/admin/vuelos` | ✅ |
| F2-13 | Listar vuelos realizados | `/admin/vuelos/realizados` | ✅ |
| F2-14 | Noticias de vuelos, suscribirse y cancelar suscripción | `features/noticias` · `/noticias` | ✅ |
| F2-15 | Vitest: vuelos admin, noticias, suscripciones | `*.test.js(x)` | ✅ escritas · ⏳ por ejecutar |

## Demo de cierre (sección 1 del plan) — qué pantalla cubre cada paso
1. **Login, buscar y elegir vuelo** → login ✅ (Sprint 1). ⚠️ *La búsqueda sigue siendo el stub de Sprint 1*: mientras no exista, a la compra se llega desde **Noticias** (cada noticia tiene «Reservar o comprar»). Al integrar la búsqueda real, su detalle de vuelo debe enlazar a `/comprar/<id>`.
2. **Clase, datos del viajero, confirmar** → `/comprar/:id` (reservar sin pagar, o agregar al carrito y pagar).
3. **Código por viajero, correo y pantalla** → confirmaciones de compra y de reserva (el correo real lo envía el backend; el front muestra a qué dirección).
4. **Billetera: saldo y tarjetas** → `/billetera`.
5. **Historial y cancelación con reintegro** → `/mis-viajes`.
6. **Administrador: programar, editar, cancelar y ver realizados** → `/admin/vuelos` (lista), `/editar`, `/cancelar`, `/realizados`. *Programar vuelo* es la pantalla de Sprint 1 (stub en este zip).
7. **Noticia automática, suscripción por correo y cancelación** → `/noticias` (la crea y envía el backend).
8. **Eliminar una noticia** → administrador en `/noticias` o en `/noticias/:id`, botón «Eliminar» + confirmación (borrado lógico, no reaparece).

## Checklist de reglas (sección 7 del plan) en el front

**Compra y reserva (HU6–HU9)**
- [x] Reserva de 24 h: «Vence en…» con cuenta regresiva; una reserva vencida se ve como tal y sin acciones.
- [x] Máximo 5 tiquetes por vuelo y cliente, evaluado por vuelo (descuenta `tiquetes_cliente`).
- [x] Los 9 datos obligatorios del viajero, validados antes de enviar.
- [x] Sin viajeros duplicados en un vuelo · menor de edad no puede ser viajero único (18 años, a la fecha del vuelo).
- [x] Trayecto único y completo (un solo ítem con ida y regreso; un par de tiquetes por viajero).
- [x] Compra y reserva simultáneas del mismo vuelo: al reservar se saca del carrito; el backend impone la regla (`COMPRA_Y_RESERVA`).
- [x] Pago con billetera: se verifica el saldo antes de pagar; si no alcanza, dice cuánto falta y enlaza a la billetera.
- [x] Cancelar compra hasta 1 h antes (reintegro explícito) y reserva dentro de las 24 h; fuera de plazo se explica por qué.

**Gestión financiera (HU10)**
- [x] Consultar saldo (con botón de ocultar) · agregar, editar y eliminar tarjetas de crédito y débito · tarjetas enmascaradas.
- [x] Sin historial de movimientos ni comprobantes (SRS RF19, RF20).
- [ ] Recargar saldo — ⚠️ el plan no define cómo (preguntas 1 y 2 del contrato).

**Noticias (HU11)**
- [x] Imagen (o portada), origen, destino, fecha y precio · suscribirse y cancelar suscripción (cliente) · el administrador las ve pero no se suscribe.
- [x] Eliminar noticia: botón «Eliminar» solo para administrador (listado y detalle), con confirmación. Borrado lógico en el backend (migración `017_noticia_eliminada`); la noticia no reaparece al reprogramar ni en el ciclo de publicación.

**Administración de vuelos (HU12–HU14)**
- [x] Editar: fecha, hora, origen, destino, duración y costo; se bloquea si el vuelo sucedió, está realizado/cancelado o tiene tiquetes vendidos.
- [x] Cancelar: confirmación, causa de fuerza mayor obligatoria con tiquetes vendidos; un vuelo realizado o sucedido no se cancela.
- [x] Realizados: total, nacionales/internacionales, búsqueda por código y filtros por estado y tipo.

**Definición de terminado común**
- [x] Pruebas en verde: backend 347, frontend 425 (46 archivos); `npm run lint` y `npm run build` limpios.
- [ ] Probado en navegador (web y móvil) **contra la API real** — el flujo HTTP real pasó 40/40; falta el recorrido manual en pantalla.
- [x] Sin mocks en lo entregado (no hay MSW ni servidor simulado) · sin contraseñas ni tokens en logs ni en el repositorio.
- [ ] Endpoints en Swagger y Postman — corresponde a B1/B2; el contrato está en `CONTRATO_SPRINT2.md`.
- [x] Flujo end-to-end real (registro → login → buscar → reservar/comprar con sillas → pagar → historial → cancelar con reintegro) — 40/40 comprobaciones con PostgreSQL y Mailpit.

## ✅ Verificación con servicios reales (17/11/2026)
- [x] Migraciones aplicadas sobre PostgreSQL: `cd backend && alembic upgrade head`; `alembic current` devuelve `017_noticia_eliminada (head)`. Confirmado en BD: `tiquete.numero_silla` es `varchar(5)`, existen `notificacion_pendiente` y `movimiento_billetera`, y `noticia.eliminada_en` es `timestamptz` con índice `ix_noticia_eliminada_en`. Las pruebas automatizadas usan SQLite/`create_all`, por eso no las ejecutaban.
- [x] E2E contra API FastAPI + PostgreSQL: **40 comprobaciones, 40 correctas** (con Mailpit en esa ejecución). Recorrido: root → invitar administrador (token leído del correo) → completar registro → programar ida y vuelta → `PUT /admin/vuelos/{id}` rechaza `estado` con 422 → búsqueda con `clase` y `precio_efectivo` → registrar cliente → recarga auditada → reserva `completo` con sillas elegidas en ambos tramos → pagar reserva → historial → cancelar con reintegro y liberación de sillas → noticias paginadas y suscripción → `PATCH .../cancelar`.
- [x] Correos reales verificados: invitación de administrador, código de reserva por tiquete y aviso de reintegro. Con el cierre de Gmail se comprobó además un envío real por `smtp.gmail.com:587`.

## ✅ Verificación final (17/11/2026): borrado de noticias y Gmail
- [x] Backend: **342 pruebas** (`pytest -q`), incluidas las nuevas de borrado lógico, permisos (401/403/404/204), idempotencia, no regeneración y validación de correo.
- [x] Frontend: **413 pruebas / 45 archivos** (`npx vitest run`), `npm run lint` y `npm run build` limpios. El módulo de noticias aporta 36 pruebas.
- [x] API real + PostgreSQL: crear noticia → `DELETE /admin/noticias/{id}` devuelve `204` → desaparece de `GET /noticias` y el detalle da `404` → la fila sigue en BD con `eliminada_en` → sin token `401`, cliente y root `403`, id inexistente `404` → tras esperar el ciclo de 60 s la noticia **no reaparece**. **14/14 comprobaciones reales correctas.**
- [x] Gmail por defecto: arranque de la API con `Correo configurado: smtp.gmail.com:587 (usuario configurado)` y envío SMTP real confirmado (`SMTP_REAL_OK`). Mailpit sigue disponible solo como alternativa explícita para pruebas locales.
- [ ] Recorrido manual en navegador sobre la API real (el `npm run e2e` del repo usa un backend simulado; la verificación de arriba fue HTTP contra la API real). Queda para quien vaya a hacer la demo; servicios ya levantados.

## ✅ Verificación de avisos de noticias (18/11/2026)
- [x] Causa del problema: el aviso solo estaba enganchado al programar vuelos; `POST /admin/noticias` no lo llamaba. Suscribirse nunca envía correo (solo guarda la dirección), igual que no lo hace el alta de administrador: el correo se dispara al **publicar** la noticia.
- [x] Backend **346 pruebas** (4 nuevas): noticia manual con suscriptor → 1 correo con título, contenido y enlace de cancelación; sin suscriptores → 0; noticia eliminada → 0 tanto manual como de vuelo; programar vuelo sigue avisando. Frontend 413, lint y build limpios (no hubo cambios de UI).
- [x] API real + PostgreSQL + Gmail: con `eresteban20@gmail.com` suscrito, `POST /admin/noticias` devolvió `201` y el log confirmó `INFO aerotiquetes.email: Correo enviado a eresteban20@gmail.com (SMTP 587)`. En segundo plano, sin tocar la respuesta ni la UI.
- [x] Las noticias borradas lógicamente no se reenvían: `notificar_suscriptores_de_noticia()` exige `eliminada_en IS NULL` y el gancho de vuelos delega en ella.

## ✅ Verificación del mapa de sillas (19/11/2026)
- [x] Diseño: pasillo entre C y D, bloques 3-3, glifo V/M/P por silla, leyenda de estados y posiciones, tooltip «Silla 1A · Ventana · económica · disponible» y resumen con la posición. El nombre accesible del botón sigue siendo `1A`, para no romper compra/reserva.
- [x] Backend: `generar_asientos` usa A–F; los cupos no cambian (125+25 / 200+50). El front interpreta los vuelos A–E anteriores como 3-2 (A/E ventana, B medio, C/D pasillo) si llegaran a aparecer.
- [x] Base de datos: sin migración de datos. Backup lógico previo, borrado en una transacción de vuelos/tiquetes/noticias de prueba y regeneración de los 20 vuelos semilla. Confirmado en PostgreSQL: 3900 asientos con columnas `A,B,C,D,E,F`, cupos correctos, 19 noticias, 0 correos pendientes, 13 usuarios y la suscripción activa `eresteban20@gmail.com` intactos. La regeneración **no envió correos**.
- [x] Tests: frontend 425/425 (46 archivos, 8 de `AsientoMapa`), backend 347, lint y build limpios. Corrección colateral: el `useEffect` de selección comparaba por referencia y podía entrar en bucle con el array por defecto `[]`; ahora compara por valor.
- [x] API real: `GET /admin/vuelos/{id}/asientos` devuelve columnas `A,B,C,D,E,F` y números `1A…1F`. Front en `localhost:5173` y backend en `127.0.0.1:8001`, ambos 200.

## ✅ Cierre del flujo de sillas (paso extra y revalidación)
- [x] Bug del pasillo corregido: se insertaba antes de C (`indice === 2`), ahora antes de D (`columnasPresentes.indexOf('D')`). Test con el orden exacto `1A 1B 1C |pasillo| 1D 1E 1F` y la cabecera `A B C Pasillo D E F`.
- [x] Visibilidad: cabecera fija de columnas, scroll propio en el mapa, contador «125 sillas · económica · filas 1–N», etiqueta «Pasillo» solo en la cabecera y ajuste responsive para que quepan las 6 columnas en móvil.
- [x] 4 pasos: `PASOS = ['Viajeros', 'Sillas', 'Carrito y pago', 'Confirmación']`. La selección de sillas salió del formulario de viajeros; el carrito usa `current={2}` y la confirmación `current={3}`. El carrito sigue enviando los mismos IDs en `asientos` / `asientos_regreso`: el contrato de la API no cambia.
- [x] Condición de carrera: al entrar al paso de Sillas se recarga la disponibilidad y se descarta cualquier silla tomada; en el carrito se revalida al entrar y otra vez justo antes de pagar, con aviso y enlace «Elegir otras sillas». El backend ya era atómico (`409 asiento_no_disponible` y `UPDATE ... WHERE estado == DISPONIBLE`); ante un 409 el carrito se conserva.
- [x] Corrección colateral: `toast.warning` no existe en `ToastProvider` y podía tumbar el componente al superar el máximo de sillas; ahora se usa `toast.info` y `toast.error`.
- [x] Verificación final: backend **347/347** (test nuevo del caso de carrera con `409 asiento_no_disponible` sin descontar cupos), frontend **425/425**, lint y build limpios. Build sirviendo en `localhost:5173` y API en `127.0.0.1:8001`, ambos 200; la API sigue devolviendo `1A…1F`.

## Decisiones tomadas (informar al PO)
| Tema | Decisión | Motivo |
|---|---|---|
| Edición de vuelo | Se editan fecha, hora, origen, destino, duración y costo (plan nuevo); **no se envía `estado`** | El plan lo pide; el mockup/SRS RF09 solo permiten fecha, hora y costo → pregunta 5 |
| «Pagar reserva» | Botón en el historial → `POST /reservas/{id}/pagar` | Sin él, la regla de no tener compra y reserva del mismo vuelo obliga a cancelar la reserva → pregunta 8 |
| Saldo | Solo «Agregar saldo» en la billetera | Decisión: solo recargas (RF02); se retiró «Establecer saldo» por riesgo de fraude (RF03) → preguntas 1 y 2 |
| Silla | Se elige en el mapa; `numero_silla` es texto | Configuración 3-3 (A–F): A/F ventana, B/E medio, C/D pasillo; `Asiento` sigue siendo la fuente de verdad |
| Impuestos y cargos | No se muestran | El SRS fija un costo único por persona |
| Billetera en el menú | En el menú de cuenta | Mantiene la barra principal corta |
| Un ítem del carrito | Un vuelo (un tramo) | Cada tramo se cancela y se consulta por separado |
| Clase | Una por compra (todos los viajeros) | El SRS la pide «durante el proceso»; el precio no cambia con la clase |
| Lista de vuelos del administrador | Se reemplazó el stub `VuelosAdminPage` | Es el punto de entrada a editar y cancelar; ver `features/README.md` si F2 ya tiene la suya |

## Pendiente / riesgos
* **Probar contra B1/B2 reales** y ajustar el `api.js` del módulo si cambia algún nombre.
* **Búsqueda real y programar vuelo** (Sprint 1, F2) siguen siendo stubs en este zip.
* PDF y tareas de expiración (reservas, noticias): backend. El correo SMTP real por Gmail ya quedó configurado y verificado.
* `audit-ui.py` y `e2e-flows.py` no incluyen las pantallas nuevas.
