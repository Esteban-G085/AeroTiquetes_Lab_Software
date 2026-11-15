# AeroTiquetes - Backend (Usuarios, Vuelos, Busqueda, Compras y Billetera)

FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL. Estructura modular: cada modulo
vive en `app/modules/<nombre>/` con `models · schemas · service · router`, y lo
transversal en `app/core/` (config, db, seguridad, errores, correo, deps, tipos).

| Modulo | Contenido | Responsable |
|---|---|---|
| `usuarios` | Login/JWT, registro, perfil, contrasena, administradores (el root solo crea administradores y gestiona su propio perfil) | B1 |
| `vuelos` | Catalogo de ciudades, programar/consultar vuelos, seeds | B2 |
| `busqueda` | Busqueda publica de vuelos y detalle, historial de busquedas | B2 |
| `financiero` | Billetera (saldo) y tarjetas del cliente (Sprint 2, HU10) | B1 |
| `compras` | Reservar, comprar, cancelar con reintegro e historial (Sprint 2, HU6-HU9) | B1 |

## Levantar en local

```bash
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # ajusta DATABASE_URL y secretos

# PostgreSQL y Mailpit (desde la raiz del repo, donde esta docker-compose.yml)
(cd .. && docker compose up -d)

alembic upgrade head                                   # 001_usuarios -> 009_noticias
uvicorn app.main:app --reload --port 8000
```

- Swagger: http://localhost:8000/docs · Esquema: `/openapi.json`
- Mailpit (invitaciones de admin, codigos de reserva y avisos de reintegro): http://localhost:8025
- Al arrancar se crea el **root por defecto** (`ROOT_ID` / `ROOT_PASSWORD` del `.env`), y se siembra el **catalogo de 37 ciudades** (idempotente). Los 4 roles (`root`, `administrador`, `cliente`, `visitante`) son fijos y viven en el codigo, no en tablas.
- Migraciones: `001_usuarios` -> `002_roles` -> `003_ciudades` -> `004_vuelos` -> `005_busquedas` -> `006_paises` -> `007_quitar_roles` -> `008_compras_financiero` -> `009_noticias`.
  (`007` elimina las tablas `rol` y `rol_modulo`: la gestion de roles no era un requisito. `008` crea billetera, tarjeta, viajero, reserva, compra y tiquete. `009` crea noticia y suscripcion.)
- Reservas vencidas: una tarea del servidor (cada 60 s) libera los cupos de las reservas que pasaron de 24 h; ademas se comprueba al consultar o comprar.

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

Cubren usuarios (auth, perfil, administradores, el root solo con contrasena), vuelos (modelos, migraciones,
seeds, reglas de HU18), busqueda (filtros combinables, orden, detalle, D13/D16),
historial de busquedas, el contrato que consume el frontend y, del Sprint 2, billetera y
tarjetas, reservar/comprar/cancelar/historial (reglas de negocio, reintegros y concurrencia).

## Endpoints

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

### Ciudades, vuelos y busqueda (B2)

| Metodo | Ruta | Acceso | HU |
|---|---|---|---|
| GET | `/ciudades` (query opcional `uso=nacional\|internacional`) | Publico | 5, 18 |
| GET | `/vuelos` (`origen, destino, fecha, precioMin, precioMax, duracionMin, duracionMax, clase, orden, pagina`) | Publico | 5 |
| GET | `/vuelos/{id}` | Publico | 5 |
| GET | `/admin/vuelos` (`estado, origen, destino, pagina`) | Administrador | 19 |
| GET | `/admin/vuelos/{id}` | Administrador | 19 |
| POST | `/admin/vuelos` (`tipo, origen, destino, fecha, hora, duracion, costo`; crea su noticia y avisa a los suscritos) | Administrador | 18, 11 |
| PUT | `/admin/vuelos/{id}` (`fecha, hora, origen, destino, duracion_min, precio`; hora de Colombia) | Administrador | 12 |
| PATCH | `/admin/vuelos/{id}/cancelar` (`motivo` obligatorio si hay tiquetes; reintegra y libera cupos) | Administrador | 13 |
| GET | `/admin/vuelos/realizados` (vuelos `sucedido` y `realizado`) | Administrador | 14 |
| GET | `/noticias` | Cliente, administrador | 11 |
| GET / PUT / DELETE | `/noticias/suscripcion` | Cliente | 11 |

Las rutas `/admin/*` exigen el rol `administrador`. El contrato detallado que consume el frontend esta
en `../frontend/docs/CONTRATO_VUELOS.md` (y `CONTRATO_ADMIN_VUELOS_NOTICIAS.md` para editar, cancelar, realizados y noticias); las colecciones Postman en `postman/`.

### Compra, reserva y billetera (B1, Sprint 2) - solo rol `cliente`

| Metodo | Ruta | HU |
|---|---|---|
| POST | `/reservas` (retiene cupos 24 h) | 6 |
| GET | `/reservas/{id}` | 6, 9 |
| POST | `/reservas/{id}/comprar` (paga una reserva activa con la billetera) | 7 |
| POST | `/reservas/{id}/cancelar` | 8 |
| POST | `/compras` (carrito de uno o varios vuelos, atomico) | 7 |
| GET | `/compras/{id}` | 9 |
| POST | `/compras/{id}/cancelar` (completa o con `tiquete_ids`; hasta 1 h antes; reintegra a la billetera) | 8 |
| GET | `/vuelos/{id}/regreso` (vuelos destino→origen posteriores a la llegada; trayecto completo) | 7 |
| GET | `/vuelos/{id}/mis-tiquetes` (tiquetes activos del cliente en ese vuelo, máx. 5) | 7 |
| GET | `/mi-historial` (`pagina, tamano, tipo=reserva\|compra`) | 9 |
| GET / PUT | `/mi-billetera` (ver saldo / fijar saldo) | 10 |
| POST | `/mi-billetera/agregar-saldo` | 10 |
| GET / POST | `/mi-billetera/tarjetas` | 10 |
| PUT / DELETE | `/mi-billetera/tarjetas/{id}` | 10 |

Contrato completo para el frontend: `../frontend/docs/CONTRATO_COMPRAS.md`. Postman: `postman/AeroTiquetes.postman_collection.json`
(Auth, perfil, administradores, compra y reserva, billetera y tarjetas) y `postman/AeroTiquetes_Vuelos_Busqueda.postman_collection.json`.

## Para integrar con el frontend

- **Error unico:** `{ "error": { "code", "message", "fields" } }`. Lancen `AppError` (`app/core/errors.py`).
- **Proteger rutas:** `Depends(require_roles("administrador"))` (acepta varios roles). Los permisos por rol son fijos; ya no hay matriz de modulos.
- **Usuario actual:** `CurrentUser` (`app/core/deps.py`); `usuario.rol` es `RolNombre`.
- **Nuevo modulo:** crear `app/modules/<x>/`, importar sus modelos en `alembic/env.py` y en `tests/conftest.py`, y montar el router en `app/main.py`.
- **Migraciones:** encadenar despues de `009_noticias`; nunca editar una migracion ya mergeada.
- **Fechas:** se guardan en UTC con `FechaUTC` (`app/core/tipos.py`) y se muestran en la zona de cada ciudad.
- **CORS:** configurado para `http://localhost:5173` y `http://127.0.0.1:5173` (`CORS_ORIGINS`). La comparación es exacta: si el front se abre con otra URL (por ejemplo la de red que muestra Vite), hay que añadir ese origen.
- **Cancelar un vuelo (B2-13):** al cancelar un vuelo, llamar a `app.modules.compras.service.reintegrar_vuelo_cancelado(db, id_vuelo)` para
  cancelar los tiquetes vendidos y devolver el dinero a la billetera de cada cliente (devuelve `{"tiquetes", "reintegrado"}` y hace commit).
- **Dinero:** enteros en COP. El saldo y los tiquetes se modifican con `UPDATE ... WHERE` atomicos (nunca leer-y-escribir), por eso dos compras
  simultaneas no pueden dejar el saldo negativo ni vender el mismo cupo, silla o documento dos veces.
