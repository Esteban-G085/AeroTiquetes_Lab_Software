# Plan del Sprint 1 — Iteración 1

**Proyecto:** AeroTiquetes — Sistema de gestión de compra y reserva de tiquetes aéreos en línea
**Equipo:** 2 Backend (B1, B2) · 2 Frontend (F1, F2)
**Stack:** React + Vite + Bootstrap · Python + FastAPI + SQLAlchemy + Alembic · PostgreSQL (ver `Tecnologias_AeroTiquetes.md`)
**Fuentes:** Historias de Usuario (23/09/2026), Casos de Uso, Diagramas de Clases y ER, Tecnologías, SRS IEEE 830 (rev. 1.0) y `Requerimientos_Lab_Soft.md`

---

## 1. Objetivo del sprint

Dejar funcionando de punta a punta la **base del sistema**: cuentas y acceso para los cuatro roles, administración de usuarios por parte del root, y el ciclo mínimo de vuelos (el administrador programa y consulta vuelos; cualquier visitante o cliente los busca y consulta).

**Demo de cierre (flujo que debe poder mostrarse):**

1. El sistema arranca y crea el **root por defecto**; el root inicia sesión con su Id y crea un administrador (correo + nombre) → el correo llega a **Mailpit**.
2. El administrador abre el enlace, completa su registro (mismos campos que un cliente) e inicia sesión.
3. El administrador programa un vuelo nacional y uno internacional: el sistema genera el **código consecutivo**, la **hora de llegada con zona horaria** y los **cupos por clase**.
4. Un visitante busca vuelos combinando criterios y abre el detalle de uno.
5. El visitante se registra como cliente, inicia sesión, edita su perfil y cambia su contraseña.
6. Root revisa la matriz de roles y accesos.

## 2. Alcance: historias de la Iteración 1

| HU | Nombre | Rol | Prioridad | Casos de uso | Requisitos que la sustentan |
|----|--------|-----|-----------|--------------|-----------------------------|
| 1 | Iniciar sesión | Cliente, Admin, Root | Alta | CU24 | Usuarios R02, R18–R19 · RNF04–RNF06 |
| 2 | Gestionar perfil | Cliente, Admin, Root | Media | CU25 | Usuarios R14 |
| 3 | Cambiar contraseña | Cliente, Admin, Root | Media | CU26 | Usuarios R20 · RNF04 |
| 4 | Registrarse como cliente | Visitante | Alta | CU23 | Usuarios R03–R13 |
| 5 | Buscar y consultar vuelos | Cliente, Visitante | Alta | CU38–CU41 | Búsqueda R01–R15 · RNF01 |
| 18 | Programar vuelo | Administrador | Alta | CU01 | Vuelos R01–R15, R16–R17 |
| 19 | Consultar vuelo | Administrador | Alta | CU04 | Vuelos R03, R10, R22–R23 |
| 23 | Gestionar administradores | Root | Alta | CU27 | Usuarios R17, R21–R22 |
| 24 | Gestionar roles | Root | Media | CU28 | Usuarios R01 · RNF05 |

> **Nota sobre "Responsable":** el documento de historias asigna "desarrollador 1/2/4", pero el equipo real es 2 back + 2 front. Este plan reasigna por capa y por módulo. Conviene actualizar ese campo en las HU.

## 3. Reparto del equipo

| Persona | Rol | Módulo principal | HU |
|---------|-----|------------------|----|
| **B1** | Backend | Usuarios: seguridad, cuentas y administración | 1, 2, 3, 4, 23, 24 |
| **B2** | Backend | Vuelos y búsqueda + infraestructura base | 5, 18, 19 + scaffold FastAPI, Alembic, correo, seeds |
| **F1** | Frontend | Proyecto React, autenticación, cuenta y panel root | 1, 2, 3, 4, 23, 24 |
| **F2** | Frontend | Buscador de vuelos y panel de vuelos del admin | 5, 18, 19 |

**Parejas de trabajo:** B1 ↔ F1 (módulo *Usuarios*) y B2 ↔ F2 (módulos *Vuelos* y *Búsqueda*). Cada pareja es dueña de su parte del contrato de API.

## 4. Mapa de módulos

El SRS (RNF12) exige modularizar el código según los módulos funcionales; el Sprint 1 toca tres de los nueve.

| Módulo (SRS) | Qué incluye en este sprint | Back | Front |
|--------------|----------------------------|------|-------|
| **Base técnica** | Repo, entorno local, migraciones, CORS, errores, correo, CI, mocks | B2 (+ B1) | F1 (+ F2) |
| **Usuarios** | Login, bcrypt, JWT, roles, registro, perfil, contraseña, administradores, matriz de roles | B1 | F1 |
| **Administración de vuelos** | Programar, consultar, listar | B2 | F2 |
| **Búsqueda** | Búsqueda combinada, orden, detalle, historial de búsquedas | B2 | F2 |

---

## 5. Entorno y convenciones técnicas

### 5.1 Entorno local

| Servicio | Puerto sugerido | Notas |
|----------|-----------------|-------|
| FastAPI (uvicorn) | 8000 | Swagger en `/docs`, esquema en `/openapi.json` |
| Vite (React) | 5173 | El backend debe habilitar **CORS** para este origen |
| PostgreSQL | 5432 | Una BD de desarrollo y otra **separada para Pytest** |
| Mailpit | SMTP 1025 · UI 8025 | Solo desarrollo |

Cada app lleva su `.env.example` (nunca el `.env` real en Git): `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRE_MINUTES`, `ROOT_ID`, `ROOT_PASSWORD`, `SMTP_HOST/PORT`, `FRONTEND_URL` en back; `VITE_API_URL`, `VITE_USE_MOCKS` en front.

### 5.2 Estructura sugerida (monorepo en GitHub, organizada por módulo)

```text
aerotiquetes/
├── backend/
│   ├── app/
│   │   ├── core/              # config, seguridad (jwt, bcrypt), db, errores, correo
│   │   ├── modules/
│   │   │   ├── usuarios/      # router · schemas · models · service
│   │   │   ├── vuelos/        # administración de vuelos + catálogo de ciudades
│   │   │   └── busqueda/      # búsqueda de vuelos + historial
│   │   └── main.py
│   ├── alembic/
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── features/          # usuarios/ · vuelos/ · busqueda/
│       ├── components/        # UI reutilizable
│       ├── services/          # instancia de axios
│       ├── context/           # sesión
│       ├── routes/            # rutas protegidas por rol
│       └── mocks/             # MSW
└── README.md
```

### 5.3 Convenciones a fijar el primer día

- **Python:** SQLAlchemy 2.x y Pydantic v2; sesiones **síncronas**; `venv` + `requirements.txt`. Incluir `tzdata` en los requisitos (la librería estándar `zoneinfo` lo necesita en Windows).
- **Respuesta de error única** (la define B2 en `core/` y todos la usan): `{ "error": { "code", "message", "fields" } }`.
- **JWT:** firmado con `JWT_SECRET`; payload con `sub` (id) y `rol`. **Expiración corta (30 min)**, sin refresh token, para cumplir el cierre de sesión por inactividad (RNF06).
- **Fechas y horas:** se guardan en **UTC** (`timestamptz`) y se muestran en la zona horaria de cada ciudad.
- **Roles en FastAPI:** dependencia reutilizable `require_roles("root")`, `require_roles("administrador")`, etc.
- **Ramas y PR:** `feature/HU-05-busqueda-vuelos`; una tarea = un PR pequeño; mínimo una aprobación; la rama principal solo recibe código que pase CI.
- **CI básico (GitHub Actions):** `pytest` en backend y `vitest` en frontend en cada PR.
- **HTTPS (RNF07):** en desarrollo se usa HTTP local; HTTPS se resuelve al desplegar.

### 5.4 Cuidado con Alembic en equipo

Dos personas creando migraciones a la vez generan **dos cabezas** (`multiple heads`). Reglas:

1. B1 publica primero `001_usuarios` y `002_roles` (B2 espera esa rama antes de crear `004_vuelos`, porque `vuelo` tiene FK al administrador que lo programa).
2. B2 publica `003_ciudades`, `004_vuelos` y `005_busquedas` encadenadas después de la `002`.
3. Quien se encuentre con `multiple heads` hace `alembic merge` y avisa al equipo. Nunca editar una migración ya mergeada: crear una nueva.

---

## 6. Etapa 0 — Arranque conjunto (todos, primeros 1–2 días)

- [ ] **Repo y entorno:** crear el repositorio, estructura de carpetas, `.gitignore`, `.env.example`, `README` con pasos para levantar PostgreSQL, Mailpit, backend y frontend. Todos deben poder correr el sistema vacío en su máquina.
- [ ] **Revisar la sección 10:** confirmar entre todos las decisiones tomadas (el PO ya respondió las preguntas abiertas, 10.2) y avisarle las correcciones a mockups de 10.3.
- [ ] **Contrato de API v0:** FastAPI genera OpenAPI desde el código, así que el contrato son los **schemas Pydantic + rutas esqueleto** (tareas B1-00 y B2-00). Con eso publicado, F1 y F2 generan los mocks de MSW.
- [ ] **Modelo de datos v1** (sección 9) acordado entre B1 y B2.
- [ ] **Tokens de diseño** tomados de los mockups (azul/negro, títulos en tipografía mono, formularios) sobre Bootstrap con CSS propio.
- [ ] **Datos semilla acordados:** root por defecto, 1–2 admins de prueba, catálogo de ciudades, ~20 vuelos de ejemplo.

---

## 7. Tareas por persona

> Tamaño relativo: **S** (≤ ½ día) · **M** (1–2 días) · **L** (3+ días). Ajusten a la duración real del sprint.

### 7.1 Backend 1 (B1) — Módulo Usuarios

| ID | Tarea | HU | Tam. | Depende de |
|----|-------|----|------|------------|
| B1-00 | **Contrato Usuarios:** schemas Pydantic y rutas esqueleto (`/auth/*`, `/me`, `/root/*`) que devuelvan datos de ejemplo, para que `/docs` y `/openapi.json` ya existan | 1–4, 23, 24 | S | Etapa 0 |
| B1-01 | Modelos SQLAlchemy y migraciones `001_usuarios` (`usuario`, `root`, `administrador`, `cliente`) y `002_roles` (`rol`, `rol_modulo`). **Creación automática del root por defecto** al arrancar la aplicación si no existe (credenciales desde `.env`) | 1, 23, 24 | M | Etapa 0 |
| B1-02 | **bcrypt** (hash y verificación) + **JWT** con expiración de 30 min + dependencia `get_current_user` | 1 | M | B1-01 |
| B1-03 | **Dependencias de rol** `require_roles(...)` con los 4 roles. Regla transversal: admin y root no pueden reservar/comprar (R24–R25, R28–R29) | 1, 24 | M | B1-02 |
| B1-04 | `POST /auth/login` — un solo campo `identificador` (usuario o correo; el root entra con su Id) → token + rol + datos básicos | 1 | S | B1-02 |
| B1-05 | `POST /auth/registro` (cliente): validaciones Pydantic, unicidad de DNI/correo/usuario, imagen opcional JPG/PNG ≤ 2 MB en `multipart/form-data` | 4 | M | B1-01 |
| B1-06 | `GET/PUT /me` — perfil. Documento inmutable; root solo id/contraseña; **cambio de correo con verificación** (enlace al correo nuevo + contraseña actual) | 2 | M | B1-03, B2-03 |
| B1-07 | `PUT /me/password` — exige contraseña actual, guarda el hash nuevo | 3 | S | B1-04 |
| B1-08 | Root: `GET/POST/DELETE /root/administradores` (solo correo + nombre; **sin edición**, R21) con estado pendiente/activo, correo con enlace de un solo uso (vence en 48 h) y `POST /auth/completar-registro` con los mismos campos del cliente | 23 | L | B1-03, B2-03 |
| B1-09 | `GET/PUT /root/roles` — matriz de módulos por rol, respetada por `require_roles` | 24 | M | B1-03 |
| B1-10 | **Pytest:** login, registro, cambio de contraseña, permisos por rol, expiración de token, root por defecto, errores (BD de pruebas separada) + colección Postman `Auth/Usuarios/Roles` | todas | M | continuo |

**Camino crítico del sprint:** B1-01 → B1-02 → B1-03 → B1-04. Todo lo protegido (incluido el trabajo de B2/F2 en rutas de admin) depende de ellos; entregar B1-04 lo antes posible.

### 7.2 Backend 2 (B2) — Módulos Vuelos y Búsqueda

| ID | Tarea | HU | Tam. | Depende de |
|----|-------|----|------|------------|
| B2-01 | **Scaffold FastAPI:** estructura por módulos, config por entorno, conexión SQLAlchemy, `alembic init`, **CORS** para Vite, manejador global de errores con el formato único, logger, `pytest` base, workflow de CI | base | M | Etapa 0 |
| B2-00 | **Contrato Vuelos/Búsqueda:** schemas Pydantic y rutas esqueleto (`/ciudades`, `/vuelos`, `/admin/vuelos`) con datos de ejemplo | 5, 18, 19 | S | B2-01 |
| B2-02 | Migraciones `003_ciudades` y `004_vuelos` (campos de la sección 9). `vuelo` lleva FK al administrador que lo programa; el estado es un enum con `programado`, `sucedido`, `realizado`, `cancelado` | 5, 18 | M | B1-01 (migración 001) |
| B2-03 | **Servicio de correo** por SMTP apuntando a Mailpit (`localhost:1025`), con plantilla simple (invitación de admin, verificación de correo); lo consumen B1-06 y B1-08 | 23, 2 | S | B2-01 |
| B2-04 | **Seeds:** catálogo de ciudades (32 capitales de departamento + 5 ciudades internacionales del exterior, con zona horaria y `grupo`) y ~20 vuelos de ejemplo (nacionales/internacionales, distintas fechas, precios y duraciones) — F2 los necesita pronto | 5 | S | B2-02 |
| B2-05 | `POST /admin/vuelos` — programar vuelo: entradas **fecha, hora, origen, destino, duración y costo**; el sistema genera **código consecutivo**, **llegada** (con zona horaria de la ciudad destino), **cupos por clase** según el tipo y estado `programado`. Validaciones en la sección 11 | 18 | L | B2-02, B1-03 |
| B2-06 | `GET /admin/vuelos/{id}` y `GET /admin/vuelos` (listado básico para poder llegar al detalle) | 19 | S | B2-05 |
| B2-07 | `GET /ciudades?uso=nacional\|internacional` (cada ciudad trae su `grupo`) para poblar los selects | 5, 18 | S | B2-04 |
| B2-08 | `GET /vuelos` — búsqueda con **criterios combinables** (origen, destino, fecha, rango de duración, rango de precio, clase), orden y paginación. Muestra vuelos programados con salida futura **sin ocultarlos por falta de cupo**; incluye llegada y disponibilidad por clase. **Índices** en origen, destino y fecha (RNF01: ≤ 3 s) | 5 | L | B2-02, B2-04 |
| B2-09 | `GET /vuelos/{id}` — detalle público (visitante y cliente) | 5 | S | B2-08 |
| B2-10 | **Pytest:** validaciones de vuelo, cálculo de llegada por zona horaria, combinaciones de filtros, permisos de `/admin/vuelos` + colección Postman `Vuelos/Búsqueda` | 5, 18, 19 | M | continuo |
| B2-11 | **Historial de búsquedas** (`005_busquedas`): guardar origen, destino y fechas cuando quien busca es un cliente autenticado. El módulo de Recomendación (Iteración 4) lo necesita y no se puede reconstruir después | 5 | S | B2-08, B1-03 |

### 7.3 Frontend 1 (F1) — Proyecto base, autenticación, cuenta y panel root

| ID | Tarea | HU | Tam. | Depende de |
|----|-------|----|------|------------|
| F1-01 | **Proyecto Vite + React:** estructura por features, React Router, Bootstrap + CSS propio para respetar mockups, layout responsive (web y móvil), cabecera con menú (con espacio para el icono del carrito) y componentes base: inputs, botones, modales, toasts, estados de carga y error | base | L | Etapa 0 |
| F1-02 | **Instancia de Axios** (baseURL, interceptor `Authorization: Bearer`, manejo de 401), `AuthContext`, **cierre de sesión por inactividad** (RNF06), **rutas protegidas por rol** y menú diferenciado | 1 | M | F1-01 |
| F1-03 | Pantalla **Iniciar sesión** (web + móvil según mockup; campo único usuario/correo) | 1 | M | F1-02, B1-04 |
| F1-04 | Pantalla **Registro de cliente** (10 campos + foto opcional, validaciones, web + móvil) | 4 | M | F1-01, B1-05 |
| F1-05 | Pantalla **Gestionar perfil** (documento de solo lectura, flujo de verificación para cambiar el correo; variante root con id y contraseña) | 2 | M | F1-02, B1-06 |
| F1-06 | Pantalla **Cambiar contraseña** (actual + nueva) | 3 | S | F1-05, B1-07 |
| F1-07 | Panel root **Gestionar administradores** (formulario nombre + correo, listado con estado, eliminar con confirmación; sin edición) + pantalla **completar registro** del admin (llega desde el enlace del correo, reutiliza los campos del registro de cliente) | 23 | L | F1-04, B1-08 |
| F1-08 | Panel root **Gestionar roles** (tabla en web, tarjetas en móvil) | 24 | M | F1-02, B1-09 |
| F1-09 | **Vitest:** formulario de login, formulario de registro, componente de ruta protegida por rol, mensajes de error + revisión responsive del módulo Usuarios | todas | M | continuo |

### 7.4 Frontend 2 (F2) — Vuelos y búsqueda

| ID | Tarea | HU | Tam. | Depende de |
|----|-------|----|------|------------|
| F2-01 | **MSW:** handlers generados a partir de `/openapi.json` de B1-00/B2-00; se activan con `VITE_USE_MOCKS=true` para trabajar sin el back | base | S | B2-00 |
| F2-02 | **Formulario de búsqueda** según mockup, ajustado a los requisitos: ida y vuelta / solo ida, origen y destino, fechas, pasajeros, clase, rango de precio, rango de duración (**sin filtro de aerolínea**) | 5 | L | F1-01, F2-01 |
| F2-03 | **Lista de resultados:** tarjetas con información completa (código, ruta, salida y llegada en hora local, duración, costo, disponibilidad por clase), "Más información", orden (por defecto salida ascendente; también precio y duración), filtros combinados, paginación y **estado vacío** ("no existen vuelos") | 5 | L | F2-02 |
| F2-04 | **Detalle de vuelo.** Para el visitante, reservar/comprar se deshabilitan o invitan a registrarse (la compra es Iteración 2) | 5 | M | F2-03, B2-09 |
| F2-05 | **Programar vuelo (admin):** pestañas Nacional/Internacional, campos fecha, hora, origen, destino, duración y costo (código, llegada y cupos los muestra el resultado, no se digitan); selects dependientes (en internacional, al elegir el origen, el destino solo ofrece el grupo opuesto) | 18 | L | F1-02, B2-05 |
| F2-06 | **Consultar vuelo (admin):** listado + detalle de solo lectura (código, estado, llegada, cupos por clase, programado el) | 19 | M | F2-05, B2-06 |
| F2-07 | Apagar los mocks y **conectar con la API real**; **Vitest** de filtros de vuelos; revisión responsive de vuelos y búsqueda | 5, 18, 19 | M | B2-08 |

---

## 8. Contrato de API v0

Coincide con los endpoints de `Tecnologias_AeroTiquetes.md`, más `/auth/completar-registro` (primer ingreso del admin, HU23).

| Método | Ruta | Acceso | HU | Dueños |
|--------|------|--------|----|--------|
| POST | `/auth/login` (`identificador`, `password`) | Público | 1 | B1 / F1 |
| POST | `/auth/registro` (`multipart/form-data`) | Público (visitante) | 4 | B1 / F1 |
| POST | `/auth/completar-registro` | Admin pendiente (token del enlace) | 23 | B1 / F1 |
| GET · PUT | `/me` | Autenticado | 2 | B1 / F1 |
| PUT | `/me/password` | Autenticado | 3 | B1 / F1 |
| GET · POST · DELETE | `/root/administradores` | Root | 23 | B1 / F1 |
| GET · PUT | `/root/roles` | Root | 24 | B1 / F1 |
| GET | `/ciudades` (query: `uso`) | Público | 5, 18 | B2 / F2 |
| GET | `/vuelos` (query: `origen, destino, fecha, precioMin, precioMax, duracionMin, duracionMax, clase, orden, pagina`) | Público | 5 | B2 / F2 |
| GET | `/vuelos/{id}` | Público | 5 | B2 / F2 |
| POST | `/admin/vuelos` (`tipo, origen, destino, fecha, hora, duracion, costo`) | Administrador | 18 | B2 / F2 |
| GET | `/admin/vuelos` · `/admin/vuelos/{id}` | Administrador | 19 | B2 / F2 |

## 9. Modelo de datos del sprint

Tablas en alcance: `usuario`, `root`, `administrador`, `cliente`, `rol`, `rol_modulo`, `ciudad`, `vuelo`, `busqueda`.
Quedan **fuera**: `silla` (se crea en la Iteración 2, cuando la compra asigna la silla), `tiquete`, `viajero`, `pasabordo`, `carrito`, `billetera` (se crea al primer acceso, Iteración 2), `tarjeta`, `promocion`, `noticia`, `suscripcion`, `mensaje`, `respuesta`.

Ajustes al modelo actual (clase/ER):

| Tabla | Cambios |
|-------|---------|
| **usuario** | Agregar `usuario` (nombre de usuario, único), `fecha_nacimiento`, `lugar_nacimiento`, `direccion_facturacion`, `genero`. `telefono` pasa a opcional (el registro no lo pide). Los campos quedan nulos mientras el admin esté pendiente |
| **root** | Su Id de acceso se guarda como `usuario`; se crea automáticamente al arrancar |
| **administrador** | Agregar `estado` (pendiente / activo) y token de primer ingreso con vencimiento |
| **ciudad** (nueva) | `nombre`, `pais`, `codigo` (IATA, opcional), `zona_horaria` (IANA), `es_capital_departamento`, `grupo_internacional` (`colombia` / `exterior` / nulo) — ciudades en BD, no en código (RNF13) |
| **vuelo** | `codigo` (consecutivo generado por el sistema), `id_origen`, `id_destino`, `tipo`, `salida_utc`, `duracion_min`, `llegada_utc` (calculada), `costo` (por persona, único), `estado` (programado / sucedido / realizado / cancelado), `cupos_primera`, `cupos_economica`, `fecha_programacion`, `id_administrador`. **Sin** aerolínea, número manual, `es_directo` ni asientos libres |
| **busqueda** (nueva) | `id_cliente`, `origen`, `destino`, `fecha`, `creada_en` |
| **rol / rol_modulo** | 4 roles sembrados (no se crean ni eliminan); la matriz de módulos es editable |

---

## 10. Decisiones

### 10.1 Decisiones tomadas con los documentos nuevos

Fuente: **SRS** = SRS IEEE 830; **Req** = `Requerimientos_Lab_Soft.md`; **Equipo** = decisión de diseño que los requisitos dejan abierta (confirmar en el kickoff); **PO** = respuesta del Product Owner.

| # | Tema | Decisión | Fuente |
|---|------|----------|--------|
| D1 | **Login** | Un solo campo que acepta usuario o correo; el root entra con su Id. El admin pendiente no inicia sesión hasta completar el registro por el enlace | Req Usuarios R02, R11, R18–R19 |
| D2 | **Campos del registro** | Se agregan al modelo: DNI, fecha y lugar de nacimiento, dirección de facturación, género, usuario. El admin completa los mismos campos | Req Usuarios R03–R12, R22 |
| D3 | **Campos del vuelo** | El admin solo digita fecha, hora, origen, destino, duración y costo. Se **elimina aerolínea** (el sistema es de una sola aerolínea), **número de vuelo manual** (es un código consecutivo automático, ej. `AT-000001`, formato a definir por el equipo) y `es_directo` (todos son directos) | Req Vuelos R03–R09, R14 · SRS 1.2 |
| D4 | **Cupos y sillas** | Capacidad automática por tipo: nacional 150 (25 primera + 125 económica), internacional 250 (50 + 200). Los números de silla son consecutivos, no filas, lo que aclara el mockup de HU37. La tabla `silla` se genera en la Iteración 2 (la compra asigna silla aleatoria, HU10) | Req Check-in RF08 |
| D5 | **Ciudades** | Nacionales: las 32 capitales de departamento (R15). Internacionales: grupo `colombia` (Pereira, Bogotá, Medellín, Cali, Cartagena) y grupo `exterior` (Madrid, Londres, New York, Buenos Aires, Miami). Un vuelo internacional conecta una ciudad de cada grupo **en cualquiera de los dos sentidos**, lo que hace posible el regreso del trayecto completo. Zona horaria en cada ciudad | Req Vuelos R11–R15 · Respuesta del PO |
| D6 | **Primer ingreso del admin** | Enlace de un solo uso por correo (vence en 48 h) → completa los campos y pasa de `pendiente` a `activo`. El root solo crea y elimina; no edita (R21) | Req Usuarios R21–R22 · Equipo |
| D7 | **Root por defecto** | Se crea al arrancar la aplicación si no existe, con Id y contraseña desde `.env` (no es un script manual) | Req Usuarios R17–R19 |
| D8 | **Cambio de correo** | "Permiso/verificación especial" = verificación por enlace al correo nuevo + contraseña actual | Req Usuarios R14 · Equipo |
| D9 | **"¿Olvidó su contraseña?"** | Fuera de alcance: ningún requisito lo cubre. El enlace queda deshabilitado u oculto | SRS 3.2.3 |
| D10 | **Imagen de perfil** | JPG/PNG ≤ 2 MB, `multipart/form-data`, archivo en disco con la ruta en BD | Req Usuarios R13 (lo deja al equipo) |
| D11 | **Billetera** | Existe solo para clientes; se crea con saldo 0 al primer acceso en la Iteración 2. No se toca en este sprint | Req Usuarios R16 · Financiero R01 |
| D12 | **Ida y vuelta en la búsqueda** | La UI completa; "ida y vuelta" ejecuta dos búsquedas independientes (el trayecto completo son dos tiquetes) | Req Compra R40–R41 |
| D13 | **Resultados y cupos** | La búsqueda muestra vuelos programados con salida futura **sin ocultarlos por falta de cupo**. El filtro de clase no excluye vuelos: destaca la disponibilidad de esa clase. El costo no depende de la clase | Req Búsqueda R15 · Vuelos R09 · Respuesta del PO |
| D14 | **Filtros** | Origen, destino, fecha, rango de precio, rango de duración y clase; combinables. Sin filtro de aerolínea | Req Búsqueda R01–R09 |
| D15 | **Llegada y zona horaria** | Se calcula y guarda al programar (salida + duración, convertida a la zona del destino) para vuelos nacionales e internacionales; la búsqueda la muestra en hora local del destino | Req Vuelos R10 · Búsqueda R13 |
| D16 | **Estados del vuelo** | El enum incluye `programado`, `sucedido`, `realizado` y `cancelado` desde la migración inicial. La búsqueda excluye vuelos cuya salida ya pasó aunque el proceso automático aún no los marque | Req Vuelos R22–R23 |
| D17 | **Inactividad** | Token de 30 min y cierre de sesión por inactividad en el front | SRS RNF06 |
| D18 | **Historial de búsquedas** | Se guarda desde este sprint para clientes autenticados | Req Recomendación RF02 |
| D19 | **Noticias al programar un vuelo** | No se implementan ahora (HU18 no las incluye; las noticias son de las Iteraciones 2 y 4). `POST /admin/vuelos` deja un punto de extensión para publicarlas luego | Req Vuelos R25–R27 |
| D20 | **Entorno** | `docker-compose` solo para PostgreSQL y Mailpit; backend y frontend corren en local. Si el equipo prefiere instalar todo a mano, también vale: lo importante es que todos usen el mismo | Equipo (SRS 2.4 lo deja abierto) |

### 10.2 Respuestas del PO a las preguntas abiertas

| # | Pregunta | Respuesta | Efecto en el plan |
|---|----------|-----------|-------------------|
| P1 | ¿Los vuelos internacionales pueden ir en sentido contrario? | **Sí, ambos sentidos** | La validación de HU18 acepta una ciudad de cada grupo en cualquier orden; el modelo usa `grupo_internacional` en lugar de banderas de origen y destino |
| P2 | ¿La matriz de roles de HU24 es editable? | **Activa** | Los 4 roles son fijos; el root activa o desactiva permisos por módulo y `require_roles` los respeta (B1-09, F1-08) |
| P3 | ¿El filtro de clase destaca disponibilidad o excluye vuelos? | **Destaca la disponibilidad** | Se mantiene D13: no se ocultan vuelos por cupo |
| P4 | ¿Quién sube la imagen alusiva del vuelo? | **La crea un administrador**; el mockup no la tiene pero se hace después | Fuera del Sprint 1; en la Iteración 2 se agrega un campo opcional de imagen y se actualiza el mockup |

No quedan preguntas abiertas con el PO para el Sprint 1.

### 10.3 Correcciones a mockups e historias (informar al PO)

| Historia | Corrección |
|----------|-----------|
| HU5 | Quitar el filtro **Aerolínea** |
| HU18 | Quitar **Aerolínea**, **Número de vuelo** y **Asientos disponibles**; agregar **Duración**. La imagen alusiva no se agrega en este sprint |
| HU19 | Mostrar **código** y **hora de llegada**; los cupos por clase deben ser 150/250 en total (el mockup muestra 180 en un vuelo internacional). En este sprint la pantalla es solo lectura, así que sobran "Guardar vuelo" y "Cancelar" |
| HU22 | El mockup lista una ruta MDE → PTY: Panamá no está entre las ciudades permitidas |
| HU37 | Los rangos 1–25 / 26–150 y 1–50 / 51–250 son números de silla, no filas |
| HU4 | Ningún campo de teléfono en el registro (el modelo lo tiene; queda opcional) |

---

## 11. Reglas de negocio y criterios de terminado por historia

El criterio oficial de aceptación de todas es *"El Product Owner confirma la historia"*. Para llegar a esa confirmación, cada historia debe cumplir como mínimo:

**HU1 · Iniciar sesión**
- [ ] Valida contra el hash bcrypt; mensaje de error genérico (no revela si falló el identificador o la contraseña).
- [ ] La respuesta incluye el JWT y el rol; el front muestra interfaz y menú distintos para cliente, administrador y root.
- [ ] Rutas protegidas devuelven 401/403 según corresponda; el token expira a los 30 min y el front cierra la sesión por inactividad.
- [ ] El root por defecto existe tras el primer arranque.

**HU2 · Gestionar perfil**
- [ ] Se puede consultar y editar el perfil propio; el documento **no** es editable.
- [ ] Root solo ve id y contraseña.
- [ ] El correo solo cambia tras la verificación (D8).

**HU3 · Cambiar contraseña**
- [ ] Exige la contraseña actual; rechaza si no coincide.
- [ ] La nueva se guarda con bcrypt.

**HU4 · Registro de cliente**
- [ ] Campos: DNI, nombres, apellidos, fecha y lugar de nacimiento, dirección de facturación, género, correo, usuario, contraseña; imagen opcional.
- [ ] Unicidad de DNI, correo y usuario; la fecha de nacimiento no puede ser futura.
- [ ] Al registrarse queda con rol cliente.

**HU5 · Buscar y consultar vuelos**
- [ ] Origen, destino, fecha, rango de duración, rango de precio y clase se pueden usar solos o combinados.
- [ ] Muestra vuelos programados con salida futura, **independientemente de los cupos**, con información completa: código, ruta, salida, llegada en hora local del destino, duración, costo y disponibilidad por clase.
- [ ] Orden por defecto: salida ascendente; también se puede ordenar por precio y duración.
- [ ] Si nada coincide, el mensaje dice que no existen vuelos.
- [ ] El visitante busca libremente pero no puede reservar ni comprar (debe registrarse).
- [ ] La búsqueda responde en ≤ 3 s con los datos de prueba.

**HU18 · Programar vuelo**
- [ ] Entradas: tipo, fecha, hora, origen, destino, duración (> 0) y costo por persona (> 0).
- [ ] Origen ≠ destino; fecha y hora futuras.
- [ ] **Nacional:** origen y destino son capitales de departamento.
- [ ] **Internacional:** una ciudad del grupo `colombia` {Pereira, Bogotá, Medellín, Cali, Cartagena} y otra del grupo `exterior` {Madrid, Londres, New York, Buenos Aires, Miami}, en cualquiera de los dos sentidos; solo directos.
- [ ] El sistema genera el código consecutivo, la llegada con zona horaria, los cupos por clase y el estado `programado`.

**HU19 · Consultar vuelo**
- [ ] Muestra código, tipo, estado, origen, destino, salida, llegada, duración, costo, cupos por clase y fecha de programación.
- [ ] Solo lectura en este sprint (editar y cancelar son Iteración 2); existe un listado para llegar al detalle.

**HU23 · Gestionar administradores**
- [ ] Root crea un administrador con solo correo y nombre; el correo llega a Mailpit con el enlace de primer ingreso.
- [ ] El admin completa los mismos campos de un cliente y queda `activo`.
- [ ] Listado con estado y eliminación con confirmación; no hay edición. Solo el root accede.

**HU24 · Gestionar roles**
- [ ] Existen los 4 roles (root, administrador, cliente, visitante) con sus módulos; son fijos, no se crean ni eliminan.
- [ ] La matriz es activa: el root activa o desactiva permisos por módulo y el backend aplica el cambio.
- [ ] El acceso a cada módulo se restringe realmente según el rol autenticado.

**Definición de terminado común**
- [ ] PR revisado por otra persona y mergeado; CI en verde (Pytest/Vitest).
- [ ] Endpoint visible y probado en Swagger; ruta agregada a la colección de Postman.
- [ ] Pantalla probada en web y móvil.
- [ ] Sin contraseñas ni tokens en logs ni en el repositorio.

---

## 12. Orden de trabajo e hitos de sincronización

```
Etapa 0  Arranque conjunto (repo, entorno, revisar decisiones, modelo, seeds)
   │
Etapa 1  Fundaciones (en paralelo)
   │      B1: B1-00 → B1-01 → B1-02 → B1-03 → B1-04
   │      B2: B2-01 → B2-00 → B2-03 → (B1-01 mergeado) → B2-02 → B2-04
   │      F1: F1-01 → F1-02          F2: F2-01 (MSW) → F2-02
   │
   ├─ 🏁 Hito 0: /docs publicado con todos los esquemas → F1 y F2 trabajan con mocks
   ├─ 🏁 Hito A: login funcionando de punta a punta (B1-04 + F1-03)
   │
Etapa 2  Historias núcleo
   │      B1: B1-05, B1-06            B2: B2-05, B2-07, B2-08
   │      F1: F1-03, F1-04, F1-05     F2: F2-03, F2-05
   │
   ├─ 🏁 Hito B: búsqueda real (B2-08 + F2-03) y programar vuelo (B2-05 + F2-05)
   │
Etapa 3  Resto de historias
   │      B1: B1-07, B1-08, B1-09     B2: B2-06, B2-09, B2-11
   │      F1: F1-06, F1-07, F1-08     F2: F2-04, F2-06
   │
Etapa 4  Integración, QA cruzado, corrección de bugs, ensayo y demo
          Todos: F2-07, B1-10, B2-10, F1-09 + checklist de la sección 11
```

**Bloqueos cruzados a vigilar**

| Quién espera | A quién | Qué |
|--------------|---------|-----|
| B2 (B2-02) | B1 | Migración `001_usuarios` mergeada (FK de `vuelo` al administrador) |
| B2, F1, F2 | B1 | JWT y `require_roles` (B1-02, B1-03) |
| B1-06, B1-08 | B2 | Servicio de correo con Mailpit (B2-03) |
| F1, F2 | B1, B2 | Esquemas y rutas esqueleto (B1-00, B2-00) para generar los mocks |
| F2 | B2 | Seeds de vuelos y ciudades (B2-04) |
| F2 | F1 | Proyecto base y componentes (F1-01) |
| F1-07 | F1-04 | Se reutilizan los campos del formulario de registro |

**Rutina sugerida:** daily corto de 10 minutos; PRs pequeños (una tarea = un PR); integración front-back apenas exista cada endpoint, no al final del sprint.

---

## 13. Fuera de alcance (Iteraciones 2–4)

- **Iteración 2:** seleccionar clase, registrar viajero, reservar, carrito, comprar (con asignación aleatoria de silla y tabla `silla`), trayecto único/completo, cancelar reserva/compra, historial, billetera (saldo y tarjetas), editar y cancelar vuelo, vuelos realizados, noticias (consulta y suscripción), imagen alusiva del vuelo (la sube un administrador; campo opcional que se agrega entonces, aunque el mockup de HU18 no lo tenga). Incluye las tareas programadas: expiración de reservas a las 24 h y paso de estados `sucedido` → `realizado`.
- **Iteración 3:** check-in (con sesión y rápido) con pasabordo en PDF, consultar tiquete, mapa de asientos y cambio de silla, mensajes cliente→admin, aplicar promoción, gestionar cancelación de vuelo, reubicar pasajero, reintegrar dinero.
- **Iteración 4:** gestión de noticias y promociones, bandeja y respuesta de mensajes del admin, recomendaciones, chatbot.

> **Cuidado de diseño:** aunque no se implementen aún, dejen en la cabecera el espacio para el icono del carrito (aparece en todos los mockups) y no cierren el modelo de `vuelo` de forma que impida generar `silla` más adelante.
