# Contrato real: administración de vuelos (HU12–HU14) y noticias (HU11)

Lo que **implementó el backend** (B2-12 … B2-15, escrito en la integración del Sprint 2) y consume el frontend. Reemplaza, para estas dos secciones,
lo que pedía `CONTRATO_SPRINT2.md` §4 y §5. Mismas convenciones de siempre: JWT `Bearer`, `snake_case`, errores `{ "error": { "code", "message", "fields" } }`.
`/admin/*` solo para `administrador`.

## 1. Vuelo en el panel del administrador (`VueloAdminOut`)
Es el `Vuelo` de `CONTRATO_VUELOS.md` más un campo:

| Campo | Qué es |
|---|---|
| `tiquetes_vendidos` | Tiquetes **activos** del vuelo (comprados **o** reservados: ambos retienen cupo). Lo traen `GET /admin/vuelos` (cada ítem), `GET /admin/vuelos/{id}` y las respuestas de editar/cancelar/realizados |

## 2. Editar vuelo — `PUT /admin/vuelos/{id}` (HU12)
```json
{ "fecha": "2027-03-15", "hora": "08:15", "origen": "BOG", "destino": "MDE", "duracion_min": 55, "precio": 280000 }
```
* **`fecha` y `hora` son hora de Colombia**, igual que al programar el vuelo (HU18). *(F1 pedía la hora del aeropuerto de origen; se unificó con HU18 para que
  editar sin cambiar nada no mueva la salida en vuelos que salen del exterior.)*
* El tipo del vuelo (nacional / internacional) **no cambia**; las ciudades se validan con las reglas de HU18 según ese tipo.
* **No se edita `estado`** (pregunta 5 de F1: el estado cambia por cancelar y por el paso automático). Tampoco el código ni los cupos.
* `200` → `VueloAdminOut`. Recalcula `llegada_utc` y conserva los cupos.
* `422 validacion` con `fields` en `fecha`, `hora`, `origen`, `destino`, `duracion_min` (1–1440), `precio` (1–100.000.000).
* `409`, con `message` para mostrar: `vuelo_con_tiquetes` (tiene tiquetes comprados o reservados), `vuelo_sucedido`, `vuelo_realizado`, `vuelo_cancelado`.
* `404 vuelo_no_encontrado`.

## 3. Cancelar vuelo — `PATCH /admin/vuelos/{id}/cancelar` (HU13)
Cuerpo: vacío, `{}` o `{ "motivo": "Cierre del aeropuerto por tormenta" }`.
* Sin tiquetes: pasa a `cancelado`.
* Con tiquetes: **exige `motivo`** (10 a 300 caracteres) → si falta, `422` con `fields.motivo`. *(Respuesta a la pregunta 7: sí se reintegra.)*
  * Tiquetes **comprados**: se cancelan y su valor vuelve a la billetera de cada cliente (sin el límite de 1 hora: lo cancela la aerolínea).
  * Tiquetes **reservados**: se cancelan (no hay dinero que devolver).
  * Los **cupos** vuelven a su valor original y las sillas quedan libres.
* `409`: `vuelo_sucedido`, `vuelo_realizado`, `vuelo_cancelado`. `404` si no existe.
* `200` → `VueloAdminOut` con `estado: "cancelado"`. Un vuelo cancelado ya no se puede reservar ni comprar (`409 vuelo_no_disponible`) y su noticia desaparece.

## 4. Vuelos realizados — `GET /admin/vuelos/realizados` (HU14)
`200 { "total": n, "items": [VueloAdminOut] }` con los vuelos `sucedido` y `realizado`, el más reciente primero (sin paginar).

**Estados automáticos (HU22):** una tarea del servidor (cada 60 s) y esta consulta pasan `programado → sucedido` cuando llega la hora de salida y
`sucedido → realizado` cuando el vuelo aterriza (`llegada_utc`). Editar y cancelar también los ponen al día antes de decidir. El panel `GET /admin/vuelos`
puede mostrar un vuelo como `programado` hasta un minuto después de su hora de salida.

## 5. Noticias (HU11)
| Método y ruta | Quién | Respuesta |
|---|---|---|
| `GET /noticias` | cliente, administrador | `200 { "items": [Noticia] }`, la más reciente primero (máx. 100) |
| `GET /noticias/{id}` | cliente, administrador | `200 Noticia`; `404 noticia_no_encontrada` si no existe o ya no está vigente |
| `GET /noticias/suscripcion` | cliente | `{ "suscrito": false, "correo": "ana@correo.com" }` (`correo` = el de la suscripción o, si no hay, el de la cuenta) |
| `PUT /noticias/suscripcion` | cliente | cuerpo `{ "correo" }` → `{ "suscrito": true, "correo" }`; `422 fields.correo` si no es un correo |
| `DELETE /noticias/suscripcion` | cliente | `204` (idempotente) |
| `POST /admin/noticias` | administrador | `201 Noticia`: publicar una noticia manual y avisar por correo a los suscriptores activos en segundo plano |
| `DELETE /admin/noticias/{id}` | **solo administrador** | `204`; `404 noticia_no_encontrada` si el id no existe. Idempotente. Sin token `401`; cliente/root `403` |

`Noticia`: `{ id, tipo: "vuelo", titulo: null, vuelo_id, origen: { ciudad, codigo }, destino: { ciudad, codigo }, salida, salida_zona, precio, moneda: "COP",
imagen_url: null, publicada_en, vigente_hasta, descuento_pct: null, precio_original: null }`.

* La noticia **se crea sola al programar el vuelo** (`POST /admin/vuelos`) y a los suscritos se les avisa por correo en segundo plano. Al publicar una
  noticia manual (`POST /admin/noticias`) se avisa igual, con el mismo correo (título, contenido, botón «Ver noticias» y enlace para cancelar la suscripción).
  Suscribirse (`PUT /noticias/suscripcion`) solo guarda el correo: **no envía ningún mensaje**. Al arrancar la
  aplicación se crean las de los vuelos programados hace menos de 8 días que aún no tengan (por ejemplo los de ejemplo).
* **Vigencia:** 8 días desde que se publica, y solo mientras el vuelo siga `programado` y no haya salido (RF05, RF06). Los datos (ruta, salida, precio) se leen del
  vuelo al consultar: si el administrador lo edita, la noticia sale actualizada.
* El administrador también puede publicar noticias manuales con `POST /admin/noticias` (`administrador`): `{ titulo?, contenido?, imagen_url?, id_vuelo?, vigente_hasta? }`.
  Con `id_vuelo: null` la noticia no depende de un vuelo: `vuelo_id` sale `null` y solo se rige por `vigente_hasta` y los 8 días de publicación.
* **Eliminar noticia (borrado lógico):** `DELETE /admin/noticias/{id}` marca `eliminada_en` (migración `017_noticia_eliminada`). La noticia deja de aparecer
  en `GET /noticias`, en `GET /noticias/{id}` (ahora `404`) y en los correos a suscriptores: ni al publicarla ni al programar otros vuelos se vuelve a enviar. La fila se conserva a propósito: `publicar_noticias_faltantes`
  no vuelve a crear la noticia automática del vuelo al reiniciar ni en el ciclo de 60 s; borrarla físicamente sí la regeneraría. Solo el rol `administrador`
  ve el botón «Eliminar» y puede llamar al endpoint (root y cliente reciben `403`). Es idempotente: repetir el `DELETE` devuelve `204`.
* **Pendiente (decisión del PO, pregunta 6):** `imagen_url` sale siempre `null` (el front dibuja la portada con los códigos de la ruta). Subir una imagen alusiva
  y las **promociones** (`tipo: "promocion"`, `descuento_pct`, `precio_original`) quedan para la Iteración 4.
