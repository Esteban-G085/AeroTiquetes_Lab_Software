# AeroTiquetes - Backend (B1: modulo Usuarios)

FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL. Estructura modular: cada modulo
vive en `app/modules/<nombre>/` con `models · schemas · service · router`, y lo
transversal en `app/core/` (config, db, seguridad, errores, correo, deps).

## Levantar en local

```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # ajusta DATABASE_URL y secretos

# PostgreSQL y Mailpit (desde la raiz del repo, donde esta docker-compose.yml)
(cd .. && docker compose up -d)

alembic upgrade head                                   # 001_usuarios -> 002_roles
uvicorn app.main:app --reload --port 8000
```

- Swagger: http://localhost:8000/docs · Esquema: `/openapi.json`
- Mailpit (correos de invitacion de admin): http://localhost:8025
- Al arrancar se crea el **root por defecto** (`ROOT_ID` / `ROOT_PASSWORD` del `.env`) y se siembran los 4 roles con su matriz de modulos.

## Tests

```bash
pytest -q        # usa SQLite temporal, no necesita Postgres
```

## Endpoints (Sprint 1, B1)

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

## Para integrar con B2 y el frontend

- **Error unico:** `{ "error": { "code", "message", "fields" } }`. Lancen `AppError` (`app/core/errors.py`).
- **Proteger rutas:** `Depends(require_roles("administrador"))`. Con `modulo="vuelos..."` tambien respeta la matriz de HU24 (`require_roles("cliente", modulo="busqueda")`). Los nombres de modulo validos estan en `MODULOS_SISTEMA` (`usuarios/models.py`).
- **Usuario actual:** `CurrentUser` (`app/core/deps.py`); `usuario.rol` es `RolNombre`.
- **Nuevo modulo:** crear `app/modules/<x>/`, importar sus modelos en `alembic/env.py` y en `tests/conftest.py`, y montar el router en `app/main.py`.
- **Migraciones:** B2 encadena `003_ciudades`... despues de `002_roles` (ver seccion 5.4 del plan).
- **CORS:** configurado para `http://localhost:5173` (`CORS_ORIGINS`).
