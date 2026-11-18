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

# PostgreSQL (desde la raiz del repo). Mailpit es opcional, solo para probar correos sin internet.
(cd .. && docker compose up -d)

alembic upgrade head                                   # 001_usuarios -> 017_noticia_eliminada
uvicorn app.main:app --reload --port 8000
```

- Swagger: http://localhost:8000/docs · Esquema: `/openapi.json`
- Correo: **Gmail por defecto** (`smtp.gmail.com:587`, STARTTLS). La app valida al arrancar que haya usuario, contrasena de aplicacion y TLS. Mailpit (http://localhost:8025) queda como alternativa explicita para pruebas locales.
- Al arrancar se crea el **root por defecto** (`ROOT_ID` / `ROOT_PASSWORD` del `.env`), y se siembra el **catalogo de 37 ciudades** (idempotente). Los 4 roles (`root`, `administrador`, `cliente`, `visitante`) son fijos y viven en el codigo, no en tablas.
- Migraciones (cadena real, `alembic history`): `001_usuarios` -> `002_roles` -> `003_ciudades` -> `004_vuelos` -> `005_busquedas` -> `006_paises` -> `007_noticias` -> `008_compras_financiero` -> `007_quitar_roles` -> `009_costo_primera` -> `010_noticia_contenido` -> `011_asientos` -> `012_noticia_vuelo_opcional` -> `013_modelado_noticias` -> `014_sillas_texto` -> `015_bandeja_salida` -> `016_movimientos_billetera` -> `017_noticia_eliminada`.
  (`007_noticias` crea noticia, suscripcion, mensaje y respuesta; `008` crea billetera, tarjeta, viajero, reserva, compra y tiquete; `007_quitar_roles` elimina las tablas `rol` y `rol_modulo` porque la gestion de roles no era un requisito; `009` agrega `costo_primera`; `011` crea el mapa de asientos; `014` unifica `numero_silla` como texto; `015` crea la bandeja de salida de correos; `016` crea la auditoria interna de movimientos de billetera; `017` agrega `noticia.eliminada_en` para el borrado logico de noticias.)
- Reservas vencidas: una tarea del servidor (cada 60 s) libera los cupos de las reservas que pasaron de 24 h; ademas se comprueba al consultar o comprar.

## Correo electrónico (Gmail por defecto)

El sistema envía correos para:
- Invitación de administrador (HU23) — `POST /root/administradores`
- Verificación de cambio de correo (HU2) — `POST /me/correo`
- Códigos de reserva y avisos de reintegro (Sprint 2)

### Configuración por defecto: Gmail

`.env.example` y los defaults de `app/core/config.py` apuntan a `smtp.gmail.com:587` con STARTTLS.
Al arrancar, `lifespan` llama a `settings.validar_correo()`: si el host es remoto exige `SMTP_USER`,
`SMTP_PASSWORD` y TLS/SSL; si falta algo, el arranque falla con un mensaje que nombra las variables
(nunca muestra la contraseña). El log de arranque indica host, puerto y si hay usuario configurado.

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_correo@gmail.com
SMTP_PASSWORD=xxxxxxxxxxxxxxxx   # contraseña de aplicación, NO la contraseña normal
SMTP_FROM=tu_correo@gmail.com
SMTP_USE_TLS=true
SMTP_USE_SSL=false
```

> **Gmail:** requiere verificación en 2 pasos y una [contraseña de aplicación](https://myaccount.google.com/apppasswords)
> de 16 caracteres sin espacios. `SMTP_USER` y `SMTP_FROM` deben ser el mismo Gmail que la generó.

### Alternativa solo para pruebas: Mailpit

Sin internet o para inspeccionar los correos, descomenta el bloque de Mailpit en `.env.example` y
comenta el de Gmail:

```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=no-responder@aerotiquetes.local
SMTP_USE_TLS=false
```

`validar_correo()` omite la validación cuando el host es `localhost`, `127.0.0.1`, `::1` o `mailpit`.
Levanta la bandeja con `docker compose up -d` desde la raíz y abre http://localhost:8025.

> **Tolerante a fallos:** si el envío falla pese a la configuración válida, el correo queda en
> `notificacion_pendiente` y un worker lo reintenta cada 30 s. La compra o la invitación no se tumban
> por un error SMTP; el código de cancelación nunca se pierde. Las pruebas usan un SMTP local falso
> y reemplazan el envío por un stub, así que nunca sale correo real de la suite.

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
| POST | `/admin/noticias` | Administrador | 11 |
| DELETE | `/admin/noticias/{id}` (borrado lógico) | Administrador | 11 |

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
- **Migraciones:** encadenar despues de `017_noticia_eliminada` (`alembic heads` debe tener una sola cabeza); nunca editar una migracion ya mergeada.
- **Fechas:** se guardan en UTC con `FechaUTC` (`app/core/tipos.py`) y se muestran en la zona de cada ciudad.
- **CORS:** configurado para `http://localhost:5173` y `http://127.0.0.1:5173` (`CORS_ORIGINS`). La comparación es exacta: si el front se abre con otra URL (por ejemplo la de red que muestra Vite), hay que añadir ese origen.
- **Cancelar un vuelo (B2-13):** al cancelar un vuelo, llamar a `app.modules.compras.service.reintegrar_vuelo_cancelado(db, id_vuelo)` para
  cancelar los tiquetes vendidos y devolver el dinero a la billetera de cada cliente (devuelve `{"tiquetes", "reintegrado"}` y hace commit).
- **Dinero:** enteros en COP. El saldo y los tiquetes se modifican con `UPDATE ... WHERE` atomicos (nunca leer-y-escribir), por eso dos compras
  simultaneas no pueden dejar el saldo negativo ni vender el mismo cupo, silla o documento dos veces.
