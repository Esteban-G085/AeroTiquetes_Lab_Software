# Sprint 2 · Parte de B1 — registro de cambios

> La unión con el Sprint 1 final y el frontend de F1 está en [`CAMBIOS_INTEGRACION_SPRINT2.md`](./CAMBIOS_INTEGRACION_SPRINT2.md) (303 pruebas de backend, 386 de frontend).

Autor: B1 (Jhon Felipe Loaiza Restrepo). Este documento lista **todo** lo que se añadió, lo que se retiró y **cada cambio hecho en código
de otros** (B2 y F1), para que se pueda revisar en el PR sin sorpresas.

## 1. Qué se construyó (HU6 – HU10)

| Tarea | Entregable | Dónde |
|---|---|---|
| B1-11 | Modelos y migración: billetera, tarjeta, viajero, reserva, compra, tiquete | `app/modules/financiero/models.py`, `app/modules/compras/models.py`, `alembic/versions/008_compras_financiero.py` |
| B1-12 | `POST /reservas` (retiene cupos 24 h) + `GET /reservas/{id}` | `compras/router.py`, `compras/service.py` |
| B1-13 | `POST /compras` (carrito completo, paga con la billetera) + `POST /reservas/{id}/comprar` | idem |
| B1-14 | `POST /reservas/{id}/cancelar`, `POST /compras/{id}/cancelar` (completa o por `tiquete_ids`, con reintegro) | idem |
| B1-15 | `GET /mi-historial` (paginado, filtro `tipo`) | idem |
| B1-16 | `GET/PUT /mi-billetera`, `POST /mi-billetera/agregar-saldo`, CRUD de `/mi-billetera/tarjetas` | `app/modules/financiero/` |
| B1-17 | Correos reales por SMTP: código de reserva/compra por viajero y aviso de reintegro | `compras/notificaciones.py`, `core/email.py` |
| B1-18 | Pruebas pytest | `tests/test_compras.py` (70), `tests/test_billetera.py`, `tests/test_root_perfil.py` |

Contrato para el frontend: [`frontend/docs/CONTRATO_COMPRAS.md`](./frontend/docs/CONTRATO_COMPRAS.md). Postman:
`backend/postman/AeroTiquetes.postman_collection.json` (se renombró desde `AeroTiquetes_Usuarios…`; ahora incluye carpetas de compra/reserva y billetera).

## 2. Se retira la gestión de roles (HU24)

Era un malentendido: **el root solo crea administradores y gestiona su propio perfil**. Se quitó todo lo de la matriz de roles y no se tocó
lo que sí era del root (login, contraseña, crear/listar/eliminar administradores).

### Backend (código de B1)
* `usuarios/models.py`: fuera `Rol`, `RolModulo`, `MODULOS_SISTEMA` y los catálogos de roles. Los 4 roles son constantes del código.
* `usuarios/service.py`, `router.py`, `schemas.py`: fuera `GET/PUT /root/roles` y su servicio/esquemas.
* `core/deps.py`: `require_roles(*roles)` ya no recibe `modulo=` (no hay matriz que consultar). Ya no existe el 403 `modulo_desactivado`.
* `main.py`: el arranque ya no siembra roles; sí sigue sembrando root y ciudades.
* `alembic/versions/007_quitar_roles.py`: elimina `rol_modulo`, `rol` y el enum. `downgrade` los recrea.
* **Perfil del root:** el root ahora solo puede cambiar su **contraseña**. `PUT /me` y `POST /me/correo` le responden **403 `root_solo_password`**
  (el root no tiene datos de cliente que editar). Pruebas en `tests/test_root_perfil.py`.
* Pruebas: se borró `tests/test_roles.py`; se ajustaron `test_migraciones.py` (cadena hasta 008) y `test_contrato_vuelos.py`.

### Código de B2 (cambio mínimo, a revisar)
* `backend/app/modules/vuelos/router.py`: `require_roles("administrador", modulo="administracion_vuelos")` → `require_roles("administrador")`
  (la línea `_SOLO_ADMIN` y la del `Depends` de la línea 91). No cambia ninguna otra lógica.
* `backend/tests/test_contrato_vuelos.py`: la prueba "si el root desactiva el módulo, el administrador pierde el acceso" se reemplazó por
  "el administrador accede a /admin/vuelos" (la anterior llamaba a `/root/roles`).
* `backend/tests/test_seeds_vuelos.py`: solo un docstring ("junto al root y la matriz de roles" → "junto al root").

### Código de F1 (cambio mínimo, a revisar)
* **Borrados:** `features/usuarios/pages/RolesPage.jsx` y su prueba, `components/RolesMatrix.jsx`, `utils.js` y `utils.test.js` (solo servían a la matriz).
* `features/usuarios/index.js`: sin la ruta `/root/roles`. `api.js` / `api.test.js`: sin `getRoles` / `updateRoles`.
* `usuarios.css`: sin los estilos de la matriz (quedó en 139 líneas).
* `features/features.test.js`, `routes/AppRouter.test.jsx`, `routes/RouteGuard.test.jsx`: usaban `/root/roles` de ejemplo → ahora `/root/administradores`.
* `scripts/e2e-flows.py` y `scripts/audit-ui.py`: sin el mock ni las pantallas de roles.
* `config/roles.js` **no cambia**: los roles siguen existiendo y las rutas siguen declarando `roles`.

### Documentación actualizada
`README.md`, `backend/README.md`, `Plan_Sprint_1.md` (HU24, B1-09, F1-08 y P2 tachados con nota), `CAMBIOS_INTEGRACION.md` (nota),
`frontend/CHANGELOG.md`, `frontend/docs/{CONTRATO_USUARIOS, CONTRATO_VUELOS, ESTADO_SPRINT1, MOCKUPS}.md`.

## 3. Reglas y decisiones de diseño

| Tema | Decisión |
|---|---|
| Dinero | Enteros en COP. Sin historial de movimientos (RF19) y sin comprobantes (RF20). |
| Reserva | Vigencia de **24 h** o hasta la salida del primer vuelo si falta menos. Una tarea del servidor (cada 60 s) y las consultas liberan los cupos vencidos. |
| Compra | Atómica: o se compra todo el carrito o nada. Paga con el saldo (`402 saldo_insuficiente`). Máx. **5 tiquetes activos por vuelo y cliente**. |
| Viajeros | Todos los datos obligatorios. Un menor de 18 años (a la fecha del vuelo) necesita un adulto en el mismo viaje. Un documento no puede estar dos veces activo en el mismo vuelo. |
| Trayecto completo | Dos tiquetes por viajero (ida y regreso) con el mismo código; el regreso debe volver al origen y salir después de llegar la ida. |
| Cancelar | Hasta **1 h antes** de cada vuelo. Reintegro total a la billetera y cupos de vuelta. Puede ser de toda la compra o de tiquetes sueltos (`tiquete_ids`). |
| Carrito | Vive en el front; `POST /compras` recibe el carrito completo. |
| Sillas | El número se asigna al azar y se guarda en el tiquete (`numero_silla`). La tabla `silla` y el mapa llegan en la Iteración 3. |
| Tarjetas | Simuladas: se guardan completas en la base; la API solo devuelve los últimos 4 dígitos y nunca el código. |
| Concurrencia | Cupos, saldo y cambios de estado con `UPDATE … WHERE` atómicos; unicidad en la base (documento activo por vuelo, código, silla). Los choques se traducen a `409` y se reintenta hasta 3 veces. |
| Errores | Mismo formato `{ "error": { code, message, fields } }` de siempre. |

## 4. Cosas que conviene hablar con el equipo

1. **`POST /reservas/{id}/comprar`** no está en el plan (la HU7 habla solo de comprar un carrito). Se añadió para pagar una reserva sin volver a pedir los datos.
2. **Cancelar un vuelo (B2-13):** B2 debe llamar a `compras.service.reintegrar_vuelo_cancelado(db, id_vuelo)`; devuelve `{"tiquetes": n, "reintegrado": total}`
   y hace commit. Mientras no lo llame, cancelar un vuelo no toca los tiquetes ya vendidos.
3. **RF20 (sin comprobantes) vs. aviso de reintegro:** el correo de cancelación solo informa el monto devuelto; no es un comprobante. Si el cliente (PO) no lo quiere, se quita en `compras/notificaciones.py`.
4. **Tarjetas en claro:** vale para el laboratorio (simulado). Para producción real habría que tokenizar.
5. **`scripts/e2e-flows.py` (F1):** su sección [4] "Registro" ya fallaba antes de este sprint porque "Lugar de nacimiento" pasó a ser un `<select>`
   (catálogo de países, migración 006). No se tocó; el resto de las secciones pasa (25/25).

## 5. Cómo probarlo

```powershell
# 1) Base de datos y correo (desde la raíz del proyecto)
docker compose down -v        # solo si quedó una base vieja; borra los datos locales
docker compose up -d

# 2) Backend (en otra terminal, dentro de backend/ con el entorno virtual activo)
cd backend
alembic upgrade head          # aplica 007 (quita roles) y 008 (compras y billetera)
uvicorn app.main:app --reload
```

Flujo mínimo en Swagger (http://localhost:8000/docs) o Postman: registrar un cliente → login → `POST /mi-billetera/agregar-saldo` →
`POST /reservas` → `POST /reservas/{id}/comprar` → `GET /mi-historial` → `POST /compras/{id}/cancelar` (el saldo vuelve).
Los correos se ven en Mailpit: http://localhost:8025.

## 6. Verificación

* Backend: **271 pruebas pytest** pasan (SQLite por prueba).
* Frontend: **240 pruebas Vitest** pasan, `eslint` sin errores, `audit-ui` sin hallazgos y `e2e-flows` 25/25 en las secciones que no dependen del registro.
* **Migraciones:** `upgrade head` en PostgreSQL real y `downgrade` hasta `base` en las pruebas (SQLite).
* **PostgreSQL real:** 8 compras simultáneas del mismo documento → 1 × 201 y 7 × 409,
  sin errores 500 ni saldo negativo.
