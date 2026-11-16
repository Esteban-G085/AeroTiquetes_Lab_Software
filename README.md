# AeroTiquetes – Laboratorio de Software

Sistema de gestión para compra y reserva de tiquetes aéreos en línea. Desarrollado con **FastAPI**, **React**, **PostgreSQL** y **Mailpit**.

## ¿Qué se va a hacer?

En el **Sprint 1** se construyó la base funcional del sistema para permitir el flujo completo de autenticación, gestión de usuarios y ciclo básico de vuelos.

### Funcionalidades a implementar

- **Autenticación y roles**: Soporte para cuatro roles (Root, Administrador, Cliente y Visitante). Inicio de sesión con usuario o correo, con tokens JWT y expiración por inactividad (30 min).
- **Gestión de usuarios**: Registro de clientes, gestión de perfil, cambio de contraseña, invitación y registro de administradores (vía enlace único al correo con Mailpit). El Root solo crea administradores y gestiona su propio perfil (contraseña).
- **Administración de vuelos**: El administrador podrá programar vuelos (generando código consecutivo, hora de llegada con zona horaria y cupos por clase) y consultarlos en modo solo lectura.
- **Búsqueda de vuelos**: Visitantes y clientes podrán buscar vuelos con criterios combinables (origen, destino, fecha, precio, duración y clase), ver resultados y consultar el detalle de cada vuelo.
- **Datos semilla**: Catálogo de ciudades (32 capitales de departamento + ciudades internacionales), vuelos de ejemplo y creación automática del usuario Root al iniciar la aplicación.

### Estado del Sprint 1

| Módulo | Equipo | Estado |
|---|---|---|
| Base del frontend, autenticación, cuenta y panel root (HU1–HU4, HU23, HU24) | F1 | ✅ integrado |
| Búsqueda y administración de vuelos (HU5, HU18, HU19) | F2 | ✅ integrado |
| API de usuarios (auth, perfil, root) | B1 | ✅ integrado |
| API de vuelos, ciudades y búsqueda | B2 | ✅ integrado |

> El Sprint 1 está cerrado de punta a punta: el frontend ya consume la API real de usuarios, vuelos y ciudades
> (sin mocks). El contrato de vuelos quedó acordado en
> [`frontend/docs/CONTRATO_VUELOS.md`](./frontend/docs/CONTRATO_VUELOS.md).

### Cambios realizados tras el cierre del Sprint 1 (entrega final)

Estos ajustes se hicieron sobre la base ya integrada del Sprint 1 y se incluyeron en la entrega final:

| Cambio | Detalle |
|---|---|
| **Correo real por Gmail SMTP** | El backend soporta ahora envío real mediante Gmail SMTP (`smtp.gmail.com:587` con STARTTLS, o `465` con SSL directo) usando contraseña de aplicación. Se configura con `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_FROM` en `backend/.env`. Mailpit sigue disponible para desarrollo local (`localhost:1025`) y el envío falla silenciosamente (solo log) si el servidor de correo no responde, sin romper la respuesta HTTP. |
| **Validación de lugar de nacimiento (Opción B)** | `lugar_nacimiento` ya no es texto libre. Se creó el módulo `catalogos` con la tabla `pais` (migración `006_paises`, 60 países activos, seed idempotente) y el endpoint público `GET /catalogos/paises`. El backend valida en `usuarios/service.py` que el valor sea un país activo (case-insensitive) y guarda el nombre canónico; valores inválidos responden `422` con `code: "lugar_nacimiento_invalido"`. El frontend reemplazó el `<input>` por un `<select>` de países en registro, completar registro de administrador y edición de perfil. |
| **Pruebas** | Backend: 175 pruebas pasando. Frontend: 255 pruebas pasando. Ninguna prueba envía correos reales (stub global de `_enviar`). |
| **Seguridad** | `.env` y `.gitignore` siguen sin credenciales en Git; se verificó con `git ls-files` que no hay coincidencias de secretos. |

### Sprint 2 (integrado): compra, reserva y billetera

Backend de B1 (HU6–HU10), noticias y administración de vuelos (HU11–HU14) + frontend de F1 ya conectados y probados contra PostgreSQL real en un navegador.
El detalle de cada cambio de la unión está en [`CAMBIOS_INTEGRACION_SPRINT2.md`](./CAMBIOS_INTEGRACION_SPRINT2.md) y lo que hizo B1 en
[`CAMBIOS_SPRINT2.md`](./CAMBIOS_SPRINT2.md). Contrato real: [`frontend/docs/CONTRATO_COMPRAS.md`](./frontend/docs/CONTRATO_COMPRAS.md).

| Historia | Backend | Frontend |
|---|---|---|
| HU6 Reservar · HU7 Comprar · HU8 Cancelar · HU9 Historial · HU10 Billetera y tarjetas | ✅ B1 | ✅ F1 (con adaptador, ver cambios) |
| HU11 Noticias y suscripción · HU12 Editar vuelo · HU13 Cancelar vuelo · HU14 Vuelos realizados | ✅ implementado en la integración (módulo B2) | ✅ pantallas de F1 conectadas |

### Demo a mostrar

1. El sistema crea el Root por defecto. El Root inicia sesión y crea un Administrador (se envía correo a Mailpit).
2. El Administrador completa su registro desde el enlace recibido e inicia sesión.
3. El Administrador programa un vuelo nacional y uno internacional.
4. Un Visitante busca vuelos, combina filtros y abre el detalle de uno.
5. El Visitante se registra como Cliente, inicia sesión, edita su perfil y cambia su contraseña.
6. El Root cambia su contraseña (su perfil solo permite eso).
7. (Sprint 2) El Cliente agrega saldo y una tarjeta en *Mi billetera*, compra o reserva un vuelo desde su detalle, ve *Mis viajes*, cancela con reintegro y paga una reserva pendiente.

## Tecnologías

- **Backend**: Python, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2, JWT, bcrypt
- **Frontend**: React + Vite, Bootstrap, Axios, React Router
- **Base de datos**: PostgreSQL
- **Correo (desarrollo)**: Mailpit (SMTP 1025, UI 8025)
- **Pruebas**: Pytest (backend, 303 pruebas) · Vitest (frontend, 386 pruebas) · Playwright en un navegador real (`npm run e2e`, `npm run audit:ui`)

No se usan **mocks de API**: el front se construyó contra los contratos acordados y ya está conectado a la API real
de usuarios, vuelos y ciudades.

## Estructura del proyecto

```text
Proyecto/
├── backend/               # API FastAPI (usuarios, vuelos, búsqueda, compras y financiero) + Alembic + pruebas + colección Postman
├── frontend/              # SPA React + Vite (usuarios, búsqueda, vuelos, compra, financiero y noticias)
│   ├── docs/              # sistema de diseño, contratos de API, mockups y estado del sprint
│   └── src/features/      # un módulo por carpeta (ver src/features/README.md)
├── .github/               # CI del frontend (lint + pruebas + build) y plantilla de PR
├── docker-compose.yml     # PostgreSQL + Mailpit para desarrollo
├── CAMBIOS_SPRINT2.md / CAMBIOS_INTEGRACION_SPRINT2.md
└── README.md
```

## Puesta en marcha

```bash
docker compose up -d          # PostgreSQL + Mailpit
cd backend                    # alembic upgrade head
                              # uvicorn app.main:app --reload
                              # python -m app.modules.vuelos.seeds   # 20 vuelos de ejemplo
cd ../frontend                # npm ci
                              # cp .env.example .env.local
                              # npm run dev  →  http://localhost:5173
```

Los correos de desarrollo se ven en http://localhost:8025. El arranque detallado de cada parte está en
[`backend/README.md`](./backend/README.md) y [`frontend/README.md`](./frontend/README.md).

## Documentación

| Documento | Contenido |
|---|---|
| [contexto.info/Plan_Sprint_1.md](./contexto.info/Plan_Sprint_1.md) · [Plan_Sprint_2.md](./contexto.info/Plan_Sprint_2.md) | Planes de los sprints: reparto por equipo, tareas, reglas de negocio y criterios de aceptación |
| [CAMBIOS_SPRINT2.md](./CAMBIOS_SPRINT2.md) | Sprint 2 de B1: qué se construyó, qué se retiró (roles) y cada cambio hecho en código de otros |
| [CAMBIOS_INTEGRACION_SPRINT2.md](./CAMBIOS_INTEGRACION_SPRINT2.md) | Unión del Sprint 1 final + backend B1 + frontend F1 del Sprint 2: bases del merge, conflictos y decisiones |
| [frontend/README.md](./frontend/README.md) | Arranque, comandos, estructura y convenciones del frontend |
| [frontend/docs/DISENO.md](./frontend/docs/DISENO.md) | Sistema de diseño: tokens, componentes y reglas de experiencia |
| [frontend/docs/CONTRATO_USUARIOS.md](./frontend/docs/CONTRATO_USUARIOS.md) | API que el front espera de B1 (acordada con el backend) |
| [frontend/docs/CONTRATO_VUELOS.md](./frontend/docs/CONTRATO_VUELOS.md) | API de vuelos, ciudades y búsqueda acordada con B2 (ya implementada) |
| [frontend/docs/ESTADO_SPRINT1.md](./frontend/docs/ESTADO_SPRINT1.md) | Estado del sprint y checklist de terminado por historia |
| [frontend/docs/MOCKUPS.md](./frontend/docs/MOCKUPS.md) | Comparación entre los mockups de las historias y lo implementado |
| [frontend/src/features/README.md](./frontend/src/features/README.md) | Contrato de un módulo (feature) del frontend |
| [backend/README.md](./backend/README.md) | Arranque, endpoints y pruebas del backend |
