# Contrato de API · Compra, reserva, historial y billetera (Sprint 2 · B1 → F1)

API que implementa B1 para **HU6 Reservar · HU7 Comprar · HU8 Cancelar · HU9 Historial · HU10 Billetera**. Ya está en el
backend; no hay mocks. Todo es **solo para el rol `cliente`**: el administrador y el root reciben **403** (`permiso_denegado`)
y sin token **401** (`no_autenticado`). Los vuelos se obtienen con el contrato de [`CONTRATO_VUELOS.md`](./CONTRATO_VUELOS.md).

## Convenciones

* JSON en `snake_case`. Todas las rutas van con `Authorization: Bearer <token>`.
* **Dinero:** enteros en COP (igual que `vuelo.costo`). No hay centavos.
* **Fechas:** instantes ISO 8601 en UTC (terminan en `Z`); el front las muestra en la zona de cada ciudad, como en vuelos.
* **Error único** (igual que en Sprint 1):
  `{ "error": { "code": "saldo_insuficiente", "message": "…", "fields": { "campo": "detalle" } | null } }`.
  `fields` aparece en errores de validación (422) y en algunos 409; el front lo usa para marcar el campo.
* **El carrito vive en el front.** El backend no guarda carritos: `POST /compras` recibe el carrito completo de una vez
  (uno o varios vuelos, cada uno con sus viajeros) y es **atómico**: o se compra todo o no se compra nada.
* **Cupos y sillas:** al reservar o comprar se descuenta el cupo del vuelo (`cupos_primera` / `cupos_economica` de
  `GET /vuelos/{id}`) y se ocupa la silla elegida (o una disponible si no se indicó). `Asiento` es la fuente de verdad;
  `tiquete.numero_silla` es texto (`"12A"`, no un entero). El mapa visual de selección ya está integrado.
* **Correos:** los códigos de reserva y los avisos de reintegro se envían **en segundo plano** al correo de cada viajero
  por **Gmail SMTP** (`smtp.gmail.com:587`, configurado en `backend/.env`). El front no tiene que hacer nada.

---

## 1. Billetera (HU10)

La billetera se crea con saldo 0 la primera vez que se consulta. **Solo se puede recargar**: no existe edición libre del saldo.
Tampoco hay historial de movimientos visible (RF19) ni comprobantes (RF20); internamente cada recarga, pago o reintegro
queda auditado, sin exponerse en la API.

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| `GET` | `/mi-billetera` | — | `200 { "saldo": 250000 }` |
| `POST` | `/mi-billetera/agregar-saldo` | `{ "monto": 500000, "id_tarjeta": 4 }` | `200 { "saldo": 750000 }` (suma al saldo actual) |

Validaciones: `monto` entero `> 0` y hasta **100.000.000** → `422 validacion` con `fields`.
`id_tarjeta` es **obligatorio**: debe ser una tarjeta propia y vigente del cliente; de lo contrario
**422 `tarjeta_recarga_invalida`** con `fields.id_tarjeta` ("Selecciona una tarjeta registrada." /
"La tarjeta esta vencida."). El backend audita qué tarjeta se usó (`MovimientoBilletera.id_tarjeta`).
**Nunca se envía el CVV** (ni ningún dato del plástico) al recargar. El front deshabilita el botón
cuando el cliente no tiene tarjetas vigentes y preselecciona la primera. `PUT /mi-billetera` ya no
existe (405).

### Tarjetas (crédito o débito)

| Método | Ruta | Respuesta |
|---|---|---|
| `GET` | `/mi-billetera/tarjetas` | `200 { "items": [Tarjeta] }` |
| `POST` | `/mi-billetera/tarjetas` | `201 Tarjeta` |
| `PUT` | `/mi-billetera/tarjetas/{id}` | `200 Tarjeta` (solo cambia los campos enviados) |
| `DELETE` | `/mi-billetera/tarjetas/{id}` | `204` sin cuerpo |

```jsonc
// POST /mi-billetera/tarjetas
{ "tipo": "credito",                   // "credito" | "debito"
  "numero": "4111 1111 1111 1111",     // 13 a 19 dígitos; se aceptan espacios y guiones; DEBE pasar Luhn
  "titular": "Ana Gómez",
  "fecha_expiracion": "12/30",         // MM/AA o MM/AAAA; no puede estar vencida. Se devuelve como "12/2030"
  "codigo": "123" }                    // 3 o 4 dígitos; se pide al registrar/editar, NUNCA al recargar

// Tarjeta (respuesta)  — el número completo y el código NUNCA se devuelven
{ "id": 4, "tipo": "credito", "marca": "Visa", "titular": "Ana Gómez", "fecha_expiracion": "12/2030",
  "ultimos4": "1111", "numero_enmascarado": "**** **** **** 1111" }
```

`marca` se **deriva del número** al leer (Visa, Mastercard, American Express, Discover, Otra): no se
guarda en una columna propia ni se pide al usuario. El número se valida con el algoritmo de Luhn al
dar de alta o editar; `4111 1111 1111 1111` y `5500000000000004` son válidos, `4111 1111 1111 1234`
no. El front replica la comprobación para dar aviso inmediato; el backend es la autoridad.

Errores: `409 tarjeta_duplicada` (mismo número ya registrado, con `fields.numero`), `404 tarjeta_no_encontrada`,
`422 validacion` (número, código o vencimiento inválidos). Una tarjeta de otro cliente responde 404, nunca 403.

> Las tarjetas son **simuladas**: sirven para llenar el formulario de HU10; no se cobra a ninguna. El pago real de una
> compra siempre sale del **saldo de la billetera** (`402 saldo_insuficiente` si no alcanza).

---

## 2. Objeto `Operacion` (reserva o compra)

`POST /reservas`, `POST /compras`, `GET /reservas/{id}`, `GET /compras/{id}`, `POST /reservas/{id}/comprar` y cada elemento
de `/mi-historial` devuelven la misma forma:

```jsonc
{ "tipo": "compra",                 // "reserva" | "compra"
  "id": 12,
  "estado": "pagada",               // reserva: activa | comprada | cancelada | vencida
                                    // compra:  pagada | parcialmente_cancelada | cancelada
  "creada_en": "2026-11-11T15:02:11Z",
  "expira_en": null,                // solo reservas: cuándo se libera si no se paga
  "total": 740000,                  // suma de los precios de los tiquetes
  "id_reserva": null,               // solo compras que nacieron de pagar una reserva
  "tiquetes": [
    { "id": 31,
      "codigo_reserva": "K7M2QX",   // 6 caracteres, único en todo el sistema; se muestra al cliente
      "estado": "comprado",         // reservado | comprado | cancelado | vencido
      "clase": "economica",         // "primera" | "economica"
      "trayecto": "unico",          // "unico" | "completo" | "ida" | "regreso"
      "numero_silla": "12A",        // texto ("fila" + columna); null si ya no está activo
      "precio": 370000,
      "vuelo": { "id": 3, "codigo": "AT-0003", "tipo": "nacional", "estado": "programado",
                 "origen":  { "codigo": "BOG", "nombre": "Bogotá", "pais": "Colombia", "zona_horaria": "America/Bogota" },
                 "destino": { "codigo": "MDE", "nombre": "Medellín", "pais": "Colombia", "zona_horaria": "America/Bogota" },
                 "salida_utc": "2026-11-20T13:00:00Z", "llegada_utc": "2026-11-20T14:00:00Z" },
      "viajero": { "documento": "10000001", "nombres": "Ana", "apellidos": "Gómez", "correo": "ana@example.com" } }
  ] }
```

`vuelo.origen` y `vuelo.destino` tienen la misma forma que en `GET /vuelos` (ver `CONTRATO_VUELOS.md`).

---

## 3. Reservar (HU6)

`POST /reservas` → **201 `Operacion`** (`tipo: "reserva"`, `estado: "activa"`).

Retiene los cupos y las sillas hasta `expira_en` = **24 h** desde ahora, o hasta la salida del primer vuelo si falta menos.
Pasado ese momento la reserva pasa sola a `vencida` y los cupos vuelven (un proceso del servidor lo revisa cada minuto, y además
se comprueba al consultar). Cada viajero recibe por correo su `codigo_reserva`.

### Cuerpo (el mismo de `POST /compras`)

```jsonc
{ "items": [                               // 1 a 10 viajes (el carrito)
    { "trayecto": "unico",                 // "unico" (por defecto) | "completo" (ida y regreso en UN solo ítem)
      "vuelo_id": 3,
      "vuelo_regreso_id": null,            // obligatorio solo si trayecto = "completo"
      "clase": "economica",                // "primera" | "economica"
      "asientos": [41, 42],                // IDs de Asiento de ida, uno por viajero (opcional)
      "asientos_regreso": null,            // IDs de asiento de regreso, uno por viajero
      "viajeros": [                        // 1 a 5 por viaje
        { "documento": "1000-0001",        // se normaliza: sin espacios, puntos ni guiones, en mayúsculas
          "nombres": "Ana", "apellidos": "Gómez",
          "fecha_nacimiento": "1990-04-12",
          "genero": "femenino",
          "telefono": "3001234567", "correo": "ana@example.com",
          "nombre_contacto": "Luis Gómez", "telefono_contacto": "3109876543" } ] } ] }
```

Todos los datos del viajero son obligatorios. `trayecto: "completo"` es **un solo ítem** con `vuelo_id` y `vuelo_regreso_id`,
y crea **dos tiquetes por viajero** (`ida` y `regreso`) que comparten el mismo `codigo_reserva`. Envíe `asientos` y
`asientos_regreso` para elegir silla en cada tramo; el vuelo de regreso debe ir de destino a origen y salir **después** de
que llegue la ida.

### Reglas de negocio y errores

| Regla | Respuesta |
|---|---|
| Vuelo inexistente | `404 vuelo_no_encontrado` |
| Vuelo cancelado o ya salido | `409 vuelo_no_disponible` |
| Regreso que no vuelve al origen, o sale antes de llegar la ida | `422 trayecto_invalido` (`fields.vuelo_regreso_id`) |
| Un menor de 18 años (a la fecha del vuelo) no viaja solo: cada viaje necesita al menos un adulto | `422 menor_viajero_unico` |
| Mismo documento repetido en el mismo vuelo dentro de la solicitud | `422 viajero_duplicado` |
| El documento ya tiene un tiquete activo en ese vuelo (de cualquier cliente) | `409 viajero_duplicado_en_vuelo` |
| Máximo **5 tiquetes activos por vuelo y cliente** (comprados + reservados) | `409 limite_tiquetes_vuelo` |
| No se puede reservar un vuelo donde ya compró (ni comprar sin pagar antes su reserva activa) | `409 compra_y_reserva_simultaneas` |
| No alcanzan los cupos de la clase | `409 sin_cupos` |
| Dos personas toman lo mismo a la vez y se pierde la carrera | `409 conflicto_concurrencia` (el front puede reintentar) |
| Cuerpo mal formado (correo, fechas, campos vacíos…) | `422 validacion` con `fields` |

## 4. Pagar una reserva (HU7)

`POST /reservas/{id}/comprar` (sin cuerpo) → **201 `Operacion`** (`tipo: "compra"`, con `id_reserva`).

Convierte la reserva activa en compra **conservando los mismos tiquetes, sillas y códigos**; descuenta el total de la billetera.
La reserva queda `comprada`. Errores: `402 saldo_insuficiente`, `404 reserva_no_encontrada`, `409 reserva_vencida`,
`409 reserva_cancelada`, `409 reserva_ya_comprada`, `409 vuelo_no_disponible`.

> Este endpoint no estaba en el plan (la HU7 solo habla de comprar un carrito). Se añadió para que el cliente pueda pagar lo que
> reservó sin volver a escribir los datos de los viajeros. Si el front no lo necesita, simplemente no se llama.

## 5. Comprar (HU7)

`POST /compras` con el mismo cuerpo de la sección 3 → **201 `Operacion`** (`tipo: "compra"`, `estado: "pagada"`).

Descuenta el **total del carrito** de la billetera, ocupa las sillas elegidas y envía un correo a cada viajero. Si no alcanza el
saldo: **402 `saldo_insuficiente`** y no se compra nada. Mismas reglas y errores de la sección 3 (excepto `expira_en`, que es `null`).
Ejemplo de carrito con dos vuelos distintos: dos elementos en `items`; el `total` es la suma de todo.

`GET /compras/{id}` y `GET /reservas/{id}` → `200 Operacion` (solo las del cliente; las ajenas responden 404).

## 6. Cancelar (HU8)

Siempre responde `CancelacionOut`:

```jsonc
{ "operacion": { …Operacion… },
  "reintegro": 370000,   // COP devueltos a la billetera (0 si era una reserva)
  "saldo": 620000 }      // saldo de la billetera después del reintegro (null al cancelar una reserva)
```

| Ruta | Qué hace |
|---|---|
| `POST /reservas/{id}/cancelar` | Cancela una reserva **activa**, libera los cupos. `reintegro: 0`, `saldo: null`. Errores: `409 reserva_vencida / reserva_cancelada / reserva_ya_comprada`. |
| `POST /compras/{id}/cancelar` | Cancela **toda** la compra. Sin cuerpo. |
| `POST /compras/{id}/cancelar` con `{ "tiquete_ids": [31, 32] }` | Cancela **solo esos tiquetes** (cancelación parcial). La compra queda `parcialmente_cancelada`, o `cancelada` si ya no queda ninguno activo. |

* Solo se puede cancelar **hasta 1 hora antes** de la salida de cada vuelo: si no, `409 fuera_de_plazo_cancelacion`.
  En una cancelación completa basta con que un tiquete esté fuera de plazo para rechazarla (la operación es atómica).
* El dinero vuelve a la billetera y los cupos al vuelo. Se envía un aviso por correo al titular de la cuenta con el monto
  reintegrado (no es un comprobante, RF20).
* Errores: `404 compra_no_encontrada`, `404 tiquete_no_encontrado` (no es de esa compra o ya estaba cancelado),
  `409 compra_ya_cancelada`.

## 7. Historial (HU9)

`GET /mi-historial?pagina=1&tamano=10&tipo=compra` → `200`

```jsonc
{ "total": 23, "pagina": 1, "tamano": 10,
  "items": [ …Operacion… ] }       // más reciente primero; mezcla reservas y compras
```

* `tipo` es opcional: `reserva` o `compra` (otro valor → 422). `pagina` ≥ 1 y `tamano` entre 1 y 50 (por defecto 10).
* Las reservas vencidas se actualizan antes de responder, así que el estado siempre es el vigente.
* Una reserva que ya se pagó **no aparece sola**: la representa la `compra` que nació de ella (`id_reserva` apunta a la reserva).
  Las reservas `activa`, `cancelada` y `vencida` sí aparecen.

---

## 8. Consultas de apoyo para el formulario de compra

Añadidas en la integración con el frontend (solo `cliente`); viven en el módulo `compras`.

| Método | Ruta | Respuesta |
|---|---|---|
| `GET` | `/vuelos/{id}/mis-tiquetes` | `200 { "vuelo_id": 7, "activos": 2, "maximo": 5, "disponibles": 3 }` — tiquetes activos del cliente en ese vuelo |
| `GET` | `/vuelos/{id}/regreso` | `200 [VueloRegreso]` — vuelos `programado` directos **destino → origen** que salen después de la llegada de `{id}` (y de ahora), ordenados por salida, máx. 50. Cada uno es un `Vuelo` (contrato de vuelos) más `tiquetes_cliente` |

`404 vuelo_no_encontrado` si el vuelo no existe.

## Ejemplos de pantalla → llamada

| Pantalla | Llamadas |
|---|---|
| Detalle de vuelo → "Reservar" / "Comprar" | Formulario de viajeros → `POST /reservas` o `POST /compras` con `items` |
| Carrito (varios vuelos) | El front acumula los `items` y llama a `POST /compras` una sola vez |
| Mi billetera | `GET /mi-billetera`, `GET /mi-billetera/tarjetas` (elegir una vigente), `POST …/agregar-saldo { monto, id_tarjeta }` (solo recargas), CRUD de `/mi-billetera/tarjetas` |
| Mis viajes / historial | `GET /mi-historial` (con `tipo` para las pestañas) |
| Cancelar | `POST /compras/{id}/cancelar` (con o sin `tiquete_ids`) · `POST /reservas/{id}/cancelar` |
| Pagar reserva pendiente | `POST /reservas/{id}/comprar` |
| Formulario de compra | `GET /vuelos/{id}` + `GET /vuelos/{id}/mis-tiquetes`; vuelta: `GET /vuelos/{id}/regreso` |

## Códigos de error de este sprint

| HTTP | `code` |
|---|---|
| 401 / 403 | `no_autenticado` · `permiso_denegado` |
| 402 | `saldo_insuficiente` |
| 404 | `vuelo_no_encontrado` · `reserva_no_encontrada` · `compra_no_encontrada` · `tiquete_no_encontrado` · `tarjeta_no_encontrada` |
| 409 | `vuelo_no_disponible` · `sin_cupos` · `viajero_duplicado_en_vuelo` · `limite_tiquetes_vuelo` · `compra_y_reserva_simultaneas` · `reserva_vencida` · `reserva_cancelada` · `reserva_ya_comprada` · `compra_ya_cancelada` · `fuera_de_plazo_cancelacion` · `tarjeta_duplicada` · `conflicto_concurrencia` |
| 422 | `validacion` · `trayecto_invalido` · `menor_viajero_unico` · `viajero_duplicado` · `tarjeta_recarga_invalida` |

## Pendiente / decisiones abiertas

1. ✅ **Sillas (resuelto):** se eligen en el mapa y se envían como IDs de `Asiento` (`asientos` / `asientos_regreso`).
   `Asiento` es la fuente de verdad y `tiquete.numero_silla` guarda la etiqueta texto (`"12A"`). La asignación automática
   solo se usa cuando el cliente no eligió silla.
2. ✅ **Cancelar un vuelo (resuelto):** B2 ya llama a `compras.service.reintegrar_vuelo_cancelado(db, id_vuelo)` al cancelar,
   por lo que se cancelan los tiquetes y se devuelve el dinero a los clientes.
3. **Tarjetas:** se guardan completas en la base (es simulado); la API solo expone los últimos 4 dígitos. Antes de producción real habría que tokenizarlas.
