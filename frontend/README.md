# AeroTiquetes — Frontend (F2)

Frontend en **React + Vite + Bootstrap** del sistema AeroTiquetes.
Esta parte corresponde al rol **F2**: **buscador de vuelos (HU05)** y **panel de vuelos del administrador (HU18 programar / HU19 consultar)**.

> El módulo de **Usuarios** (login, registro, roles) lo desarrolla **F1**. Aquí se incluye
> `src/features/usuarios/pages/LoginPage.jsx` como *placeholder* y un `AuthContext`
> mínimo para poder probar las rutas protegidas por rol.

## Requisitos

- Node.js 18+ (probado con Node 22)
- npm 9+

## Cómo ejecutar

```bash
cd frontend
npm install

# Opcional: crear el .env local a partir del ejemplo
cp .env.example .env      # en Windows: copy .env.example .env

npm run dev               # http://localhost:5173
```

Con `VITE_USE_MOCKS=true` (valor por defecto del ejemplo) la app funciona **sin backend**,
usando **MSW**. Para conectar al backend de B2, pon `VITE_USE_MOCKS=false` y ajusta `VITE_API_URL`.

### Cambiar de rol en desarrollo

Con los mocks activos aparece un **selector de rol** en el navbar
(visitante / cliente / administrador / root) para probar las rutas protegidas.

## Scripts

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo (Vite) en el puerto 5173 |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Sirve el build de producción |
| `npm test` | Pruebas con Vitest + MSW |

## Estructura

```text
src/
├── components/
│   ├── layout/        # Navbar, Footer, AppLayout
│   ├── ui/            # Spinner, ErrorAlert, EmptyState, EstadoBadge
│   └── vuelo/         # RutaVuelo, VueloDetalle (reutilizables)
├── config/env.js      # variables de entorno
├── context/           # AuthContext (sesión/rol)
├── domain/            # ciudades, estados, cálculos de vuelo
├── features/
│   ├── busqueda/      # HU05: búsqueda + detalle
│   ├── vuelos/        # HU18/HU19: programar + panel admin
│   ├── usuarios/      # placeholder de login (F1)
│   └── comun/         # página 404
├── hooks/             # useCiudades, useVuelo
├── mocks/             # MSW: handlers + datos de ejemplo
├── routes/            # AppRoutes + ProtectedRoute
├── services/          # axios (api.js) + endpoints
└── utils/             # fecha/zona horaria, moneda, errores
```

## Contrato de API (F2 ↔ B2)

El front consume estas rutas. **Formato de error único** en todo el backend:

```json
{ "error": { "code": "VALIDACION", "message": "…", "fields": { "campo": "detalle" } } }
```

### `GET /ciudades`
Catálogo de ciudades semilla.
```json
{ "total": 37, "items": [
  { "codigo": "BOG", "nombre": "Bogotá", "pais": "Colombia",
    "tipo": "nacional", "zona_horaria": "America/Bogota",
    "origen_internacional": true }
] }
```

### `GET /vuelos/busqueda` — HU05
Query params (todos opcionales, combinables):
`origen`, `destino`, `fecha` (yyyy-mm-dd), `clase` (`economica` | `primera`),
`precio_min`, `precio_max`, `duracion_max` (minutos), `orden`.

`orden`: `fecha_asc` (defecto) · `precio_asc` · `precio_desc` · `duracion_asc` · `duracion_desc`.

Respuesta: `{ "total": n, "items": [ Vuelo ] }`.

### `GET /vuelos` — HU19
Igual que la búsqueda, más el filtro `estado` (`programado` | `sucedido` | `realizado` | `cancelado`).
Respuesta: `{ "total": n, "items": [ Vuelo ] }`.

### `GET /vuelos/{id}` — HU05 / HU19
Devuelve un `Vuelo`. `404` con el formato de error si no existe.

### `POST /vuelos` — HU18
El backend genera el **código consecutivo** y calcula la **llegada con zona horaria**.

Request:
```json
{
  "origen": "BOG",
  "destino": "MIA",
  "fecha": "2026-11-05",
  "hora": "08:00",
  "duracion_min": 210,
  "precio": 1850000,
  "cupos": { "economica": 180, "primera": 30 }
}
```
Respuesta `201`: el `Vuelo` creado.

### Objeto `Vuelo`

```json
{
  "id": "vuelo-1",
  "codigo": "AT-0001",
  "tipo": "internacional",
  "origen": { "codigo": "BOG", "nombre": "Bogotá", "pais": "Colombia", "zona_horaria": "America/Bogota" },
  "destino": { "codigo": "MIA", "nombre": "Miami", "pais": "Estados Unidos", "zona_horaria": "America/New_York" },
  "duracion_min": 210,
  "fecha_hora_salida": "2026-11-05T13:00:00.000Z",
  "fecha_hora_llegada": "2026-11-05T16:30:00.000Z",
  "precio": 1850000,
  "cupos": { "economica": 180, "primera": 30 },
  "estado": "programado",
  "promocion": { "id": "promo-1", "porcentaje": 10, "aplica_a": "cupos_disponibles" }
}
```

**Convenciones acordadas:**
- `fecha_hora_salida` / `fecha_hora_llegada` van en **UTC ISO 8601** (`timestamptz`); el front los muestra por zona horaria.
- `precio` es el valor **único por persona** (sin distinción de clase) en COP.
- `promocion` es opcional (`null` si no aplica).
- Reglas de vuelos internacionales: origen solo desde **PEI, BOG, MDE, CLO, CTG** (R11–R15).

## Alcance cubierto

- **HU05** — Buscar/consultar vuelos: formulario combinable, resultados, detalle. ✅
- **HU18** — Programar vuelo: formulario con reglas de validación y vista previa. ✅
- **HU19** — Consultar vuelo (admin): panel con filtros + detalle en solo lectura. ✅

## Pendiente / coordinación

- Reemplazar `LoginPage` y `AuthContext` por los definitivos de **F1**.
- Confirmar con **B2** el formato exacto de fechas/cupos y los nombres de params.
- Tokens de diseño visual según los mockups (no disponibles en `contexto.info` al momento de crear esto).
