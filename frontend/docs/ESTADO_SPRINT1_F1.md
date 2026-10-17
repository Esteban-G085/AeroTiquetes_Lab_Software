# Estado del Sprint 1 — Frontend 1 (F1)

Actualizado: 15-oct-2026 · Módulos: proyecto base, autenticación, cuenta y panel root.

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
| F1-09 | Pruebas, revisión responsive y checklist | ✅ en el front · ⏳ prueba contra el backend real |

## Calidad medida

| Medida | Resultado |
|---|---|
| Pruebas (Vitest) | **187 pruebas / 22 archivos, 0 fallas** |
| Cobertura | líneas **97 %** · sentencias 95,8 % · funciones 94,5 % · ramas 84,4 % (`npm run test:coverage`) |
| Responsive | 17 pantallas × 6 anchos (320 → 1280 px): **0 desbordes horizontales** |
| Accesibilidad (axe-core, WCAG 2.x A/AA) | **0 violaciones**, incluido contraste de color |
| Áreas de toque | 0 controles menores a 24 px |
| ESLint / build | 0 errores / compila |
| `npm audit` (producción) | 0 vulnerabilidades |

El recorrido de funcionalidades (`npm run e2e`, 33 comprobaciones en Chromium contra un backend simulado) y la auditoría de UI corren en un navegador real: `npm run dev` y, en otra terminal, `npm run audit:ui`
(requiere `pip install playwright && playwright install chromium`; el backend se simula). Vitest usa jsdom y no puede ver
estilos, por eso las dos herramientas se complementan: en esta etapa la auditoría encontró botones tapados por un contenedor
invisible, contrastes bajo AA y controles pequeños que las pruebas unitarias no podían detectar.

## Checklist de terminado (sección 11 del plan) — parte frontend

**HU1 · Iniciar sesión**
- [x] Mensaje de error genérico: ante 400/401/404/422 siempre "Usuario o contraseña incorrectos".
- [x] Interfaz y menú distintos para cliente, administrador y root (menú lateral por rol; el carrito solo para cliente/visitante).
- [x] Rutas protegidas: sin sesión → `/login`; rol sin permiso → 403. El front cierra sesión por inactividad (30 min), al vencer el JWT y ante un 401 con token.
- [ ] ⏳ *Backend (B1):* hash bcrypt, expiración real del token a 30 min, root por defecto tras el primer arranque.

**HU2 · Gestionar perfil**
- [x] Consultar y editar el perfil; el documento no es editable (ni se envía).
- [x] Root solo ve Id y contraseña.
- [x] El correo se cambia únicamente mediante la solicitud de verificación (correo nuevo + contraseña actual); mientras tanto se muestra "pendiente de verificar".
- [ ] ⏳ *Falta acordar* cómo se confirma el enlace de verificación (pregunta 6 del contrato).

**HU3 · Cambiar contraseña**
- [x] Exige la contraseña actual y muestra el rechazo del backend en ese campo. Agrega confirmación de la nueva (no hay "olvidé mi contraseña").
- [ ] ⏳ *Backend:* guardar la nueva con bcrypt.

**HU4 · Registro de cliente**
- [x] Los 9 campos + imagen opcional (JPG/PNG ≤ 2 MB); la fecha de nacimiento no puede ser futura.
- [x] Unicidad: los errores 409 del backend se muestran en el campo correspondiente (DNI, correo, usuario).
- [ ] ⏳ *Backend:* imponer la unicidad y asignar el rol cliente.

**HU23 · Gestionar administradores**
- [x] El root crea con solo nombre y correo; listado con estado (activo/pendiente); eliminar con confirmación; sin edición; solo el root accede.
- [x] Pantalla de primer ingreso (`/completar-registro?token=`): reutiliza los campos del registro y valida enlaces vencidos o ya usados.
- [ ] ⏳ *Backend/B2:* que el correo llegue a Mailpit con el enlace `{FRONTEND_URL}/completar-registro?token=…`.

**HU24 · Gestionar roles**
- [x] Los 4 roles se muestran fijos (no se crean ni eliminan); la matriz es activa y solo se envían los roles modificados; el root no puede quitarse su propio acceso.
- [ ] ⏳ *Backend:* aplicar el cambio de inmediato y restringir realmente el acceso por módulo.

**Definición de terminado común**
- [ ] ⏳ PR revisado por otra persona y CI en verde (el workflow `.github/workflows/frontend-ci.yml` ya corre lint + tests + build).
- [x] Pantalla probada en web y móvil (auditoría de 6 anchos + comparación con los 12 mockups).
- [x] Sin contraseñas ni tokens en logs ni en el repositorio (auditado: un único `console`, solo en desarrollo; el token vive en `sessionStorage`; `.env*` en `.gitignore`).
- n/a Swagger y Postman: son del backend.

## Prueba de humo contra el backend real (cuando B1 publique la API)

Con `VITE_USE_MOCKS=false` y el backend + Mailpit levantados:

1. Registrar un cliente con foto → llega a `/login` con aviso. Repetir con el mismo correo/usuario/DNI → cada error en su campo.
2. Iniciar sesión con clave incorrecta → mensaje genérico. Con la correcta → inicio del cliente.
3. Recargar la página → la sesión se mantiene. Esperar el vencimiento o cerrar la pestaña → vuelve a pedir login.
4. Perfil: editar nombres y foto → se refleja; el documento no aparece editable.
5. Cambiar correo → llega el enlace a Mailpit; el perfil muestra "pendiente".
6. Cambiar contraseña con la actual incorrecta → error en el campo; con la correcta → cerrar sesión e ingresar con la nueva.
7. Entrar como root (id + contraseña por defecto) → perfil con solo Id y contraseña.
8. Root crea un administrador → aparece "pendiente" y llega el correo a Mailpit.
9. Abrir el enlace → formulario con correo bloqueado; completarlo → el admin pasa a "activo" y puede iniciar sesión.
10. Abrir el mismo enlace otra vez → "Enlace no válido".
11. Root elimina un administrador → confirmación y desaparece del listado.
12. Root cambia un permiso en la matriz → se aplica de inmediato en el backend.
13. Con un cliente, abrir `/root/roles` por URL → 403 en pantalla (y 403 del backend si se llama a la API).

## Decisiones pendientes (no bloquean el sprint)

* **Para B1:** las preguntas 1–9 de `CONTRATO_USUARIOS.md` (forma de la respuesta del login, enum de género, enlace de verificación, ids de módulos…).
* **Para B2:** plantillas de correo con las URLs del contrato.
* **Para el PO:** las diferencias entre mockups y plan (`MOCKUPS.md`): matriz de roles activa, confirmación de contraseña, estado "pendiente", contraste de las insignias, campo "usuario o correo" en el login y sin "¿Olvidó su contraseña?".
* **Mejora posible:** que `/me` devuelva los módulos permitidos para ocultar del menú lo que el root desactive.
