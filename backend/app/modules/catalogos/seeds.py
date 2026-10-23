"""Catalogo semilla de paises.

Fuente unica: la usan la migracion 006 y `asegurar_paises` al arrancar la app
(igual que las ciudades de vuelos), asi los tests y cualquier entorno nuevo
tienen siempre el mismo catalogo.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalogos.models import Pais

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
