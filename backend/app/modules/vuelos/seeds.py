"""
Datos semilla de Ciudades y Vuelos (B2-04).

* `asegurar_ciudades`: el catalogo (32 capitales de departamento + 5 ciudades del exterior).
  Es idempotente y se ejecuta SIEMPRE al arrancar la aplicacion (ver `app/main.py`), porque el
  sistema no funciona sin catalogo (RNF13: las ciudades viven en la base de datos, no en el codigo).
* `sembrar_vuelos_ejemplo`: ~20 vuelos para desarrollo y demo. Solo se insertan si la tabla
  `vuelo` esta vacia, y SOLO cuando se pide a mano:

      cd backend
      python -m app.modules.vuelos.seeds

  Las fechas son relativas a "hoy" para que los vuelos nunca queden vencidos. Se vuelven a
  generar con una base nueva (o vaciando la tabla `vuelo`).

Los vuelos quedan con los codigos AT-0001..AT-0020. Incluyen casos para probar las reglas de la
busqueda: AT-0010 sin cupo en economica (D13) y AT-0011 ya sucedido (D16).
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.vuelos.models import Ciudad, EstadoVuelo, GrupoInternacional, Vuelo
from app.modules.vuelos.service import crear_vuelo, tipo_entre

TZ_COLOMBIA = "America/Bogota"

# Grupo `colombia` (D5): las capitales habilitadas como origen/destino internacional.
_GRUPO_COLOMBIA = {"PEI", "BOG", "MDE", "CLO", "CTG"}

# Las 32 capitales de departamento (R15), con los mismos codigos que el respaldo del front.
_CAPITALES = [
    ("LET", "Leticia"), ("MDE", "Medellín"), ("AUC", "Arauca"), ("BAQ", "Barranquilla"),
    ("CTG", "Cartagena"), ("TUN", "Tunja"), ("MZL", "Manizales"), ("FLA", "Florencia"),
    ("YOP", "Yopal"), ("POP", "Popayán"), ("VUP", "Valledupar"), ("QUI", "Quibdó"),
    ("MTR", "Montería"), ("BOG", "Bogotá"), ("INI", "Inírida"), ("SJE", "San José del Guaviare"),
    ("NVA", "Neiva"), ("RCH", "Riohacha"), ("SMR", "Santa Marta"), ("VVC", "Villavicencio"),
    ("PSO", "Pasto"), ("CUC", "Cúcuta"), ("MOC", "Mocoa"), ("AXM", "Armenia"),
    ("PEI", "Pereira"), ("ADZ", "San Andrés"), ("BGA", "Bucaramanga"), ("SIN", "Sincelejo"),
    ("IBE", "Ibagué"), ("CLO", "Cali"), ("MVP", "Mitú"), ("PDA", "Puerto Carreño"),
]

# Ciudades del grupo `exterior` (D5).
_EXTERIOR = [
    ("MAD", "Madrid", "España", "Europe/Madrid"),
    ("LON", "Londres", "Reino Unido", "Europe/London"),
    ("NYC", "New York", "Estados Unidos", "America/New_York"),
    ("BUE", "Buenos Aires", "Argentina", "America/Argentina/Buenos_Aires"),
    ("MIA", "Miami", "Estados Unidos", "America/New_York"),
]

CIUDADES_SEMILLA: list[dict] = [
    {
        "codigo": codigo,
        "nombre": nombre,
        "pais": "Colombia",
        "zona_horaria": TZ_COLOMBIA,
        "es_capital_departamento": True,
        "grupo_internacional": GrupoInternacional.COLOMBIA if codigo in _GRUPO_COLOMBIA else None,
    }
    for codigo, nombre in _CAPITALES
] + [
    {
        "codigo": codigo,
        "nombre": nombre,
        "pais": pais,
        "zona_horaria": zona,
        "es_capital_departamento": False,
        "grupo_internacional": GrupoInternacional.EXTERIOR,
    }
    for codigo, nombre, pais, zona in _EXTERIOR
]


def asegurar_ciudades(db: Session) -> int:
    """Inserta las ciudades que falten (por `codigo`). Idempotente. Devuelve cuantas inserto."""
    existentes = set(db.scalars(select(Ciudad.codigo)))
    nuevas = [Ciudad(**datos) for datos in CIUDADES_SEMILLA if datos["codigo"] not in existentes]
    db.add_all(nuevas)
    db.commit()
    return len(nuevas)


# (origen, destino, dias desde hoy, hora UTC, minuto, duracion en minutos, costo COP, extras)
_VUELOS_SEMILLA: list[tuple] = [
    ("BOG", "MDE", 10, 13, 10, 65, 189_000, {}),
    ("PEI", "BOG", 10, 15, 30, 55, 159_000, {}),
    ("BOG", "MAD", 15, 3, 40, 600, 2_450_000, {}),
    ("MAD", "BOG", 27, 10, 0, 660, 2_600_000, {}),
    ("CLO", "CTG", 20, 18, 0, 100, 310_000, {}),
    ("MIA", "PEI", 30, 14, 0, 200, 1_150_000, {}),
    ("BOG", "CLO", 12, 22, 0, 70, 175_000, {}),
    ("MDE", "BOG", 11, 12, 0, 60, 150_000, {}),
    ("BOG", "MDE", 10, 20, 0, 65, 249_000, {}),
    # Sin cupo en economica: la busqueda NO debe ocultarlo (D13).
    ("PEI", "MDE", 14, 11, 0, 45, 135_000, {"cupos_economica": 0}),
    # Ya sucedio: la busqueda lo excluye (D16); el panel del administrador si lo lista.
    ("BOG", "PEI", -3, 14, 0, 55, 165_000, {"estado": EstadoVuelo.SUCEDIDO}),
    ("BOG", "CTG", 18, 12, 0, 105, 289_000, {}),
    ("CTG", "BOG", 19, 22, 30, 105, 279_000, {}),
    ("MDE", "CLO", 16, 14, 15, 60, 169_000, {}),
    ("BOG", "NYC", 21, 6, 0, 330, 1_980_000, {}),
    ("NYC", "BOG", 35, 15, 0, 330, 2_050_000, {}),
    ("BOG", "LON", 25, 2, 0, 630, 3_100_000, {}),
    ("BUE", "BOG", 40, 11, 30, 390, 2_300_000, {}),
    ("MDE", "MIA", 22, 13, 0, 190, 1_320_000, {}),
    ("CTG", "MIA", 28, 16, 0, 160, 1_250_000, {}),
]


def sembrar_vuelos_ejemplo(db: Session, ahora: datetime | None = None) -> int:
    """Inserta los vuelos de ejemplo si la tabla `vuelo` esta vacia. Devuelve cuantos inserto.

    Requiere el catalogo de ciudades (se asegura primero). `ahora` solo se parametriza para las pruebas.
    """
    if db.scalar(select(func.count(Vuelo.id))):
        return 0
    asegurar_ciudades(db)
    ciudades = {c.codigo: c for c in db.scalars(select(Ciudad))}
    ahora = (ahora or datetime.now(timezone.utc)).replace(second=0, microsecond=0)

    for origen, destino, dias, hora, minuto, duracion, costo, extras in _VUELOS_SEMILLA:
        crear_vuelo(
            db,
            origen=ciudades[origen],
            destino=ciudades[destino],
            tipo=tipo_entre(ciudades[origen], ciudades[destino]),
            salida_utc=(ahora + timedelta(days=dias)).replace(hour=hora, minute=minuto),
            duracion_min=duracion,
            costo=costo,
            **extras,
        )
    db.commit()
    return len(_VUELOS_SEMILLA)


if __name__ == "__main__":  # python -m app.modules.vuelos.seeds
    from app.core.db import session_scope

    with session_scope() as sesion:
        ciudades_nuevas = asegurar_ciudades(sesion)
        vuelos_nuevos = sembrar_vuelos_ejemplo(sesion)
    print(f"Ciudades nuevas: {ciudades_nuevas} | vuelos de ejemplo nuevos: {vuelos_nuevos}")
    if not vuelos_nuevos:
        print("(La tabla `vuelo` ya tenia datos: no se agrego nada.)")
