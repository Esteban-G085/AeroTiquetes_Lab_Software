# AeroTiquetes – Laboratorio de Software

Sistema de gestión para compra y reserva de tiquetes aéreos en línea. Desarrollado con **FastAPI**, **React**, **PostgreSQL** y **Mailpit**.

## ¿Qué se va a hacer?

En el **Sprint 1** se construyó la base funcional del sistema para permitir el flujo completo de autenticación, gestión de usuarios y ciclo básico de vuelos.

### Funcionalidades a implementar

- **Autenticación y roles**: Soporte para cuatro roles (Root, Administrador, Cliente y Visitante). Inicio de sesión con usuario o correo, con tokens JWT y expiración por inactividad (30 min).
- **Gestión de usuarios**: Registro de clientes, gestión de perfil, cambio de contraseña, invitación y registro de administradores (vía enlace único al correo con Mailpit), y matriz de roles editable por el Root.
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

### Demo a mostrar

1. El sistema crea el Root por defecto. El Root inicia sesión y crea un Administrador (se envía correo a Mailpit).
2. El Administrador completa su registro desde el enlace recibido e inicia sesión.
3. El Administrador programa un vuelo nacional y uno internacional.
4. Un Visitante busca vuelos, combina filtros y abre el detalle de uno.
5. El Visitante se registra como Cliente, inicia sesión, edita su perfil y cambia su contraseña.
6. El Root revisa la matriz de roles y accesos.

## Tecnologías

- **Backend**: Python, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2, JWT, bcrypt
- **Frontend**: React + Vite, Bootstrap, Axios, React Router
- **Base de datos**: PostgreSQL
- **Correo (desarrollo)**: Mailpit (SMTP 1025, UI 8025)
- **Pruebas**: Pytest (backend, 170 pruebas) · Vitest (frontend, 246 pruebas) · Playwright en un navegador real (`npm run e2e`, `npm run audit:ui`)

No se usan **mocks de API**: el front se construyó contra los contratos acordados y ya está conectado a la API real
de usuarios, vuelos y ciudades.

## Estructura del proyecto

```text
Proyecto/
├── backend/               # API FastAPI (módulos usuarios, vuelos y búsqueda) + Alembic + pruebas + colección Postman
├── frontend/              # SPA React + Vite (módulos usuarios, búsqueda y vuelos)
│   ├── docs/              # sistema de diseño, contratos de API, mockups y estado del sprint
│   └── src/features/      # un módulo por carpeta (ver src/features/README.md)
├── .github/               # CI del frontend (lint + pruebas + build) y plantilla de PR
├── docker-compose.yml     # PostgreSQL + Mailpit para desarrollo
├── Plan_Sprint_1.md       # Plan completo del Sprint 1
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
| [Plan_Sprint_1.md](./Plan_Sprint_1.md) | Plan completo del Sprint 1: reparto por equipo, tareas, hitos, modelo de datos, reglas de negocio y criterios de aceptación |
| [CAMBIOS_INTEGRACION.md](./CAMBIOS_INTEGRACION.md) | Qué se ajustó al unir el backend B1 con el frontend de usuarios (F1) |
| [frontend/README.md](./frontend/README.md) | Arranque, comandos, estructura y convenciones del frontend |
| [frontend/docs/DISENO.md](./frontend/docs/DISENO.md) | Sistema de diseño: tokens, componentes y reglas de experiencia |
| [frontend/docs/CONTRATO_USUARIOS.md](./frontend/docs/CONTRATO_USUARIOS.md) | API que el front espera de B1 (acordada con el backend) |
| [frontend/docs/CONTRATO_VUELOS.md](./frontend/docs/CONTRATO_VUELOS.md) | API de vuelos, ciudades y búsqueda acordada con B2 (ya implementada) |
| [frontend/docs/ESTADO_SPRINT1.md](./frontend/docs/ESTADO_SPRINT1.md) | Estado del sprint y checklist de terminado por historia |
| [frontend/docs/MOCKUPS.md](./frontend/docs/MOCKUPS.md) | Comparación entre los mockups de las historias y lo implementado |
| [frontend/src/features/README.md](./frontend/src/features/README.md) | Contrato de un módulo (feature) del frontend |
| [backend/README.md](./backend/README.md) | Arranque, endpoints y pruebas del backend |
