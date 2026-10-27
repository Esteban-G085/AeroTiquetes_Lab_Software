# AeroTiquetes - Backend (modulos Usuarios, Vuelos y Busqueda)

FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL. Estructura modular: cada modulo
vive en `app/modules/<nombre>/` con `models · schemas · service · router`, y lo
transversal en `app/core/` (config, db, seguridad, errores, correo, deps, tipos).

| Modulo | Contenido | Responsable |
|---|---|---|
| `usuarios` | Login/JWT, registro, perfil, contrasena, administradores, matriz de roles | B1 |
| `vuelos` | Catalogo de ciudades, programar/consultar vuelos, seeds | B2 |
| `busqueda` | Busqueda publica de vuelos y detalle, historial de busquedas | B2 |

## Levantar en local

```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # ajusta DATABASE_URL y secretos

# PostgreSQL y Mailpit (desde la raiz del repo, donde esta docker-compose.yml)
(cd .. && docker compose up -d)

alembic upgrade head                                   # 001_usuarios -> 005_busquedas
uvicorn app.main:app --reload --port 8000
```

- Swagger: http://localhost:8000/docs · Esquema: `/openapi.json`
- Mailpit (correos de invitacion de admin): http://localhost:8025
- Al arrancar se crea el **root por defecto** (`ROOT_ID` / `ROOT_PASSWORD` del `.env`), se siembran los 4 roles con su matriz de modulos y el **catalogo de 37 ciudades** (idempotente).
- Migraciones: `001_usuarios` -> `002_roles` -> `003_ciudades` -> `004_vuelos` -> `005_busquedas`.

## Correo electrónico (invitaciones de administrador)

El sistema envía correos para:
- Invitación de administrador (HU23) — `POST /root/administradores`
- Verificación de cambio de correo (HU2) — `POST /me/correo`

### Opción A: Mailpit (recomendado para desarrollo/local)
Por defecto, el proyecto viene configurado para usar **Mailpit**. Este es el método recomendado para la demo del Sprint 1, ya que no requiere internet ni credenciales de correo.

1. Desde la raíz del repositorio, levanta los servicios:
```bash
docker compose up -d
```
2. Con la configuración por defecto de `backend/.env.example`, los correos se enviarán a Mailpit vía SMTP en `localhost:1025`.
3. Puedes visualizar todos los correos enviados en [http://localhost:8025](http://localhost:8025).

### Opción B: SMTP real (Gmail, etc.)
Si deseas que los correos lleguen a una bandeja real, puedes configurar un servidor SMTP propio editando `backend/.env`.

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_correo@gmail.com
SMTP_PASSWORD=tu_contraseña_de_aplicación  # NO tu contraseña normal
SMTP_FROM=tu_correo@gmail.com
```

> **Notas importantes:**
> - **Gmail:** Requiere tener la verificación en 2 pasos activada y generar una [contraseña de aplicación](https://myaccount.google.com/apppasswords).
> - **¿Dónde leer las variables?** El backend lee la configuración desde `backend/.env` usando `pydantic-settings` (`app/core/config.py`). Si las defines solo como variables de entorno del sistema, pueden no tener efecto si existe un archivo `.env`. Para mayor fiabilidad, **configúralas directamente en `backend/.env`**.
> - **Tolerante a fallos:** Si el envío de correo falla (credenciales incorrectas, sin conexión, etc.), el backend solo registrará un `warning` en los logs de `uvicorn` y **no interrumpirá el flujo de la aplicación**. Esto es intencional para facilitar el desarrollo.

## Datos de ejemplo (vuelos)

```bash
python -m app.modules.vuelos.seeds
```

Siembra 20 vuelos `AT-0001`...`AT-0020` con fechas relativas a hoy (nacionales e
internacionales, uno sin cupo en economica para el caso D13 y uno ya `sucedido` para
D16). Es idempotente: si ya hay vuelos de ejemplo no duplica.

## Tests

```bash
pytest -q        # usa SQLite temporal, no necesita Postgres
```

Cubren usuarios (auth, roles, perfil, administradores), vuelos (modelos, migraciones,
seeds, reglas de HU18), busqueda (filtros combinables, orden, detalle, D13/D16),
historial de busquedas y el contrato que consume el frontend.

## Endpoints (Sprint 1)

### Usuarios (B1)

| Metodo | Ruta | Acceso | HU |
|---|---|---|---|
| POST | `/auth/login` | Publico | 1 |
| POST | `/auth/registro` (multipart) | Publico | 4 |
| POST | `/auth/completar-registro` (multipart) | Token de invitacion | 23 |
| POST | `/auth/verificar-correo` | Token del correo | 2 |
| GET/PUT | `/me` | Autenticado | 2 |
| PUT | `/me/password` | Autenticado | 3 |
| POST | `/me/correo` | Autenticado | 2 |
| GET/POST/DELETE | `/root/administradores` | Root | 23 |
| GET/PUT | `/root/roles` | Root | 24 |

### Ciudades, vuelos y busqueda (B2)

| Metodo | Ruta | Acceso | HU |
|---|---|---|---|
| GET | `/ciudades` (query opcional `uso=nacional\|internacional`) | Publico | 5, 18 |
| GET | `/vuelos` (`origen, destino, fecha, precioMin, precioMax, duracionMin, duracionMax, clase, orden, pagina`) | Publico | 5 |
| GET | `/vuelos/{id}` | Publico | 5 |
| GET | `/admin/vuelos` (`estado, origen, destino, pagina`) | Administrador | 19 |
| GET | `/admin/vuelos/{id}` | Administrador | 19 |
| POST | `/admin/vuelos` (`tipo, origen, destino, fecha, hora, duracion, costo`) | Administrador | 18 |

Las rutas `/admin/*` exigen rol `administrador` **y** el modulo `administracion_vuelos`
activo en la matriz de roles (HU24). El contrato detallado que consume el frontend esta
en `../frontend/docs/CONTRATO_VUELOS.md`; las colecciones Postman en `postman/`.

## Para integrar con el frontend

- **Error unico:** `{ "error": { "code", "message", "fields" } }`. Lancen `AppError` (`app/core/errors.py`).
- **Proteger rutas:** `Depends(require_roles("administrador"))`. Con `modulo="administracion_vuelos"` tambien respeta la matriz de HU24 (`require_roles("cliente", modulo="busqueda")`). Los nombres de modulo validos estan en `MODULOS_SISTEMA` (`usuarios/models.py`).
- **Usuario actual:** `CurrentUser` (`app/core/deps.py`); `usuario.rol` es `RolNombre`.
- **Nuevo modulo:** crear `app/modules/<x>/`, importar sus modelos en `alembic/env.py` y en `tests/conftest.py`, y montar el router en `app/main.py`.
- **Migraciones:** encadenar despues de `005_busquedas` (ver seccion 5.4 del plan); nunca editar una migracion ya mergeada.
- **Fechas:** se guardan en UTC con `FechaUTC` (`app/core/tipos.py`) y se muestran en la zona de cada ciudad.
- **CORS:** configurado para `http://localhost:5173` y `http://127.0.0.1:5173` (`CORS_ORIGINS`). La comparación es exacta: si el front se abre con otra URL (por ejemplo la de red que muestra Vite), hay que añadir ese origen.
