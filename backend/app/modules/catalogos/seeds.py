"""Catalogo semilla de paises.

Fuente unica: la usan la migracion 006 y `asegurar_paises` al arrancar la app
(igual que las ciudades de vuelos), asi los tests y cualquier entorno nuevo
tienen siempre el mismo catalogo.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalogos.models import Departamento, Pais

# (codigo_iso2, nombre) en orden alfabetico.
PAISES_SEMILLA: list[tuple[str, str]] = [
    ("AF", "Afganistán"),
    ("AL", "Albania"),
    ("DE", "Alemania"),
    ("AD", "Andorra"),
    ("AO", "Angola"),
    ("AR", "Argentina"),
    ("AM", "Armenia"),
    ("AU", "Australia"),
    ("AT", "Austria"),
    ("AZ", "Azerbaiyán"),
    ("BE", "Bélgica"),
    ("BO", "Bolivia"),
    ("BR", "Brasil"),
    ("BG", "Bulgaria"),
    ("CA", "Canadá"),
    ("CL", "Chile"),
    ("CN", "China"),
    ("CO", "Colombia"),
    ("CR", "Costa Rica"),
    ("HR", "Croacia"),
    ("CU", "Cuba"),
    ("DK", "Dinamarca"),
    ("EC", "Ecuador"),
    ("EG", "Egipto"),
    ("SV", "El Salvador"),
    ("ES", "España"),
    ("US", "Estados Unidos"),
    ("EE", "Estonia"),
    ("FI", "Finlandia"),
    ("FR", "Francia"),
    ("GR", "Grecia"),
    ("GT", "Guatemala"),
    ("HN", "Honduras"),
    ("HU", "Hungría"),
    ("IN", "India"),
    ("ID", "Indonesia"),
    ("IE", "Irlanda"),
    ("IS", "Islandia"),
    ("IT", "Italia"),
    ("JP", "Japón"),
    ("MX", "México"),
    ("NI", "Nicaragua"),
    ("NO", "Noruega"),
    ("PA", "Panamá"),
    ("PY", "Paraguay"),
    ("PE", "Perú"),
    ("PL", "Polonia"),
    ("PT", "Portugal"),
    ("PR", "Puerto Rico"),
    ("GB", "Reino Unido"),
    ("CZ", "República Checa"),
    ("DO", "República Dominicana"),
    ("RO", "Rumanía"),
    ("RU", "Rusia"),
    ("SE", "Suecia"),
    ("CH", "Suiza"),
    ("TR", "Turquía"),
    ("UA", "Ucrania"),
    ("UY", "Uruguay"),
    ("VE", "Venezuela"),
]


# (codigo, nombre, pais) de la ubicacion de facturacion (HU4):
# 32 departamentos de Colombia + 5 regiones para ciudades del exterior.
# Cada region cuelga de un pais real del catalogo, asi la cadena
# pais -> departamento -> ciudad es siempre consistente.
DEPARTAMENTOS_SEMILLA: list[tuple[str, str, str]] = [
    ("CO-AMA", "Amazonas", "Colombia"),
    ("CO-ANT", "Antioquia", "Colombia"),
    ("CO-ARA", "Arauca", "Colombia"),
    ("CO-ATL", "Atlántico", "Colombia"),
    ("CO-BOL", "Bolívar", "Colombia"),
    ("CO-BOY", "Boyacá", "Colombia"),
    ("CO-CAL", "Caldas", "Colombia"),
    ("CO-CAQ", "Caquetá", "Colombia"),
    ("CO-CAS", "Casanare", "Colombia"),
    ("CO-CAU", "Cauca", "Colombia"),
    ("CO-CES", "Cesar", "Colombia"),
    ("CO-CHO", "Chocó", "Colombia"),
    ("CO-COR", "Córdoba", "Colombia"),
    ("CO-BDC", "Bogotá, D.C.", "Colombia"),
    ("CO-GUA", "Guainía", "Colombia"),
    ("CO-GUV", "Guaviare", "Colombia"),
    ("CO-HUI", "Huila", "Colombia"),
    ("CO-LAG", "La Guajira", "Colombia"),
    ("CO-MAG", "Magdalena", "Colombia"),
    ("CO-MET", "Meta", "Colombia"),
    ("CO-NAR", "Nariño", "Colombia"),
    ("CO-NSA", "Norte de Santander", "Colombia"),
    ("CO-PUT", "Putumayo", "Colombia"),
    ("CO-QUI", "Quindío", "Colombia"),
    ("CO-RIS", "Risaralda", "Colombia"),
    ("CO-SAP", "San Andrés, Providencia y Santa Catalina", "Colombia"),
    ("CO-SAN", "Santander", "Colombia"),
    ("CO-SUC", "Sucre", "Colombia"),
    ("CO-TOL", "Tolima", "Colombia"),
    ("CO-VAC", "Valle del Cauca", "Colombia"),
    ("CO-VAU", "Vaupés", "Colombia"),
    ("CO-VIC", "Vichada", "Colombia"),
    ("EXT-EU", "Europa continental", "España"),
    ("EXT-GB", "Islas Británicas", "Reino Unido"),
    ("EXT-NA", "Norteamérica", "Estados Unidos"),
    ("EXT-SA", "Cono Sur", "Argentina"),
    ("EXT-AP", "Asia y Oceanía", "Japón"),
]

# Codigo de ciudad ( tabla `ciudad` ) -> codigo de su departamento/region.
CIUDAD_DEPARTAMENTO: dict[str, str] = {
    "LET": "CO-AMA", "MDE": "CO-ANT", "AUC": "CO-ARA", "BAQ": "CO-ATL",
    "CTG": "CO-BOL", "TUN": "CO-BOY", "MZL": "CO-CAL", "FLA": "CO-CAQ",
    "YOP": "CO-CAS", "POP": "CO-CAU", "VUP": "CO-CES", "QUI": "CO-CHO",
    "MTR": "CO-COR", "BOG": "CO-BDC", "INI": "CO-GUA", "SJE": "CO-GUV",
    "NVA": "CO-HUI", "RCH": "CO-LAG", "SMR": "CO-MAG", "VVC": "CO-MET",
    "PSO": "CO-NAR", "CUC": "CO-NSA", "MOC": "CO-PUT", "AXM": "CO-QUI",
    "PEI": "CO-RIS", "ADZ": "CO-SAP", "BGA": "CO-SAN", "SIN": "CO-SUC",
    "IBE": "CO-TOL", "CLO": "CO-VAC", "MVP": "CO-VAU", "PDA": "CO-VIC",
    "MAD": "EXT-EU", "LON": "EXT-GB", "NYC": "EXT-NA", "MIA": "EXT-NA",
    "BUE": "EXT-SA",
}


def sembrar_paises(db: Session) -> int:
    """Inserta los paises que falten. Idempotente (por nombre)."""
    existentes = {p.nombre for p in db.scalars(select(Pais))}
    nuevos = 0
    for orden, (codigo, nombre) in enumerate(PAISES_SEMILLA):
        if nombre in existentes:
            continue
        db.add(Pais(codigo_iso2=codigo, nombre=nombre, activo=True, orden=orden))
        nuevos += 1
    if nuevos:
        db.commit()
    return nuevos


def asegurar_paises(db: Session) -> int:
    """Alias usado en el arranque de la app (ver app/main.py)."""
    return sembrar_paises(db)


def sembrar_departamentos(db: Session) -> int:
    """Inserta los 37 departamentos/regiones que falten. Idempotente (por codigo).

    Requiere que `pais` ya este sembrado: las regiones del exterior cuelgan de
    un pais real del catalogo para mantener la cadena geografica consistente.
    """
    paises = {p.nombre: p.id for p in db.scalars(select(Pais))}
    existentes = set(db.scalars(select(Departamento.codigo)))
    nuevos = []
    for orden, (codigo, nombre, pais) in enumerate(DEPARTAMENTOS_SEMILLA):
        if codigo in existentes or pais not in paises:
            continue
        nuevos.append(
            Departamento(
                codigo=codigo, nombre=nombre, id_pais=paises[pais], activo=True, orden=orden
            )
        )
    db.add_all(nuevos)
    db.commit()
    return len(nuevos)


def asegurar_departamentos(db: Session) -> int:
    """Alias usado en el arranque de la app (ver app/main.py)."""
    return sembrar_departamentos(db)


def mapa_departamentos(db: Session) -> dict[str, int]:
    """Codigo de departamento -> id. Lo usa el backfill de `ciudad`."""
    return {d.codigo: d.id for d in db.scalars(select(Departamento))}
