# Estado del Sprint 1 — Frontend

Actualizado: 21-oct-2026 · Módulos: proyecto base, autenticación, cuenta, panel root, búsqueda y vuelos.

## Tareas

| Tarea | Entregable | Estado |
|---|---|---|
| F1-01 | Proyecto Vite + React + Bootstrap, estructura modular, layout, componentes base | ✅ |
| F1-02 | Axios con JWT, `AuthContext`, cierre por inactividad, rutas protegidas por rol, menú por rol | ✅ |
| F1-03 | Iniciar sesión (HU1) | ✅ |
| F1-04 | Registro de cliente (HU4) | ✅ |
| F1-05 | Gestionar perfil (HU2), incluida la variante root y el cambio de correo con verificación | ✅ |
| F1-06 | Cambiar contraseña (HU3) | ✅ |
| F1-07 | Gestionar administradores + completar registro (HU23) | ✅ |
| F1-08 | Gestionar roles (HU24) | ✅ |
| F1-09 | Pruebas, revisión responsive y checklist | ✅ |
| F2-01 | MSW: *handlers* desde `/openapi.json` para trabajar sin backend | ❌ descartada por el equipo: se trabaja contra los contratos (ver `CONTRATO_VUELOS.md`) |
| F2-02 | Formulario de búsqueda (HU5): criterios combinables según el plan (D14) | ✅ |
| F2-03 | Resultados (HU5): tarjetas completas, orden, paginación y estado vacío | ✅ |
| F2-04 | Detalle del vuelo (HU5) con la compra deshabilitada para el visitante | ✅ |
| F2-05 | Programar vuelo (HU18) con pestañas Nacional/Internacional y selects dependientes | ✅ |
| F2-06 | Consultar vuelo (HU19): listado con filtros + detalle de solo lectura | ✅ |
| F2-07 | Conectar con la API real, pruebas de los filtros y revisión responsive | ✅ |

## Calidad medida

| Medida | Resultado |
|---|---|
| Pruebas (Vitest) | **255 pruebas / 33 archivos, 0 fallas** |
| Cobertura | líneas **96,9 %** · sentencias 94,9 % · funciones 95,5 % · ramas 83,6 % (`npm run test:coverage`) |
| Responsive (pantallas de usuarios) | 17 pantallas × 6 anchos (320 → 1280 px): **0 desbordes horizontales** |
| Responsive (pantallas de vuelos) | La auditoría ya incluye las pantallas de F2 (22 pantallas × 6 anchos, `scripts/audit-ui.py`), pero falta registrar la medición; el punto a vigilar es la tabla del panel en móvil |
| Accesibilidad (axe-core, WCAG 2.x A/AA) | **0 violaciones** en las pantallas de usuarios, incluido contraste de color |
| Áreas de toque | 0 controles menores a 24 px (pantallas de usuarios) |
| ESLint / build | 0 errores / compila |
| `npm audit` (producción) | 0 vulnerabilidades |

El recorrido de funcionalidades (`npm run e2e`, 33 comprobaciones en Chromium contra un backend simulado) y la
auditoría de UI (`npm run audit:ui`) corren en un navegador real: `npm run dev` y, en otra terminal, el script
(requiere `pip install playwright && playwright install chromium`; el backend se simula). Vitest usa jsdom y no
puede ver estilos, por eso las dos herramientas se complementan: en la etapa de usuarios la auditoría encontró
botones tapados por un contenedor invisible, contrastes bajo AA y controles pequeños que las pruebas unitarias
no podían detectar.

## Checklist de terminado (sección 11 del plan) — parte frontend

**HU1 · Iniciar sesión**
- [x] Mensaje de error genérico: ante 400/401/404/422 siempre "Usuario o contraseña incorrectos".
- [x] Interfaz y menú distintos para cliente, administrador y root (menú lateral por rol; el carrito solo para cliente/visitante).
- [x] Rutas protegidas: sin sesión → `/login`; rol sin permiso → 403. El front cierra sesión por inactividad (30 min), al vencer el JWT y ante un 401 con token.
- [x] *Backend (B1):* hash bcrypt, expiración real del token a 30 min, root por defecto tras el primer arranque.

**HU2 · Gestionar perfil**
- [x] Consultar y editar el perfil; el documento no es editable (ni se envía).
- [x] Root solo ve Id y contraseña.
- [x] El correo se cambia únicamente mediante la solicitud de verificación (correo nuevo + contraseña actual); mientras tanto se muestra "pendiente de verificar".
- [x] El enlace de verificación se confirma en `/verificar-correo?token=…` (pantalla acordada con B1, ver `CAMBIOS_INTEGRACION.md`).

**HU3 · Cambiar contraseña**
- [x] Exige la contraseña actual y muestra el rechazo del backend en ese campo. Agrega confirmación de la nueva (no hay "olvidé mi contraseña").
- [x] *Backend:* guardar la nueva con bcrypt.

**HU4 · Registro de cliente**
- [x] Los 9 campos + imagen opcional (JPG/PNG ≤ 2 MB); la fecha de nacimiento no puede ser futura.
- [x] Unicidad: los errores 409 del backend se muestran en el campo correspondiente (DNI, correo, usuario).
- [x] *Backend:* imponer la unicidad y asignar el rol cliente.

**HU23 · Gestionar administradores**
- [x] El root crea con solo nombre y correo; listado con estado (activo/pendiente); eliminar con confirmación; sin edición; solo el root accede.
- [x] Pantalla de primer ingreso (`/completar-registro?token=`): reutiliza los campos del registro y valida enlaces vencidos o ya usados.
- [x] *Backend/B2:* que el correo llegue a Mailpit con el enlace `{FRONTEND_URL}/completar-registro?token=…`.

**HU24 · Gestionar roles**
- [x] Los 4 roles se muestran fijos (no se crean ni eliminan); la matriz es activa y solo se envían los roles modificados; el root no puede quitarse su propio acceso.
- [x] *Backend:* aplicar el cambio de inmediato y restringir realmente el acceso por módulo.

**HU5 · Buscar y consultar vuelos**
- [x] Criterios combinables: origen, destino, fecha, rango de precio, rango de duración y clase. **Sin** filtro de aerolínea (D14) y sin ocultar vuelos por falta de cupo: la disponibilidad por clase se advierte y el filtro de clase solo la destaca (D13).
- [x] Resultados con la información completa que pide la historia (código, ruta, salida y llegada **en hora local del destino**, duración, costo y disponibilidad por clase), orden por salida/duración/precio, paginación y estado vacío ("no existen vuelos").
- [x] Detalle del vuelo en `/vuelos/:id`; al visitante se le invita a registrarse en lugar de dejarlo comprar (la compra es de la Iteración 2).
- [x] *Backend (B2):* `GET /ciudades`, `GET /vuelos` y `GET /vuelos/{id}` según `docs/CONTRATO_VUELOS.md`.

**HU18 · Programar vuelo**
- [x] Pestañas Nacional/Internacional con selects dependientes: en internacional, al elegir el origen, el destino solo ofrece el grupo opuesto (y en cualquier sentido, P1).
- [x] Solo se digitan fecha, hora, origen, destino, duración y costo; el código, la llegada y los cupos los genera el backend (el formulario muestra una vista previa de lo que enviará).
- [x] Validación en pantalla y errores por campo del backend (`ApiError.fields`).
- [x] *Backend (B2):* `POST /admin/vuelos`, con código consecutivo `AT-####`, llegada en zona del destino y cupos por tipo (nacional 125/25, internacional 200/50).

**HU19 · Consultar vuelo**
- [x] Listado con filtros y detalle de solo lectura: código, estado, llegada, cupos por clase y fecha de programación.
- [x] Sin "Guardar vuelo" ni "Cancelar" (la pantalla es solo lectura, `Plan_Sprint_1.md` §10.3).
- [x] *Backend (B2):* `GET /admin/vuelos` y `GET /admin/vuelos/{id}`.

**Definición de terminado común**
- [x] CI configurado y ejecutado en los PR integrados (`.github/workflows/frontend-ci.yml`: lint + pruebas + build).
- [x] Pantalla probada en web y móvil (auditoría de 6 anchos + comparación con los mockups de usuarios; las pantallas de vuelos se auditan en la revisión de armonía visual).
- [x] Sin contraseñas ni tokens en logs ni en el repositorio (auditado: un único `console`, solo en desarrollo; el token vive en `sessionStorage`; `.env*` en `.gitignore`).
- n/a Swagger y Postman: son del backend.

**Nota sobre los mockups:** solo se extrajeron imágenes de HU1–HU4, HU23 y HU24. Las historias de vuelos no tienen
mockup, así que su referencia visual es `docs/DISENO.md` §5 y las correcciones acordadas están en `docs/MOCKUPS.md`.

## Prueba de humo contra el backend real

> Verificado contra el backend real (PostgreSQL + Mailpit) con B1 y B2 publicados: los 170 tests del backend pasan y
> el recorrido de búsqueda y vuelos (abajo) funciona de punta a punta. Los 13 pasos de esta lista son el guion para
> repetirlo a mano en el navegador.

Con el backend y Mailpit levantados:

1. Registrar un cliente con foto → llega a `/login` con aviso. Repetir con el mismo correo/usuario/DNI → cada error en su campo.
2. Iniciar sesión con clave incorrecta → mensaje genérico. Con la correcta → inicio del cliente.
3. Recargar la página → la sesión se mantiene. Esperar el vencimiento o cerrar la pestaña → vuelve a pedir login.
4. Perfil: editar nombres y foto → se refleja; el documento no aparece editable.
5. Cambiar correo → llega el enlace a Mailpit; el perfil muestra "pendiente"; abrir el enlace → correo verificado.
6. Cambiar contraseña con la actual incorrecta → error en el campo; con la correcta → cerrar sesión e ingresar con la nueva.
7. Entrar como root (id + contraseña por defecto) → perfil con solo Id y contraseña.
8. Root crea un administrador → aparece "pendiente" y llega el correo a Mailpit.
9. Abrir el enlace → formulario con correo bloqueado; completarlo → el admin pasa a "activo" y puede iniciar sesión.
10. Abrir el mismo enlace otra vez → "Enlace no válido".
11. Root elimina un administrador → confirmación y desaparece del listado.
12. Root cambia un permiso en la matriz → se aplica de inmediato en el backend.
13. Con un cliente, abrir `/root/roles` por URL → 403 en pantalla (y 403 del backend si se llama a la API).

### Búsqueda y vuelos (B2 publicado)

1. `GET /ciudades` responde → los selects muestran el catálogo del backend (desaparece el aviso "catálogo local").
2. Buscar sin filtros → salen los vuelos programados con salida futura; ninguno se oculta por falta de cupo (D13).
3. Combinar filtros (origen, destino, fecha, precio, duración, clase) y ordenar por precio y por duración.
4. Abrir el detalle como visitante → datos completos, llegada en hora local del destino, "+1" si cruza de día, y la invitación a registrarse.
5. `/admin/vuelos` con administrador → panel con filtros; con cliente → 403 en pantalla.
6. Programar un vuelo nacional → código `AT-####`, llegada calculada y cupos 125/25; aparecer en el listado.
7. Programar un vuelo internacional (una ciudad colombiana del grupo y una del exterior) → cupos 200/50.
8. Forzar un error de validación del backend (por ejemplo, fecha pasada) → el mensaje sale en su campo.
9. Consultar el vuelo desde el panel → ficha de solo lectura con código, estado, llegada, cupos y fecha de programación.

## Decisiones pendientes (no bloquean el sprint)

* **Para B2 (respondido):** las preguntas 1–6 de `CONTRATO_VUELOS.md` ya tienen respuesta (sección «Respuestas de B2» del contrato): forma de `Vuelo`, alcance del filtro de fecha, catálogo de ciudades, detalle por `id`, estados y orígenes internacionales.
* **Para B2 (hecho):** las plantillas de correo con las URLs del contrato ya están en el backend (`app/core/email.py`); la invitación llega a Mailpit con el enlace de primer ingreso.
* **Roles y rutas de vuelos:** la ruta `/` declara visitante y cliente, y `/admin/vuelos` solo administrador, mientras que la matriz de roles por defecto le da al root los módulos `usuarios` y `búsqueda`. Decidir si el root debe poder buscar vuelos y entrar al panel (hoy el backend le responde **403** en `/admin/vuelos`).
* **Para el PO:** las diferencias entre mockups e historias (`MOCKUPS.md`), ahora incluidos el filtro de aerolínea de HU5/HU18 y el "solo lectura" de HU19.
* **Mejora posible:** que `/me` devuelva los módulos permitidos para ocultar del menú lo que el root desactive.
* **Armonía visual:** hecha en la Parte 10 del `CHANGELOG.md` (esqueletos de carga, tabla responsive en móvil, franja de marca en el buscador y el detalle, y un único botón «Volver»). Queda registrar la medición de la auditoría responsive de esas pantallas.
