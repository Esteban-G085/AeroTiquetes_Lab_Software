# Integración Backend B1 ⇄ Frontend F1 — registro de cambios

Se comparó el contrato que F1 dejó en `frontend/docs/CONTRATO_USUARIOS.md` con el backend de B1 y se
ajustó **primero el backend** (aditivo cuando fue posible) para no tocar el código de F1.
Verificación: 43 pruebas de backend, 162 del front y un recorrido de 19 pasos en un navegador real
(Chromium) contra el backend real y el front con `vite`: registro con foto, perfil, cambio de correo con
enlace, cambio de contraseña, invitación de administrador, completar registro, eliminar, matriz de roles y 403.

## Cambios en el BACKEND (B1)

| # | Qué | Por qué | Archivos |
|---|---|---|---|
| 1 | `PUT /me` ahora es **multipart/form-data** (antes JSON). Acepta `nombres, apellidos, fecha_nacimiento, lugar_nacimiento, direccion_facturacion, genero, telefono` y `imagen`. Un campo vacío significa "sin cambio". | El front edita datos y foto en una sola llamada y envía `fecha_nacimiento`, que antes no se podía editar. | `router.py`, `schemas.py` (`PerfilUpdate`), `service.py` (`actualizar_perfil`) |
| 2 | El **cambio de correo** también entra por `PUT /me` con `correo_nuevo` + `password_actual` (responde **202**). `POST /me/correo` (JSON) se conserva. | El front lo llama así. | `router.py` |
| 3 | `GET /me` devuelve además **`imagen_url`** (`/static/perfiles/…`). `imagen_perfil` se conserva. Las rutas con `\` (Windows) se normalizan a `/`. | El front lee `imagen_url`; sin esto la foto no se veía y en Windows la URL quedaba rota. | `schemas.py` (`url_imagen`), `service.py` (`guardar_imagen_perfil`) |
| 4 | `GET /root/administradores` agrega **`nombre`** e **`imagen_url`** (se conservan `nombre_invitacion` y `creado_en`). | El front pinta `nombre` e `imagen_url`. | `schemas.py`, `router.py` |
| 5 | **Nuevo** `GET /auth/completar-registro?token=` → `{correo, nombre}`. 410 si venció o ya se usó, 404 si no existe. No consume el enlace. | La pantalla de primer ingreso del administrador valida el enlace antes de mostrar el formulario. | `router.py`, `service.py` (`validar_invitacion`), `schemas.py` |
| 6 | **`GET/PUT /root/roles` cambió de forma** (rompe la forma anterior): `{modulos:[{id,nombre}], roles:[{id,nombre,descripcion,editable,modulos:{id:bool}}]}` y el PUT recibe `{roles:[{id, modulos:{…}}]}` solo con lo que cambió. `root` es `editable:false` y se rechaza editarlo (400 `rol_no_editable`). | Es la estructura con la que F1 construyó la pantalla; así un módulo nuevo aparece sin tocar el front. | `router.py`, `schemas.py`, `service.py`, `models.py` (`MODULOS_NOMBRES`) |
| 7 | Pruebas y colección de Postman actualizadas a lo anterior (43 pruebas, antes 34). | — | `tests/`, `postman/` |

## Cambios en el FRONTEND (código de F1) — mínimos

Solo se **agregó** una pantalla; no se modificó ninguna existente.

| # | Qué | Archivo |
|---|---|---|
| 1 | **Nueva pantalla** `/verificar-correo?token=…`: confirma el correo nuevo llamando a `POST /auth/verificar-correo`. Es pública (se abre con o sin sesión). Sin ella el enlace del correo de "cambiar correo" no llevaba a ninguna parte (era la pregunta abierta 6 de F1). | `src/features/usuarios/pages/VerificarCorreoPage.jsx` (+ `.test.jsx`) |
| 2 | Función `verificarCorreo(token)` | `src/features/usuarios/api.js` (+ 8 líneas) |
| 3 | Ruta `/verificar-correo` en la lista de rutas del feature | `src/features/usuarios/index.js` (+ 4 líneas) |
| 4 | Respuestas de B1 a las 9 preguntas abiertas | `docs/CONTRATO_USUARIOS.md` (sección nueva al final) |

## Decisiones tomadas / pendientes

* **Administrador pendiente que intenta iniciar sesión:** se deja el 401 genérico (F1 sugería 403 con mensaje). Un mensaje distinto revelaría qué correos están invitados.
* **Contraseña:** el front exige 8–64 con letra y número; el backend acepta desde 6. El front es más estricto, no choca; si se quiere unificar, se sube el mínimo del backend.
* **Fila de root en la matriz:** por defecto tiene activos solo `usuarios` y `busqueda`. Como no es editable, confirmar con el equipo si debe verse todo activo.
* **Menú vs. matriz (pregunta 8 de F1) y token de admin eliminado (pregunta 9):** no se implementaron; no bloquean el sprint.
* Al editar la foto del perfil, el archivo anterior queda en `static/perfiles/` (no se borra).

## Cómo correr todo junto

1. `docker compose up -d` (Postgres + Mailpit) y, en `backend/`: `alembic upgrade head` y `uvicorn app.main:app --reload`.
2. En `frontend/`: `npm ci`, copiar `.env.example` a `.env.local` y `npm run dev` → http://localhost:5173
3. Entrar como root con `ROOT_ID`/`ROOT_PASSWORD` de `backend/.env`. Los correos se ven en http://localhost:8025.
