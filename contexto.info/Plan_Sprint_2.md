# Plan del Sprint 2 — Iteración 2

**Proyecto:** AeroTiquetes — Sistema de gestión de compra y reserva de tiquetes aéreos en línea  
**Equipo:** 2 Backend (B1, B2) · 2 Frontend (F1, F2)  
**Stack:** React + Vite + Bootstrap · Python + FastAPI + SQLAlchemy + Alembic · PostgreSQL  
**Fuentes:** `Requerimientos_Lab_Soft.md` (módulos compra/reserva, gestión financiera, noticias), Historias de Usuario del Sprint 1 (base) y SRS IEEE 830.

---

## 1. Objetivo del sprint

Dejar funcionando de punta a punto, **listo para producción**, el **ciclo de compra y reserva de tiquetes** y los módulos complementarios que dependen de él: gestión financiera real (billetera, saldo y tarjetas), noticias de vuelos con suscripción, y administración de vuelos por parte del administrador (editar, cancelar y vuelos realizados).

Todo lo entregado en este sprint debe consumir la **API real** (sin MSW ni mocks en lo que se entrega), usar **PostgreSQL real** y enviar **correo real** mediante SMTP. No son prototipos ni demostraciones.

**Demo de cierre (flujo que debe poder mostrarse y debe ser 100% funcional):**

1. Un cliente inicia sesión, busca vuelos y selecciona uno (nacional o internacional).
2. El cliente elige clase, ingresa los datos del viajero (documento, nombres, apellidos, fecha de nacimiento, género, teléfono, correo, contacto) y confirma la reserva/compra.
3. El sistema genera un código de reserva por viajero, lo envía por correo real y lo muestra en pantalla.
4. El cliente accede al panel de billetera, consulta su saldo y gestiona sus tarjetas (agregar, editar, eliminar).
5. El cliente consulta su historial de compras y reservas y puede cancelar reserva o compra con reintegro.
6. El administrador programa, edita y cancela vuelos, y consulta el listado de vuelos realizados.
7. Al programar un vuelo se genera automáticamente una noticia; los clientes suscritos la reciben por correo y pueden cancelar su suscripción.

---

## 2. Alcance: historias de la Iteración 2

| HU | Nombre | Rol | Prioridad | Módulo | Requerimientos que la sustentan |
|----|--------|-----|-----------|--------|---------------------------------|
| 6 | Reservar tiquete | Cliente | Alta | Compra/Reserva | Compra R01–R04, R07, R20, R34; RF01–RF05, RF09, RF16 |
| 7 | Comprar tiquete (pago con billetera real) | Cliente | Alta | Compra/Reserva + Financiero | Compra R03, R21–R25, R28–R30, R33; Financiero RF01–RF20; Compra RF07–RF17 |
| 8 | Cancelar reserva o compra | Cliente | Media | Compra/Reserva | Compra R31–R34; RF15–RF16 |
| 9 | Historial de compras y reservas | Cliente | Media | Compra/Reserva | Compra R35–R36; RF17 |
| 10 | Gestionar billetera virtual, saldo y tarjetas | Cliente | Media | Gestión financiera | Financiero RF01–RF20; Compra RF07–RF17 |
| 11 | Noticias de vuelos: consultar, suscribirse, cancelar suscripción | Cliente, Administrador | Media | Noticias | Noticias RF01–RF16 |
| 12 | Editar vuelo | Administrador | Alta | Administración de vuelos | Vuelos R01–R15, R16–R17 |
| 13 | Cancelar vuelo | Administrador | Alta | Administración de vuelos | Vuelos R22–R27 |
| 14 | Gestionar vuelos realizados | Administrador | Media | Administración de vuelos | Vuelos R22–R23 |

> **Nota:** las HU 1–5 y 18–24 del Sprint 1 se mantienen vigentes (login, perfil, registro, vuelos, búsqueda, administradores, roles). El Sprint 2 las reusa como base (un cliente debe estar registrado y autenticado para comprar/reservar).

> **Fuera de este sprint (van a Iteración 3 y 4):** check-in, pasabordo, seleccionar silla, cambiar silla, mapa de asientos, recomendación de vuelos y chatbot.

---

## 3. Reparto del equipo

| Persona | Rol | Módulo principal | HU |
|---------|-----|------------------|----|
| **B1** | Backend | Usuarios, seguridad, compra/reserva y financiero | 6, 7, 8, 9, 10 + JWT/perfil existente |
| **B2** | Backend | Administración de vuelos y noticias | 11, 12, 13, 14 + servicio de correo |
| **F1** | Frontend | Compra, reserva, perfil, carrito, historial, billetera | 6, 7, 8, 9, 10 + F1 existente |
| **F2** | Frontend | Administración de vuelos y noticias | 11, 12, 13, 14 + F2 existente |

**Parejas de trabajo:** B1 ↔ F1 (compra/reserva, perfil y financiero) y B2 ↔ F2 (vuelos de administrador y noticias).

---

## 4. Mapa de módulos (SRS)

| Módulo (SRS) | Qué incluye en este sprint | Back | Front |
|--------------|----------------------------|------|-------|
| **Compra y reserva** | Reservar, comprar, cancelar, historial, código de reserva, datos del viajero, clase, trayecto único/completo | B1 | F1 |
| **Gestión financiera** | Billetera virtual, tarjetas (crédito/débito), saldo, pago real con billetera, reintegros | B1 | F1 |
| **Administración de vuelos** | Editar vuelo, cancelar vuelo, gestionar vuelos realizados | B2 | F2 |
| **Noticias** | Noticia automática al programar vuelo, suscripción, cancelación de suscripción, notificaciones por correo | B2 | F2 |

Tablas nuevas esperadas: `reserva`, `compra`, `tiquete`, `viajero`, `billetera`, `tarjeta`, `noticia`, `suscripcion`, `mensaje`, `respuesta`.  
Tablas dejadas para Iteración 3: `silla`, `pasabordo`.

---

## 5. Tareas por persona

Tamaño relativo: **S** (≤ ½ día) · **M** (1–2 días) · **L** (3+ días).

### 5.1 Backend 1 (B1) — Compra, reserva y financiero

| ID | Tarea | HU | Tam. | Depende de |
|----|-------|----|------|------------|
| B1-11 | Modelo y migración: `reserva`, `compra`, `tiquete`, `viajero`, `billetera`, `tarjeta` | 6, 7, 9, 10 | M | Sprint 1 (usuario, vuelo) |
| B1-12 | `POST /reservas` — crear reserva (24 h de vigencia, cupo temporal, datos del viajero) | 6 | L | B1-11 |
| B1-13 | `POST /compras` — comprar tiquete: carrito con tiquetes de distintos vuelos, pago real con billetera, código de reserva por viajero, asignación aleatoria de silla | 7 | L | B1-12 |
| B1-14 | `POST /compras/{id}/cancelar` y `POST /reservas/{id}/cancelar` — reglas de vencimiento y reintegro real | 8 | M | B1-12, B1-13 |
| B1-15 | `GET /mi-historial` — compras y reservas (activas y canceladas) | 9 | S | B1-12, B1-13 |
| B1-16 | `GET /mi-billetera` (saldo), endpoints de `tarjetas` (agregar, editar, eliminar, consultar) | 10 | M | B1-11 |
| B1-17 | Servicio de correo SMTP real para códigos de reserva y reintegros | 6, 7, 8 | M | Sprint 1 (email.py) |
| B1-18 | Pytest: reservas, compras, cancelaciones, billetera, tarjetas, códigos de reserva | 6–10 | M | continuo |

### 5.2 Backend 2 (B2) — Vuelos de administrador y noticias

| ID | Tarea | HU | Tam. | Depende de |
|----|-------|----|------|------------|
| B2-11 | Modelo y migración: `noticia`, `suscripcion`, `mensaje`, `respuesta` | 11, 12, 13, 14 | M | Sprint 1 (vuelo, usuario) |
| B2-12 | `PUT /admin/vuelos/{id}` — editar vuelo (fecha, hora, origen, destino, duración, costo, estado) | 12 | L | Sprint 1 (vuelo, auth) |
| B2-13 | `PATCH /admin/vuelos/{id}/cancelar` — cancelar vuelo y liberar cupos | 13 | M | B2-12 |
| B2-14 | `GET /admin/vuelos/realizados` — listar y gestionar vuelos realizados | 14 | M | Sprint 1 (vuelo) |
| B2-15 | Noticia automática al programar vuelo; suscripción y **cancelación de suscripción** por correo real | 11 | M | Sprint 1 (vuelo, usuarios) |
| B2-16 | Pytest: editar/cancelar vuelo, vuelos realizados, noticias, suscripciones | 11–14 | M | continuo |

### 5.3 Frontend 1 (F1) — Compra, reserva y billetera

| ID | Tarea | HU | Tam. | Depende de |
|----|-------|----|------|------------|
| F1-11 | Formulario de reserva/compra: selección de vuelo, clase, datos del viajero, trayecto único/completo | 6, 7 | L | F1-04, B1-12 |
| F1-12 | Carrito de compras (tiquetes de distintos vuelos) y pago con billetera real | 7 | L | F1-11, B1-13 |
| F1-13 | Cancelar reserva/compra con confirmación y reintegro | 8 | M | F1-12, B1-14 |
| F1-14 | Pantalla de historial de compras y reservas | 9 | M | F1-12, B1-15 |
| F1-15 | Panel de billetera: ver saldo y gestionar tarjetas (agregar, editar, eliminar) | 10 | M | F1-12, B1-16 |
| F1-16 | Vitest: formularios de reserva/compra, carrito, historial, billetera | 6–10 | M | continuo |

### 5.4 Frontend 2 (F2) — Vuelos de administrador y noticias

| ID | Tarea | HU | Tam. | Depende de |
|----|-------|----|------|------------|
| F2-11 | Pantalla admin: editar vuelo (formulario con todos los campos del vuelo) | 12 | L | B2-12 |
| F2-12 | Pantalla admin: cancelar vuelo y cambiar estado | 13 | M | B2-13 |
| F2-13 | Pantalla admin: listar vuelos realizados | 14 | M | B2-14 |
| F2-14 | Pantalla cliente: noticias de vuelos, suscribirse y cancelar suscripción | 11 | M | B2-15 |
| F2-15 | Vitest: vuelos admin, noticias, suscripciones | 11–14 | M | continuo |

---

## 6. Hitos de sincronización

```
Etapa 1  Fundaciones (en paralelo)
   │      B1: B1-11 → B1-12 → B1-13
   │      B2: B2-11 → B2-12 → B2-13
   │      F1: F1-11 → F1-12          F2: F2-11 → F2-12
   │
   ├─ 🏁 Hito A: reserva y compra de tiquete de punta a punta (B1-13 + F1-12), API real, 100% funcional
   │
Etapa 2  Cancelación, historial, billetera y vuelos de administrador
   │      B1: B1-14, B1-15, B1-16     B2: B2-12, B2-13, B2-14
   │      F1: F1-13, F1-14, F1-15     F2: F2-12, F2-13
   │
   ├─ 🏁 Hito B: cancelación, reintegro, billetera y vuelos admin funcionando con API real
   │
Etapa 3  Noticias y suscripciones
   │      B1: B1-17, B1-18            B2: B2-15, B2-16
   │      F1: F1-16                   F2: F2-14, F2-15
   │
   ├─ 🏁 Hito C: noticias y suscripciones activas con correo real
   │
Etapa 4  QA cruzado, corrección de bugs, ensayo y demo de producción
            Todos: checklist de sección 7
```

---

## 7. Reglas de negocio y criterios de aceptación (100% producción)

**Compra y reserva (HU 6–HU9):**
- Reserva vigente máximo 24 h; al vencerse se libera silla, tiquete y cupo.
- Máximo 5 tiquetes por vuelo (compra o reserva) por cliente, evaluado por vuelo.
- Datos obligatorios del viajero: documento, nombres, apellidos, fecha de nacimiento, género, teléfono, correo, nombre y teléfono de contacto.
- No permitir compra y reserva activas simultáneamente para el mismo vuelo.
- No duplicar viajeros dentro de un mismo vuelo.
- Menor de edad no puede ser viajero único (mayoría de edad = 18 años para todos los destinos).
- Trayecto único (Origen → Destino) y trayecto completo (Origen → Destino → Origen).
- Código de reserva individual por viajero, enviado por correo real.
- Pago con billetera; verificar saldo suficiente antes de comprar.
- Cancelar compra hasta 1 h antes del vuelo con reintegro; cancelar reserva dentro de las 24 h.

**Gestión financiera (HU 10):**
- Billetera se crea con saldo 0 al primer acceso del cliente.
- El cliente puede consultar su saldo en cualquier momento.
- El cliente puede agregar, editar y eliminar tarjetas (crédito/débito).
- Antes de comprar, el sistema verifica que el saldo de la billetera sea suficiente.
- Al cancelar compra con derecho a reintegro, el dinero vuelve a la billetera del cliente.

**Noticias (HU 11):**
- Noticia automática al programar vuelo (imagen alusiva, origen, destino, fecha, precio).
- Máximo 8 días publicada si el vuelo no se ejecutó; retirar al realizarse.
- Suscripción y cancelación de suscripción funcionales con notificaciones por correo real.

**Administración de vuelos (HU 12–HU14):**
- Editar vuelo: modificar fecha, hora, origen, destino, duración, costo y estado.
- Cancelar vuelo: cambia el estado a cancelado y libera los cupos por clase.
- Gestionar vuelos realizados: listado de vuelos con estado `sucedido` o `realizado`.

**Definición de terminado común (requisito para producción):**
- PR revisado y mergeado; CI en verde (Pytest/Vitest).
- Endpoint visible y probado en Swagger (`/docs`); ruta agregada a la colección de Postman.
- Pantalla probada en web y móvil consumiendo la **API real** (MSW desactivado para lo entregado).
- Base de datos PostgreSQL real (no SQLite en memoria).
- Correo real mediante SMTP (no simulado en código).
- Sin contraseñas ni tokens en logs ni en el repositorio.
- Flujo end-to-end funcional: registro → login → buscar → reservar/comprar → pagar con billetera → historial → cancelar.

---

## 8. Fuera de alcance (Iteraciones 3–4)

- Iteración 3: check-in rápido y por login, pasabordo en PDF, mapa de asientos, seleccionar silla, cambiar silla, mensajes cliente → administrador.
- Iteración 4: gestión de promociones, bandeja y respuesta de mensajes del administrador, recomendaciones avanzadas, chatbot.