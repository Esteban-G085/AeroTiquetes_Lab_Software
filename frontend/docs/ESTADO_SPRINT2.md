# Estado del Sprint 2 — Frontend (F1 + F2)

> **Actualización tras la integración:** la parte de compra, reserva, historial y billetera **ya se ejecutó y se probó** contra el backend real de B1
> (Vitest 401/401, ESLint limpio, `vite build`, recorrido en navegador sobre PostgreSQL). La tabla "Lo que se verificó" de abajo es la del entregable
> original, escrita sin internet; se conserva como historia. Noticias y la administración de vuelos (editar, cancelar, realizados) también quedaron conectadas: el backend se implementó en la integración (`CONTRATO_ADMIN_VUELOS_NOTICIAS.md`).

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

**Administración de vuelos (HU12–HU14)**
- [x] Editar: fecha, hora, origen, destino, duración y costo; se bloquea si el vuelo sucedió, está realizado/cancelado o tiene tiquetes vendidos.
- [x] Cancelar: confirmación, causa de fuerza mayor obligatoria con tiquetes vendidos; un vuelo realizado o sucedido no se cancela.
- [x] Realizados: total, nacionales/internacionales, búsqueda por código y filtros por estado y tipo.

**Definición de terminado común**
- [ ] CI en verde (Vitest) — ⏳ ejecutar.
- [ ] Probado en web y móvil **contra la API real** — ⏳ servicios apagados para la revisión; los endpoints ya existen.
- [x] Sin mocks en lo entregado (no hay MSW ni servidor simulado) · sin contraseñas ni tokens en logs ni en el repositorio.
- [ ] Endpoints en Swagger y Postman — corresponde a B1/B2; el contrato está en `CONTRATO_SPRINT2.md`.
- [ ] Flujo end-to-end (registro → login → buscar → reservar/comprar → pagar → historial → cancelar) — ⏳ pendiente: servicios apagados para la revisión.

## ⏳ Pendiente cuando se enciendan los servicios
- [ ] Aplicar las migraciones nuevas sobre PostgreSQL: `cd backend && alembic upgrade head` (incluye `014_sillas_texto`, `015_bandeja_salida` y `016_movimientos_billetera`). Las pruebas usan SQLite/`create_all`, así que **no** las ejecutan.
- [ ] Verificación E2E con API real, PostgreSQL real y SMTP real (Mailpit): registro → login → buscar → reservar/comprar con sillas → pagar → historial → cancelar/reintegro → correos con reintentos.
- [ ] Confirmar en navegador la edición/cancelación de vuelos y la paginación de noticias contra la API real.

## Decisiones tomadas (informar al PO)
| Tema | Decisión | Motivo |
|---|---|---|
| Edición de vuelo | Se editan fecha, hora, origen, destino, duración y costo (plan nuevo); **no se envía `estado`** | El plan lo pide; el mockup/SRS RF09 solo permiten fecha, hora y costo → pregunta 5 |
| «Pagar reserva» | Botón en el historial → `POST /reservas/{id}/pagar` | Sin él, la regla de no tener compra y reserva del mismo vuelo obliga a cancelar la reserva → pregunta 8 |
| Saldo | Solo «Agregar saldo» en la billetera | Decisión: solo recargas (RF02); se retiró «Establecer saldo» por riesgo de fraude (RF03) → preguntas 1 y 2 |
| Silla | Se elige en el mapa; `numero_silla` es texto | Se mantuvo y arregló la selección: `Asiento` es la fuente de verdad |
| Impuestos y cargos | No se muestran | El SRS fija un costo único por persona |
| Billetera en el menú | En el menú de cuenta | Mantiene la barra principal corta |
| Un ítem del carrito | Un vuelo (un tramo) | Cada tramo se cancela y se consulta por separado |
| Clase | Una por compra (todos los viajeros) | El SRS la pide «durante el proceso»; el precio no cambia con la clase |
| Lista de vuelos del administrador | Se reemplazó el stub `VuelosAdminPage` | Es el punto de entrada a editar y cancelar; ver `features/README.md` si F2 ya tiene la suya |

## Pendiente / riesgos
* **Probar contra B1/B2 reales** y ajustar el `api.js` del módulo si cambia algún nombre.
* **Búsqueda real y programar vuelo** (Sprint 1, F2) siguen siendo stubs en este zip.
* Correo SMTP real, PDF y tareas de expiración (reservas, noticias): backend.
* `audit-ui.py` y `e2e-flows.py` no incluyen las pantallas nuevas.
