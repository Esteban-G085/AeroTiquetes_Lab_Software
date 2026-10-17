# Mockups de las historias y decisiones de diseño

> **Actualización (oct-2026):** el aspecto visual fue rediseñado por completo (ver `DISENO.md`). Los mockups de este documento
> quedan como referencia de **funciones y estructura**, no de estilo.

Imágenes en `docs/mockups/` (extraídas de `Historias_de_Usuario.docx`).

**Solo se extrajeron imágenes de HU1, HU2, HU3, HU4, HU23 y HU24.** Para las historias de vuelos (HU5, HU18 y
HU19) no hay imagen en `docs/mockups/`: su referencia visual es `DISENO.md` y las correcciones que se acordaron con
el PO están en `Plan_Sprint_1.md` §10.3 (tabla "Diferencias" al final de este documento).

| HU | Pantalla | Ruta | Layout | Estado |
|----|----------|------|--------|--------|
| 1 | Iniciar sesión | `/login` | `bare` | ✅ F1-03 |
| 2 | Gestionar perfil | `/perfil` | `bare` | ✅ F1-05 |
| 3 | Cambiar contraseña | `/perfil/password` | `bare` (mismo marco del perfil) | ✅ F1-06 |
| 4 | Registro de cliente | `/registro` | `bare` | ✅ F1-04 |
| 23 | Gestionar administradores | `/root/administradores` | con barra | ✅ F1-07 |
| 23 | Completar registro del administrador (sin mockup propio) | `/completar-registro?token=` | `bare` | ✅ F1-07 |
| 24 | Gestionar roles | `/root/roles` | con barra | ✅ F1-08 |
| 5 | Buscar vuelos · detalle del vuelo (**sin mockup**) | `/` · `/vuelos/:id` | con barra | ✅ F2-02…F2-04 |
| 18 | Programar vuelo (**sin mockup**) | `/admin/vuelos/nuevo` | con barra | ✅ F2-05 |
| 19 | Consultar vuelo (**sin mockup**) | `/admin/vuelos` · `/admin/vuelos/:id` | con barra | ✅ F2-06 |

Ver `DISENO.md` §5 para las pantallas de vuelos y sus piezas.

## Diferencias entre mockup y plan (decididas aquí; informar al PO)
| Historia | Mockup | Se implementó | Motivo |
|----------|--------|---------------|--------|
| HU1 | Campo "Escribe un correo electrónico" | "Escribe tu usuario o correo electrónico" | D1: el root entra con su Id y el login acepta usuario o correo |
| HU1 | Enlace "¿Olvidó su contraseña?" | Oculto | D9: fuera de alcance |
| HU4 (móvil) | La foto de perfil se solapa con "Nombres" | Sin solape | Defecto del dibujo |
| HU4 | Etiqueta "DNI"; subtítulo "Registrarse como Usuario" | "Documento (DNI)"; "Registrarse como cliente" | Claridad y coherencia con el rol |
| HU4 | Sin ayuda en contraseña ni enlace a login | Pista "Mín. 8, con letras y números" y enlace "¿Ya tienes cuenta?" | Sin barra superior no habría forma de volver al login |
| HU4 | Campo "género" sin opciones | Femenino / Masculino / Otro | Enum por confirmar con B1 |
| HU23/24 | HU23 usa barra con ☰; HU24 usa otra con logo y "ROOT" | Barra con ☰ en ambos | Consistencia: el root necesita el menú para moverse entre paneles |
| HU2 | Solo dos campos: "cambio de correo" y "cambio de contraseña" | Además, sección "Datos personales" (lectura) que se edita con el lápiz junto al nombre | La HU dice "consultar y editar el perfil"; el lápiz del mockup no tenía otra función |
| HU2 | Botones Cancelar / Guardar cambios siempre visibles | Aparecen solo al editar | Evita botones sin efecto |
| HU2 | Un campo de correo editable | Correo de solo lectura + botón "Cambiar correo" (diálogo con correo nuevo + contraseña actual) | D8: el correo cambia solo tras verificar un enlace |
| HU2 | — | Root: solo Id y contraseña | Observación de la HU |
| HU3 | Dos campos: actual y nueva | Se agrega "Confirmar nueva contraseña" | D9: sin "olvidé mi contraseña", un error de tecleo dejaría al usuario sin acceso |
| HU24 | Tabla solo de lectura | Controles activos | P2 del PO: la matriz es activa |
| HU23 | Solo estado "ACTIVO" (texto blanco sobre verde) | Se agrega `PENDIENTE` (ámbar) y el texto de las insignias es oscuro | D6 define el estado pendiente; el blanco sobre el verde claro no cumple contraste |
| HU23 | Sin pantalla de primer ingreso | `/completar-registro` reutiliza la tarjeta del registro (HU4) con el correo bloqueado y el nombre precargado | F1-07: "reutiliza los campos del registro de cliente" |
| HU24 | Tabla Rol / Módulos / Crear-editar / Estado, y en móvil "Ver usuarios · Editar permisos" | Matriz roles × módulos con interruptores; en móvil, una tarjeta por rol con sus interruptores | P2: la matriz es activa. Las columnas salen del backend. Root bloqueado ("No editable") |
| HU24 | Barra propia (logo + "ROOT") | Barra estándar con menú ☰ | Consistencia con HU23 |
| HU5 | Incluye filtro de **Aerolínea** | Sin filtro de aerolínea | `Plan_Sprint_1.md` §10.3 · D14: los filtros son origen, destino, fecha, precio, duración y clase |
| HU18 | Incluye **Aerolínea**, **Número de vuelo** y **Asientos disponibles**; sin **Duración** | Solo fecha, hora, origen, destino, duración y costo; el resto lo genera el backend | `Plan_Sprint_1.md` §10.3: el código, la llegada y los cupos no se digitan. La imagen alusiva queda para la Iteración 2 |
| HU19 | Tabla con "Guardar vuelo" y "Cancelar"; cupos 180 en un vuelo internacional | Solo lectura (código, estado, llegada, cupos por clase y fecha de programación); cupos 125/25 nacional y 200/50 internacional | `Plan_Sprint_1.md` §10.3 · D13 |
