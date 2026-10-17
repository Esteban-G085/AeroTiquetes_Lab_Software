# Contrato Frontend (F2) ⇄ Backend (B2) — módulos Vuelos y Búsqueda

Documento de trabajo para cerrar en el **Hito 0 / B2-00**, antes de implementar B2.
Refleja **exactamente** lo que el front (F2 integrado sobre la base de F1) espera hoy.
Si B2 cambia algo, el ajuste en el front es de un solo archivo: el `api.js` de cada feature
(`frontend/src/features/busqueda/api.js`, `frontend/src/features/vuelos/api.js`) o `utils/useCiudades.js`.

> **Sin mocks (decisión del equipo).** El front no trae MSW: hasta que B2 responda, las pantallas
> muestran su estado de error ("Reintentar") y el catálogo de ciudades cae al respaldo local
> (`src/domain/ciudades.js`). Nada de datos inventados en pantalla.

## Convenciones generales

| Tema | Acuerdo |
|---|---|
| Base URL | `VITE_API_URL` (por defecto `http://localhost:8000`) |
| CORS | Permitir `http://localhost:5173`, métodos `GET/POST`, cabeceras `Authorization, Content-Type` |
| Autenticación | `Authorization: Bearer <JWT>`; las rutas `/admin/*` exigen rol `administrador` |
| Formato de error | `{ "error": { "code", "message", "fields": { "campo": "mensaje" } } }` |
| Nombres de campo | `snake_case`, idénticos en la respuesta y en `error.fields` |
| Fechas | Instantes ISO 8601 **en UTC** (`salida_utc`, `llegada_utc`). El front los muestra en la zona de cada ciudad |
| Paginación | `pagina` (1-based) en listados; la respuesta trae `total`. El front no pagina todavía, solo lee `items` |

## ✅ GET `/ciudades` — catálogo (`utils/useCiudades.js`)

Respuesta: `{ "items": [Ciudad] }` (también se acepta un arreglo plano). Si falla o viene vacío,
el front usa su catálogo local y avisa en pantalla ("catálogo local").

```json
{ "codigo": "BOG", "nombre": "Bogotá", "pais": "Colombia", "zona_horaria": "America/Bogota",
  "es_capital_departamento": true, "grupo_internacional": "colombia" }
```

| Campo | Regla |
|---|---|
| `codigo` | Clave estable de 3 letras (IATA-like). Es lo que viaja en origen/destino |
| `zona_horaria` | Zona IANA del aeropuerto (`America/Bogota`, `Europe/Madrid`…). El front formatea con ella |
| `es_capital_departamento` | `true` para las 32 capitales (base de los vuelos nacionales, R15) |
| `grupo_internacional` | `"colombia"` (Pereira, Bogotá, Medellín, Cali, Cartagena) · `"exterior"` (Madrid, Londres, New York, Buenos Aires, Miami) · `null` |

El front deriva de aquí los selects (Colombia / Internacional) y la clasificación nacional/internacional.

## ✅ GET `/vuelos` — búsqueda (HU5, `features/busqueda/api.js`)

Criterios por query string, **todos opcionales y combinables**; los vacíos no se envían:

| Parámetro | Tipo | Notas |
|---|---|---|
| `origen`, `destino` | código de ciudad | |
| `fecha` | `YYYY-MM-DD` | Día de salida en zona de Colombia |
| `precioMin`, `precioMax` | entero (COP) | Rango de `costo` |
| `duracionMin`, `duracionMax` | entero (minutos) | Rango de `duracion_min` |
| `clase` | `economica` \| `primera` | |
| `orden` | `fecha_asc` \| `precio_asc` \| `precio_desc` \| `duracion_asc` \| `duracion_desc` | Por defecto `fecha_asc` |
| `pagina` | entero | 1-based (el front aún no lo usa) |

Respuesta (**supuesto actual**): `{ "total": 12, "items": [Vuelo] }`
(también se acepta un arreglo plano; el front calcula `total`).

* Solo vuelos **programados con salida futura**. **No se ocultan los vuelos sin cupo**: la
  disponibilidad se muestra por clase y la ausencia de cupo solo se advierte (D13).
* Sin filtro de aerolínea (D3: AeroTiquetes es la única línea).

### Forma de `Vuelo` (respuesta compartida por búsqueda y panel)

```json
{ "id": 7, "codigo": "AT-0007", "tipo": "nacional", "estado": "programado",
  "origen":  { "codigo": "BOG", "nombre": "Bogotá", "pais": "Colombia", "zona_horaria": "America/Bogota" },
  "destino": { "codigo": "MDE", "nombre": "Medellín", "pais": "Colombia", "zona_horaria": "America/Bogota" },
  "salida_utc": "2026-11-10T13:10:00Z", "llegada_utc": "2026-11-10T14:15:00Z", "duracion_min": 65,
  "costo": 300000, "cupos_economica": 125, "cupos_primera": 25,
  "fecha_programacion": "2026-10-01T15:00:00Z" }
```

| Campo | Regla |
|---|---|
| `codigo` | Consecutivo `AT-####` generado por el backend (D3). No lo digita el administrador |
| `tipo` | `nacional` \| `internacional` (derivado por el backend, RF04–RF06) |
| `estado` | `programado` \| `sucedido` \| `realizado` \| `cancelado` |
| `llegada_utc`, `duracion_min` | Calculados por el backend a partir de salida + duración (D3) |
| `costo` | **Único por persona**, no depende de la clase (D3) |
| `cupos_economica`, `cupos_primera` | Asignados por el sistema al crear (D4): nacional 125/25, internacional 200/50 |

## ✅ GET `/vuelos/{id}` — detalle público (HU5)

Devuelve un objeto `Vuelo` (misma forma). **404** si no existe → el front muestra
"Vuelo no encontrado" con enlace a la búsqueda. Público (visitante y cliente).

## ✅ GET `/admin/vuelos` — panel (HU19, `features/vuelos/api.js`) · rol `administrador`

Filtros opcionales: `estado`, `origen`, `destino`, `pagina`. Respuesta igual: `{ total, items }`.
Orden sugerido: salida descendente (lo más reciente primero).

## ✅ POST `/admin/vuelos` — programar (HU18) · rol `administrador`

Request JSON con **solo** lo que digita el administrador:

```json
{ "tipo": "nacional", "origen": "BOG", "destino": "MDE",
  "fecha": "2030-01-15", "hora": "08:00", "duracion": 90, "costo": 300000 }
```

| Campo | Regla que ya valida el front (`features/vuelos/components/VueloForm.jsx`) |
|---|---|
| `origen` | Capital de departamento (cualquiera de las 32) |
| `destino` | Capital de departamento, o ciudad del exterior |
| `fecha` | `YYYY-MM-DD`, no anterior a hoy |
| `hora` | `HH:MM` en **hora de Colombia** (`America/Bogota`) |
| `duracion` | Entero > 0 (minutos) |
| `costo` | Entero > 0 (COP, por persona) |

* Regla de negocio (el backend es la autoridad, el front la espeja para avisar antes):
  **nacional** = dos capitales de departamento; **internacional** = una ciudad del grupo
  `colombia` {PEI, BOG, MDE, CLO, CTG} y una del grupo `exterior`, en cualquier sentido.
  Cualquier otra combinación con el exterior es inválida.
* Éxito: **201** con el objeto `Vuelo` creado (el front usa `id` y `codigo`).
* Validación: **422**/400 con `error.fields` → cada mensaje se pinta en su campo.
  P. ej. `{ "fecha": "La fecha no puede ser anterior a hoy", "destino": "Combinación no permitida" }`.
* El backend genera: `codigo`, `llegada_utc`, `duracion_min`, `cupos_economica`/`cupos_primera`, `estado = programado`, `fecha_programacion`.

## ✅ GET `/admin/vuelos/{id}` — consulta (HU19) · rol `administrador`

Devuelve un objeto `Vuelo` (incluye `fecha_programacion`). **404** si no existe.

## Preguntas abiertas para B2 (responder en B2-00)

1. ¿Se confirma la forma de `Vuelo` de arriba (nombres `salida_utc`/`llegada_utc`/`costo`/`cupos_*`)?
2. `GET /vuelos`: ¿`fecha` filtra por día completo en zona de Colombia o por instante? (el front asume día completo)
3. `GET /ciudades`: ¿el catálogo se filtra por uso (`?uso=nacional|internacional`) o siempre se envía completo?
   (el front hoy pide todo y agrupa en el cliente)
4. El front pide `/vuelos/{id}` con `id` numérico. ¿Se aceptará también el `codigo` (`AT-0007`)?
5. ¿`estado` cambia solo (programado → sucedido) por paso del tiempo en el backend, o lo calcula el front al mostrar?
6. Para el respaldo local de ciudades: ¿los 5 orígenes internacionales son exactamente PEI, BOG, MDE, CLO, CTG (D5)?

## Rastro en el front

| Elemento | Archivo |
|---|---|
| Reglas de ciudades/vuelo | `src/domain/ciudades.js` |
| Catálogos de estado/clase/orden | `src/domain/estados.js` |
| Lectura de cupos | `src/domain/vuelo.js` |
| Rango de fechas/horas | `src/utils/format.js` |
| Catálogo de ciudades (hook) | `src/utils/useCiudades.js` |
| Búsqueda (páginas + API) | `src/features/busqueda/` |
| Panel de vuelos (páginas + API) | `src/features/vuelos/` |
