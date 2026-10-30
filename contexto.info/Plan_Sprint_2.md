# Plan del Sprint 2 — Iteración 2

**Proyecto:** AeroTiquetes — Sistema de gestión de compra y reserva de tiquetes aéreos en línea  
**Equipo:** 2 Backend (B1, B2) · 2 Frontend (F1, F2)  
**Stack:** React + Vite + Bootstrap · Python + FastAPI + SQLAlchemy + Alembic · PostgreSQL  
**Fuentes:** `Requerimientos_Lab_Soft.md` (módulos compra/reserva, gestión financiera, check-in, noticias, recomendación y chatbot), Historias de Usuario del Sprint 1 (base) y SRS IEEE 830.

---

## 1. Objetivo del sprint

Dejar funcionando de punta a punta el **ciclo de compra y reserva de tiquetes** y los módulos complementarios que dependen de él: gestión financiera simulada (billetera y tarjetas), check-in y cambio de silla, noticias de vuelos, recomendación y chatbot de soporte.

**Demo de cierre (flujo que debe poder mostrarse):**

1. Un cliente inicia sesión, busca vuelos y selecciona uno (nacional o internacional).
2. El cliente elige clase, ingresa los datos del viajero (documento, nombres, apellidos, fecha de nacimiento, género, teléfono, correo, contacto) y confirma la reserva/compra.
3. El sistema genera un código de reserva por viajero, lo envía por correo y lo muestra en pantalla.
4. El cliente accede al check-in (rápido con código + documento, o por login) y descarga el pasabordo en PDF.
5. Antes del check-in, el cliente puede cambiar su silla una vez desde el mapa de asientos.
6. El cliente consulta su historial de compras y reservas.
7. El administrador programa un vuelo y este aparece automáticamente en las noticias; los clientes suscritos reciben la notificación.
8. Al iniciar sesión, el cliente ve recomendaciones de vuelos basadas en su historial de búsquedas y compras.
9. El chatbot guía al cliente registrado hacia el flujo de búsqueda y compra.

---

## 2. Alcance: historias de la Iteración 2

| HU | Nombre | Rol | Prioridad | Módulo | Requerimientos que la sustentan |
|----|--------|-----|-----------|--------|---------------------------------|
| 6 | Reservar tiquete | Cliente | Alta | Compra/Reserva | Compra R01–R04, R07, R20, R34; RF01–RF05, RF09, RF16 |
| 7 | Comprar tiquete (billetera simulada) | Cliente | Alta | Compra/Reserva + Financiero | Compra R03, R21–R25, R28–R30, R33; Financiero RF01–RF20; Compra RF07–RF17 |
| 8 | Cancelar reserva o compra | Cliente | Media | Compra/Reserva | Compra R31–R34; RF15–RF16 |
| 9 | Historial de compras y reservas | Cliente | Media | Compra/Reserva | Compra R35–R36; RF17 |
| 10 | Check-in (rápido y por login) | Cliente | Alta | Check-in | Check-in RF01–RF13 |
| 11 | Cambio de silla | Cliente | Media | Check-in | Check-in RF04–RF09, RF13–RF14 |
| 12 | Noticias de vuelos | Cliente, Administrador | Media | Noticias | Noticias RF01–RF16 |
| 13 | Recomendación de vuelos | Cliente | Media | Recomendación | Recomendación RF01–RF07 |
| 14 | Chatbot de soporte | Cliente (registrado) | Media | Chatbot | Chatbot RF01–RF05 |

> **Nota:** las HU 1–5 y 18–24 del Sprint 1 se mantienen vigentes (login, perfil, registro, vuelos, búsqueda, administradores, roles). El Sprint 2 las reusa como base (un cliente debe estar registrado y autenticado para comprar/reservar).

---

## 3. Reparto del equipo

| Persona | Rol | Módulo principal | HU |
|---------|-----|------------------|----|
| **B1** | Backend | Usuarios, seguridad y compra/reserva | 6, 7, 8, 9 + JWT/perfil existente |
| **B2** | Backend | Vuelos, check-in, noticias, recomendación, chatbot | 10, 11, 12, 13, 14 + servicio de correo/PDF |
| **F1** | Frontend | Compra, reserva, perfil, carrito, historial | 6, 7, 8, 9 + F1 existente |
| **F2** | Frontend | Check-in, noticias, recomendación, chatbot | 10, 11, 12, 13, 14 + F2 existente |

**Parejas de trabajo:** B1 ↔ F1 (compra/reserva y perfil) y B2 ↔ F2 (check-in, noticias, recomendación y chatbot).

---

## 4. Mapa de módulos (SRS)

| Módulo (SRS) | Qué incluye en este sprint | Back | Front |
|--------------|----------------------------|------|-------|
| **Compra y reserva** | Reservar, comprar, cancelar, historial, código de reserva, datos del viajero | B1 | F1 |
| **Gestión financiera** | Billetera virtual, tarjetas (crédito/débito), pago simulado, reintegros | B1 | F1 |
| **Check-in y silla** | Check-in rápido, check-in por login, pasabordo PDF, mapa de asientos, cambio de silla | B2 | F2 |
| **Noticias** | Noticia automática al programar vuelo, suscripción, notificaciones por correo | B2 | F2 |
| **Recomendación** | Recomendaciones por historial de búsquedas y compras | B2 | F2 |
| **Chatbot** | Chat de soporte para clientes registrados, guía hacia compra/búsqueda | B2 | F2 |

Tablas nuevas esperadas: `reserva`, `compra`, `tiquete`, `viajero`, `silla`, `pasabordo`, `billetera`, `tarjeta`, `promocion`, `noticia`, `mensaje`, `respuesta` (mensaje admin).

---

## 5. Tareas por persona

Tamaño relativo: **S** (≤ ½ día) · **M** (1–2 días) · **L** (3+ días).

### 5.1 Backend 1 (B1) — Compra, reserva y financiero

| ID | Tarea | HU | Tam. | Depende de |
|----|-------|----|------|------------|
| B1-11 | Modelo y migración: `reserva`, `compra`, `tiquete`, `viajero`, `billetera`, `tarjeta` | 6, 7, 9 | M | Sprint 1 (usuario, vuelo) |
| B1-12 | `POST /reservas` — crear reserva (24 h de vigencia, cupo temporal, datos del viajero) | 6 | L | B1-11 |
| B1-13 | `POST /compras` — comprar tiquete: carrito con tiquetes de distintos vuelos, pago simulado con billetera, código de reserva por viajero, asignación aleatoria de silla | 7 | L | B1-12, B2-11 |
| B1-14 | `POST /compras/{id}/cancelar` y `POST /reservas/{id}/cancelar` — reglas de vencimiento y reintegro | 8 | M | B1-12, B1-13 |
| B1-15 | `GET /mi-historial` — compras y reservas (activas y canceladas) | 9 | S | B1-12, B1-13 |
| B1-16 | Servicio de correo para códigos de reserva y reintegros (SMTP real / Mailpit) | 6, 7, 8 | M | Sprint 1 (email.py) |
| B1-17 | Pytest: reservas, compras, cancelaciones, billetera, códigos de reserva | 6–9 | M | continuo |

### 5.2 Backend 2 (B2) — Check-in, noticias, recomendación, chatbot

| ID | Tarea | HU | Tam. | Depende de |
|----|-------|----|------|------------|
| B2-11 | Modelo y migración: `silla`, `pasabordo`, `promocion`, `noticia`, `mensaje`, `respuesta` | 10, 11, 12 | M | Sprint 1 (vuelo, usuario) |
| B2-12 | Check-in rápido (código de reserva + documento) y check-in por login; generación de pasabordo PDF | 10 | L | B2-11, B1-13 |
| B2-13 | Mapa de asientos y cambio de silla (una vez, antes del check-in; bloqueo tras check-in) | 11 | L | B2-11, B1-13 |
| B2-14 | Noticia automática al programar vuelo (imagen alusiva, origen, destino, fecha, precio); suscripción y notificaciones por correo | 12 | M | Sprint 1 (vuelo, usuarios) |
| B2-15 | Recomendación de vuelos por historial de búsquedas y compras (peso 50/50, solo rutas con vuelo activo) | 13 | M | B2-08 (búsqueda), B1-13 (compras) |
| B2-16 | Chatbot para clientes registrados: guía hacia búsqueda/compra, valida rutas permitidas | 14 | M | Sprint 1 (auth), B2-08 |
| B2-17 | Pytest: check-in, cambio de silla, noticias, recomendación, chatbot | 10–14 | M | continuo |

### 5.3 Frontend 1 (F1) — Compra, reserva y perfil

| ID | Tarea | HU | Tam. | Depende de |
|----|-------|----|------|------------|
| F1-11 | Formulario de reserva/compra: selección de vuelo, clase, datos del viajero (documento, nombres, apellidos, fecha nacimiento, género, teléfono, correo, contacto) | 6, 7 | L | F1-04, B1-12 |
| F1-12 | Carrito de compras (tiquetes de distintos vuelos) y pago con billetera simulada | 7 | L | F1-11, B1-13 |
| F1-13 | Cancelar reserva/compra con confirmación y reintegro | 8 | M | F1-12, B1-14 |
| F1-14 | Pantalla de historial de compras y reservas | 9 | M | F1-12, B1-15 |
| F1-15 | Vitest: formularios de reserva/compra, carrito, historial | 6–9 | M | continuo |

### 5.4 Frontend 2 (F2) — Check-in, noticias, recomendación, chatbot

| ID | Tarea | HU | Tam. | Depende de |
|----|-------|----|------|------------|
| F2-11 | Check-in rápido (código + documento) y por login; descarga de pasabordo PDF | 10 | L | B2-12 |
| F2-12 | Mapa de asientos interactivo y cambio de silla (una vez, antes del check-in) | 11 | L | B2-13 |
| F2-13 | Pantalla de noticias de vuelos y suscripción | 12 | M | B2-14 |
| F2-14 | Recomendaciones de vuelos tras iniciar sesión | 13 | M | B2-15 |
| F2-15 | Chatbot de soporte para clientes registrados | 14 | M | B2-16 |
| F2-16 | Vitest: check-in, mapa de asientos, noticias, recomendación | 10–13 | M | continuo |

---

## 6. Hitos de sincronización

```
Etapa 1  Fundaciones (en paralelo)
   │      B1: B1-11 → B1-12 → B1-13
   │      B2: B2-11 → B2-12 → B2-13
   │      F1: F1-11 → F1-12          F2: F2-11 → F2-12
   │
   ├─ 🏁 Hito A: reserva y compra de tiquete de punta a punta (B1-13 + F1-12)
   │
Etapa 2  Cancelación, historial y check-in
   │      B1: B1-14, B1-15            B2: B2-12 (check-in ya inició)
   │      F1: F1-13, F1-14            F2: F2-12 (mapa de asientos)
   │
   ├─ 🏁 Hito B: check-in con pasabordo y cambio de silla (B2-12/13 + F2-11/12)
   │
Etapa 3  Noticias, recomendación y chatbot
   │      B1: B1-16, B1-17            B2: B2-14, B2-15, B2-16
   │      F1: F1-15                   F2: F2-13, F2-14, F2-15
   │
   ├─ 🏁 Hito C: noticias y recomendaciones activas (B2-14/15 + F2-13/14)
   │
Etapa 4  Chatbot, QA cruzado, corrección de bugs, ensayo y demo
           Todos: B2-16, F2-16, B1-17, F1-15 + checklist de sección 7
```

---

## 7. Reglas de negocio y criterios de aceptación

**Compra y reserva (HU6–HU9):**
- Reserva vigente máximo 24 h; al vencerse se libera silla, tiquete y cupo.
- Máximo 5 tiquetes por vuelo (compra o reserva) por cliente, evaluado por vuelo.
- Datos obligatorios del viajero: documento, nombres, apellidos, fecha de nacimiento, género, teléfono, correo, nombre y teléfono de contacto.
- No permitir compra y reserva activas simultáneamente para el mismo vuelo.
- No duplicar viajeros dentro de un mismo vuelo.
- Menor de edad no puede ser viajero único (mayoría de edad = 18 años para todos los destinos).
- Trayecto único (Origen → Destino) y trayecto completo (Origen → Destino → Origen).
- Código de reserva individual por viajero, enviado por correo.
- Pago simulado con billetera; verificar saldo suficiente antes de comprar.
- Cancelar compra hasta 1 h antes del vuelo con reintegro; cancelar reserva dentro de las 24 h.

**Check-in y silla (HU10–HU11):**
- Check-in rápido: código de reserva + documento. Check-in por login: autocompletar si el viajero es el comprador.
- Ventana de check-in: desde 24 h antes hasta 1 h antes de la salida.
- Solo sobre tiquetes de compra confirmada (no reservas).
- Pasabordo en PDF enviado por correo al confirmar.
- Cambio de silla: una vez por tiquete, solo antes del check-in, desde mapa interactivo (SVG/Canvas).
- Nacional: 150 sillas (1–25 primera, 26–150 económica). Internacional: 250 (1–50 primera, 51–250 económica).
- Asignación aleatoria de silla solo al comprar (no al reservar).

**Noticias (HU12):**
- Noticia automática al programar vuelo con imagen alusiva, origen, destino, fecha y precio.
- Máximo 8 días publicada si el vuelo no se ejecutó; retirar al realizarse.
- Suscripción y notificaciones por correo a usuarios suscritos.

**Recomendación (HU13):**
- Basada en historial de búsquedas y compras (peso 50/50).
- Solo rutas con vuelo actualmente programado.
- Solo visible para clientes.

**Chatbot (HU14):**
- Solo clientes registrados con sesión.
- Consulta y ofrece vuelos directos entre ciudades permitidas.
- Valida rutas y corrige/informa si la ruta no es válida.
- No ejecuta compras, solo guía hacia el flujo normal.

**Definición de terminado común:**
- PR revisado y mergeado; CI en verde (Pytest/Vitest).
- Endpoint en Swagger y ruta en colección de Postman.
- Pantalla probada en web y móvil.
- Sin contraseñas ni tokens en logs ni en el repositorio.

---

## 8. Fuera de alcance (Iteraciones 3–4)

- Iteración 3: check-in rápido con sesión y rápido, mapa de asientos, cambio de silla, mensajes cliente→admin, promoción, cancelación de vuelo, reubicación, reintegro.
- Iteración 4: gestión de noticias y promociones, bandeja de mensajes, recomendaciones avanzadas, chatbot mejorado.
