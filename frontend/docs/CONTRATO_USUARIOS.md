# Contrato Frontend (F1) ⇄ Backend (B1) — módulo Usuarios

Documento de trabajo para cerrar en el **Hito 0 / B1-00**. Lo que dice ✅ ya está construido en el front
con estos nombres exactos; lo marcado 🔜 es **propuesta de F1** para confirmar antes de implementarlo.
Si B1 cambia algo, el ajuste en el front es de un solo archivo (se indica cuál).

## Convenciones generales
| Tema | Acuerdo |
|---|---|
| Base URL | `VITE_API_URL` (por defecto `http://localhost:8000`) |
| CORS | Permitir el origen `http://localhost:5173`, métodos `GET/POST/PUT/PATCH/DELETE`, cabeceras `Authorization, Content-Type` |
| Autenticación | `Authorization: Bearer <JWT>` |
| JWT (claims) | `sub` (id), **`rol`** = `cliente` \| `administrador` \| `root`, `exp` (segundos). Duración 30 min, sin refresh |
| Formato de error | `{ "error": { "code": "STRING", "message": "texto para el usuario", "fields": { "campo": "mensaje" } } }` |
| Nombres de campo | `snake_case`, **idénticos** en formulario, multipart y `error.fields` (así cada error cae en su input) |
| 401 con token | El front cierra la sesión. 401 sin token (login fallido) es un error normal del formulario |

## ✅ POST `/auth/login` — HU1 (`services/authApi.js`)
Request JSON: `{ "identificador": "usuario o correo o id del root", "password": "..." }`

Respuesta 200 (**supuesto actual**): 
```json
{ "access_token": "<jwt>", "rol": "cliente", "usuario": { "nombres": "Ana", "usuario": "ana_g" } }
```
* El front toma el rol **del JWT** (`rol`); el campo `rol` del cuerpo es solo respaldo.
* Para mostrar el nombre en el menú usa `usuario.nombres` → `usuario.nombre` → `usuario.usuario`.
* Credenciales inválidas: **401** (el front muestra siempre "Usuario o contraseña incorrectos", sin revelar cuál falló).
* Administrador pendiente de completar registro: sugerido **403** con `code: "ADMIN_PENDIENTE"` y un `message` claro (el front muestra el `message`).

## ✅ POST `/auth/registro` — HU4 (`features/usuarios/api.js`)
**`multipart/form-data`** (por la foto). Todos obligatorios salvo `imagen`.

| Campo | Regla que ya valida el front (`features/usuarios/validators.js`) |
|---|---|
| `dni` | solo dígitos, 5–15 |
| `nombres`, `apellidos` | letras (tildes, espacios, `'`, `-`), máx. 60 |
| `fecha_nacimiento` | `YYYY-MM-DD`, no futura, ≥ 1900-01-01 |
| `lugar_nacimiento` | máx. 80 |
| `direccion_facturacion` | máx. 150 |
| `genero` | `femenino` \| `masculino` \| `otro` ← **confirmar el enum** |
| `correo` | email válido, máx. 120 |
| `usuario` | 4–20, `[A-Za-z0-9._]` |
| `password` | 8–64, al menos una letra y un número (no se recorta) |
| `imagen` | opcional, JPG/PNG, ≤ 2 MB (D10) |

* Éxito: **201** (cuerpo libre). El front muestra aviso y lleva a `/login` (no hay auto-login).
* Duplicados: **409** con `error.fields`, p. ej. `{ "correo": "Este correo ya está registrado", "usuario": "Ese usuario ya existe", "dni": "..." }`.
* Validación: **422** con el mismo formato (`fields`). El front entiende también el 422 nativo de FastAPI como respaldo.
* Las reglas del front son espejo: **el backend es la autoridad** y puede ser más estricto.

## ✅ GET `/me` — HU2 (`features/usuarios/api.js`)
Autenticado. Respuesta (**supuesto actual**):
```json
{ "id": 7, "rol": "cliente", "dni": "11111", "nombres": "María José", "apellidos": "Gómez Ríos",
  "fecha_nacimiento": "1998-05-10", "lugar_nacimiento": "Pereira", "direccion_facturacion": "Cra 8 # 20-15",
  "genero": "femenino", "correo": "usuario@123.com", "usuario": "maria.j",
  "imagen_url": "/uploads/7.png", "correo_pendiente": null }
```
* **Root**: basta con `{ "id": "root", "rol": "root", "usuario": "root" }` (el front solo muestra Id y contraseña).
* `imagen_url` puede ser ruta relativa (el front antepone `VITE_API_URL`) o URL absoluta. `null` si no hay foto.
* `correo_pendiente`: correo nuevo aún sin verificar (o `null`). El front lo muestra como aviso.

## ✅ PUT `/me` — HU2 (**multipart/form-data**)
Dos usos sobre la misma ruta; todos los campos son opcionales:

| Uso | Campos enviados |
|---|---|
| Editar datos | `nombres, apellidos, fecha_nacimiento, lugar_nacimiento, direccion_facturacion, genero` + `imagen` opcional |
| Cambiar correo (D8) | `correo_nuevo` + `password_actual` |

* **Nunca** se envían `dni`, `usuario` ni `correo` en la edición de datos (el documento es inmutable, R14).
* Cambio de correo: **202**. El backend manda el enlace al correo **nuevo**; el correo no cambia hasta confirmarlo.
  Contraseña incorrecta → 400/422 con `fields.password_actual`. Correo ya usado → 409 con `fields.correo_nuevo`.
* Tras guardar, el front vuelve a pedir `GET /me` (el backend es la fuente de verdad).

## ✅ PUT `/me/password` — HU3 (JSON)
`{ "password_actual": "...", "password_nueva": "..." }` → 200.
Actual incorrecta → 400/422 con `fields.password_actual`. Misma política de contraseña que el registro (8–64, letras y números).
La confirmación de la nueva contraseña se valida solo en el front (no se envía).

## ✅ Root — administradores · HU23 (`features/usuarios/api.js`) · solo rol `root`
| Método | Ruta | Request | Respuesta |
|---|---|---|---|
| GET | `/root/administradores` | — | `[{ id, nombre, correo, estado: "activo" \| "pendiente", imagen_url }]` (también acepta `{ items: [...] }`) |
| POST | `/root/administradores` | JSON `{ nombre, correo }` | 201. Crea el admin en estado `pendiente` y envía el correo con el enlace. Correo repetido → **409** con `fields.correo` |
| DELETE | `/root/administradores/{id}` | — | 204. Si estaba `pendiente`, su enlace deja de funcionar |

No hay edición (R21). El front pide confirmación antes de eliminar.

## ✅ Primer ingreso del administrador · HU23 / D6 · público (sin sesión)
El correo trae un enlace al **front**: `{FRONTEND_URL}/completar-registro?token=<token>` (un solo uso, vence en 48 h).

| Método | Ruta | Request | Respuesta |
|---|---|---|---|
| GET | `/auth/completar-registro?token=…` | — | 200 `{ correo, nombre }` para precargar el formulario. **404 / 410 / 400** si venció, ya se usó o no existe (el front muestra "Enlace no válido") |
| POST | `/auth/completar-registro` | multipart: **mismos campos del registro de cliente** + `token` | 201; el admin pasa a `activo`. El front no hace auto-login: lleva a `/login` |

* El `correo` viaja en el formulario (campo bloqueado) por compatibilidad, pero **el backend debe usar el del token**.
* Misma validación que el registro; errores por campo en `error.fields`.

## ✅ Root — matriz de roles · HU24 / P2 (`GET` y `PUT /root/roles`) · solo rol `root`
Las columnas de la matriz salen de `modulos`: **un módulo nuevo aparece sin tocar el front**.
```json
{ "modulos": [ { "id": "vuelos", "nombre": "Vuelos" }, { "id": "reservas", "nombre": "Reservas y compras" } ],
  "roles": [
    { "id": "root", "nombre": "Root", "descripcion": "Control total", "editable": false,
      "modulos": { "vuelos": true, "reservas": false } },
    { "id": "cliente", "nombre": "Cliente", "descripcion": "Reservas y compras", "editable": true,
      "modulos": { "vuelos": false, "reservas": true } } ] }
```
* Los 4 roles son fijos (no se crean ni eliminan). `editable: false` bloquea la fila en el front (**el root no puede quitarse su propio acceso**; el backend debe impedirlo también).
* `PUT /root/roles` con **solo los roles que cambiaron**, cada uno con su mapa completo:
  `{ "roles": [ { "id": "cliente", "modulos": { "vuelos": true, "reservas": true } } ] }` → 200. El front vuelve a pedir `GET`.
* El cambio debe aplicarse **de inmediato** en `require_roles` (criterio de HU24).

## 🔜 Pendiente de acordar
La verificación del cambio de correo (D8) y las preguntas de abajo. El resto de tareas de F1 ya está construido contra este contrato.

## Para B2 (plantillas de correo, B2-03)
| Correo | Enlace que debe contener |
|---|---|
| Invitación de administrador | `{FRONTEND_URL}/completar-registro?token=<token>` — vence en 48 h, un solo uso |
| Verificación de correo nuevo (D8) | pendiente: ver pregunta 6 |

`FRONTEND_URL` en desarrollo: `http://localhost:5173`.

## Preguntas abiertas para B1 (responder en B1-00)
1. ¿Forma exacta de la respuesta de `/auth/login`? (hoy asumida arriba)
2. ¿Enum de `genero`?
3. ~~¿Cómo recibe el administrador el acceso?~~ Propuesta cerrada arriba: enlace al front con `?token=`. **Confirmar** y que B2 use esa URL en la plantilla.
4. ~~¿Estructura de la matriz de roles?~~ Propuesta cerrada arriba (roles × módulos). **Confirmar** los `id` de módulos y qué `require_roles` consulta. El mockup mostraba columnas "Crear/editar" y "Estado": no se implementaron (ver `MOCKUPS.md`).
5. ¿Las imágenes se sirven como URL absoluta (`imagen_url`) o hay que anteponer la base URL? (el front soporta ambas)
6. **Enlace de verificación de correo (D8):** ¿a dónde apunta? Propuesta: a una pantalla del front
   (`/verificar-correo?token=…`) que llama a `POST /me/correo/confirmar { token }`. Necesita decisión de B1 y B2 (plantilla del correo, B2-03);
   F1 construye la pantalla cuando se acuerde.
7. ¿El enlace del administrador (D6) apunta a `/completar-registro?token=…` en el front? (la ruta ya existe como pantalla provisional)
8. **Menú vs. matriz:** si el root desactiva un módulo para un rol, el backend responde 403, pero el front sigue mostrando la entrada de menú
   (las rutas se protegen con el rol, no con la matriz). Propuesta: que `/me` (o el login) devuelva `modulos: ["vuelos", ...]` permitidos
   y el front oculte lo que no corresponda. No bloquea el sprint.
9. Si el root elimina un administrador que tiene sesión activa, ¿se invalida su token? (por ahora seguirá válido hasta expirar).
