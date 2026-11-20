"""Catalogo semilla de paises y geografia de facturacion.

Fuente unica: la usan la migracion 006/018 y `asegurar_*` al arrancar la app,
asi los tests y cualquier entorno nuevo tienen siempre el mismo catalogo.

La cadena de facturacion es pais -> departamento/region -> ciudad:

* Colombia conserva sus 32 departamentos y sus 32 capitales.
* 11 paises tienen geografia curada (regiones y ciudades reales).
* Los 48 paises restantes tienen una unica region "Region de X" con la capital
  de X. Asi nunca aparece una region de otro pais: China ya no puede elegir
  "Cono Sur".
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


# ---------------------------------------------------------------------------
# Colombia: 32 departamentos y su capital (se mantienen tal cual).
# ---------------------------------------------------------------------------
DEPARTAMENTOS_COLOMBIA: list[tuple[str, str, str]] = [
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
]

CIUDAD_DEPARTAMENTO_COLOMBIA: dict[str, str] = {
    "LET": "CO-AMA", "MDE": "CO-ANT", "AUC": "CO-ARA", "BAQ": "CO-ATL",
    "CTG": "CO-BOL", "TUN": "CO-BOY", "MZL": "CO-CAL", "FLA": "CO-CAQ",
    "YOP": "CO-CAS", "POP": "CO-CAU", "VUP": "CO-CES", "QUI": "CO-CHO",
    "MTR": "CO-COR", "BOG": "CO-BDC", "INI": "CO-GUA", "SJE": "CO-GUV",
    "NVA": "CO-HUI", "RCH": "CO-LAG", "SMR": "CO-MAG", "VVC": "CO-MET",
    "PSO": "CO-NAR", "CUC": "CO-NSA", "MOC": "CO-PUT", "AXM": "CO-QUI",
    "PEI": "CO-RIS", "ADZ": "CO-SAP", "BGA": "CO-SAN", "SIN": "CO-SUC",
    "IBE": "CO-TOL", "CLO": "CO-VAC", "MVP": "CO-VAU", "PDA": "CO-VIC",
}


# Paises con geografia real: pais -> [(codigo, nombre, [(ciudad, nombre, zona)])].
# Incluye las 5 ciudades del exterior de vuelos (MAD, LON, NYC, MIA, BUE) para
# que la cadena de facturacion y la de vuelos apunten a la misma region.
GEOGRAFIA_CURADA: dict[str, list[tuple[str, str, list[tuple[str, str, str]]]]] = {
    "China": [
        ("CN-BJ", "Pekín (municipio)", [("PEK", "Pekín", "Asia/Shanghai")]),
        ("CN-SH", "Shanghái (municipio)", [("SHA", "Shanghái", "Asia/Shanghai")]),
        ("CN-GD", "Guangdong", [("SZX", "Shenzhen", "Asia/Shanghai")]),
        ("CN-ZJ", "Zhejiang", [("HGH", "Hangzhou", "Asia/Shanghai")]),
        ("CN-SC", "Sichuan", [("CTU", "Chengdu", "Asia/Shanghai")]),
    ],
    "España": [
        ("ES-MD", "Comunidad de Madrid", [("MAD", "Madrid", "Europe/Madrid")]),
        ("ES-CT", "Cataluña", [("BCN", "Barcelona", "Europe/Madrid")]),
        ("ES-AN", "Andalucía", [("SVQ", "Sevilla", "Europe/Madrid")]),
        ("ES-VC", "Comunidad Valenciana", [("VLC", "Valencia", "Europe/Madrid")]),
        ("ES-MC", "Región de Murcia", [("MUR", "Murcia", "Europe/Madrid")]),
    ],
    "México": [
        ("MX-CM", "Ciudad de México", [("MEX", "Ciudad de México", "America/Mexico_City")]),
        ("MX-JL", "Jalisco", [("GDL", "Guadalajara", "America/Mexico_City")]),
        ("MX-NL", "Nuevo León", [("MTY", "Monterrey", "America/Monterrey")]),
        ("MX-PU", "Puebla", [("PUE", "Puebla", "America/Mexico_City")]),
        ("MX-YU", "Yucatán", [("MID", "Mérida", "America/Merida")]),
    ],
    "Perú": [
        ("PE-LI", "Lima", [("LIM", "Lima", "America/Lima")]),
        ("PE-CU", "Cusco", [("CUZ", "Cusco", "America/Lima")]),
        ("PE-AR", "Arequipa", [("AQP", "Arequipa", "America/Lima")]),
        ("PE-TR", "La Libertad", [("TRU", "Trujillo", "America/Lima")]),
        ("PE-PI", "Piura", [("PIU", "Piura", "America/Lima")]),
    ],
    "Argentina": [
        ("AR-BA", "Buenos Aires", [("BUE", "Buenos Aires", "America/Argentina/Buenos_Aires")]),
        ("AR-CB", "Córdoba", [("COR", "Córdoba", "America/Argentina/Cordoba")]),
        ("AR-SF", "Santa Fe", [("SFE", "Santa Fe", "America/Argentina/Cordoba")]),
        ("AR-MZ", "Mendoza", [("MDZ", "Mendoza", "America/Argentina/Mendoza")]),
        ("AR-RN", "Río Negro", [("BRC", "Bariloche", "America/Argentina/Buenos_Aires")]),
    ],
    "Chile": [
        ("CL-RM", "Región Metropolitana", [("SCL", "Santiago", "America/Santiago")]),
        ("CL-VP", "Valparaíso", [("VAP", "Valparaíso", "America/Santiago")]),
        ("CL-BB", "Biobío", [("CON", "Concepción", "America/Santiago")]),
        ("CL-AR", "Arica y Parinacota", [("ARI", "Arica", "America/Santiago")]),
        ("CL-MG", "Magallanes", [("MAG", "Punta Arenas", "America/Santiago")]),
    ],
    "Brasil": [
        ("BR-SP", "São Paulo", [("SAO", "São Paulo", "America/Sao_Paulo")]),
        ("BR-RJ", "Rio de Janeiro", [("GIG", "Rio de Janeiro", "America/Sao_Paulo")]),
        ("BR-MG", "Minas Gerais", [("CNF", "Belo Horizonte", "America/Sao_Paulo")]),
        ("BR-BA", "Bahia", [("SSA", "Salvador", "America/Bahia")]),
        ("BR-PR", "Paraná", [("CWB", "Curitiba", "America/Sao_Paulo")]),
    ],
    "Estados Unidos": [
        ("US-NY", "Nueva York", [("NYC", "New York", "America/New_York")]),
        ("US-FL", "Florida", [("MIA", "Miami", "America/New_York")]),
        ("US-CA", "California", [("LAX", "Los Ángeles", "America/Los_Angeles")]),
        ("US-IL", "Illinois", [("CHI", "Chicago", "America/Chicago")]),
        ("US-TX", "Texas", [("HOU", "Houston", "America/Chicago")]),
    ],
    "Reino Unido": [
        ("GB-LN", "Inglaterra", [("LON", "Londres", "Europe/London")]),
        ("GB-MN", "Gran Mánchester", [("MAN", "Mánchester", "Europe/London")]),
        ("GB-SC", "Escocia", [("EDI", "Edimburgo", "Europe/London")]),
        ("GB-WA", "Gales", [("CWL", "Cardiff", "Europe/London")]),
        ("GB-NI", "Irlanda del Norte", [("BFS", "Belfast", "Europe/London")]),
    ],
    "Francia": [
        ("FR-ID", "Isla de Francia", [("PAR", "París", "Europe/Paris")]),
        ("FR-AR", "Auvernia-Ródano-Alpes", [("LYS", "Lyon", "Europe/Paris")]),
        ("FR-PA", "Provenza-Alpes-Costa Azul", [("MRS", "Marsella", "Europe/Paris")]),
        ("FR-OO", "Occitania", [("TLS", "Toulouse", "Europe/Paris")]),
        ("FR-NO", "Norte", [("LIL", "Lille", "Europe/Paris")]),
    ],
    "Japón": [
        ("JP-TO", "Tokio", [("TYO", "Tokio", "Asia/Tokyo")]),
        ("JP-OS", "Osaka", [("OSA", "Osaka", "Asia/Tokyo")]),
        ("JP-KY", "Kioto", [("KYO", "Kioto", "Asia/Tokyo")]),
        ("JP-HK", "Hokkaido", [("CTS", "Sapporo", "Asia/Tokyo")]),
        ("JP-FU", "Fukuoka", [("FUK", "Fukuoka", "Asia/Tokyo")]),
    ],
}

# Los demas paises habilitados: (codigo_iso3, capital, zona_horaria).
CAPITALES_FALLBACK: dict[str, tuple[str, str, str]] = {
    "Afganistán": ("AFG", "Kabul", "Asia/Kabul"),
    "Albania": ("ALB", "Tirana", "Europe/Tirane"),
    "Alemania": ("DEU", "Berlín", "Europe/Berlin"),
    "Andorra": ("AND", "Andorra la Vella", "Europe/Andorra"),
    "Angola": ("AGO", "Luanda", "Africa/Luanda"),
    "Armenia": ("ARM", "Ereván", "Asia/Yerevan"),
    "Australia": ("AUS", "Canberra", "Australia/Sydney"),
    "Austria": ("AUT", "Viena", "Europe/Vienna"),
    "Azerbaiyán": ("AZE", "Bakú", "Asia/Baku"),
    "Bélgica": ("BEL", "Bruselas", "Europe/Brussels"),
    "Bolivia": ("BOL", "Sucre", "America/La_Paz"),
    "Bulgaria": ("BGR", "Sofía", "Europe/Sofia"),
    "Canadá": ("CAN", "Ottawa", "America/Toronto"),
    "Costa Rica": ("CRI", "San José", "America/Costa_Rica"),
    "Croacia": ("HRV", "Zagreb", "Europe/Zagreb"),
    "Cuba": ("CUB", "La Habana", "America/Havana"),
    "Dinamarca": ("DNK", "Copenhague", "Europe/Copenhagen"),
    "Ecuador": ("ECU", "Quito", "America/Guayaquil"),
    "Egipto": ("EGY", "El Cairo", "Africa/Cairo"),
    "El Salvador": ("SLV", "San Salvador", "America/El_Salvador"),
    "Estonia": ("EST", "Tallin", "Europe/Tallinn"),
    "Finlandia": ("FIN", "Helsinki", "Europe/Helsinki"),
    "Grecia": ("GRC", "Atenas", "Europe/Athens"),
    "Guatemala": ("GTM", "Ciudad de Guatemala", "America/Guatemala"),
    "Honduras": ("HND", "Tegucigalpa", "America/Tegucigalpa"),
    "Hungría": ("HUN", "Budapest", "Europe/Budapest"),
    "India": ("IND", "Nueva Delhi", "Asia/Kolkata"),
    "Indonesia": ("IDN", "Yakarta", "Asia/Jakarta"),
    "Irlanda": ("IRL", "Dublín", "Europe/Dublin"),
    "Islandia": ("ISL", "Reikiavik", "Atlantic/Reykjavik"),
    "Italia": ("ITA", "Roma", "Europe/Rome"),
    "Nicaragua": ("NIC", "Managua", "America/Managua"),
    "Noruega": ("NOR", "Oslo", "Europe/Oslo"),
    "Panamá": ("PAN", "Ciudad de Panamá", "America/Panama"),
    "Paraguay": ("PRY", "Asunción", "America/Asuncion"),
    "Polonia": ("POL", "Varsovia", "Europe/Warsaw"),
    "Portugal": ("PRT", "Lisboa", "Europe/Lisbon"),
    "Puerto Rico": ("PRI", "San Juan", "America/Puerto_Rico"),
    "República Checa": ("CZE", "Praga", "Europe/Prague"),
    "República Dominicana": ("DOM", "Santo Domingo", "America/Santo_Domingo"),
    "Rumanía": ("ROU", "Bucarest", "Europe/Bucharest"),
    "Rusia": ("RUS", "Moscú", "Europe/Moscow"),
    "Suecia": ("SWE", "Estocolmo", "Europe/Stockholm"),
    "Suiza": ("CHE", "Berna", "Europe/Zurich"),
    "Turquía": ("TUR", "Ankara", "Europe/Istanbul"),
    "Ucrania": ("UKR", "Kiev", "Europe/Kiev"),
    "Uruguay": ("URY", "Montevideo", "America/Montevideo"),
    "Venezuela": ("VEN", "Caracas", "America/Caracas"),
}

_ISO2_POR_PAIS = {nombre: codigo for codigo, nombre in PAISES_SEMILLA}

# Estas tres estructuras son las que consumen la migracion 018 y los seeders.
DEPARTAMENTOS_SEMILLA: list[tuple[str, str, str]] = list(DEPARTAMENTOS_COLOMBIA)
CIUDAD_DEPARTAMENTO: dict[str, str] = dict(CIUDAD_DEPARTAMENTO_COLOMBIA)
CIUDADES_FACTURACION_SEMILLA: list[dict] = []

for _pais, _regiones in GEOGRAFIA_CURADA.items():
    for _codigo_dep, _nombre_dep, _ciudades in _regiones:
        DEPARTAMENTOS_SEMILLA.append((_codigo_dep, _nombre_dep, _pais))
        for _codigo, _nombre, _zona in _ciudades:
            CIUDAD_DEPARTAMENTO[_codigo] = _codigo_dep
            CIUDADES_FACTURACION_SEMILLA.append({
                "codigo": _codigo,
                "nombre": _nombre,
                "pais": _pais,
                "zona_horaria": _zona,
                "es_capital_departamento": True,
                "solo_facturacion": True,
                "id_departamento": _codigo_dep,
            })

for _pais, (_iso3, _capital, _zona) in CAPITALES_FALLBACK.items():
    _codigo_dep = f"{_ISO2_POR_PAIS[_pais]}-GE"
    DEPARTAMENTOS_SEMILLA.append((_codigo_dep, f"Región de {_pais}", _pais))
    CIUDAD_DEPARTAMENTO[_iso3] = _codigo_dep
    CIUDADES_FACTURACION_SEMILLA.append({
        "codigo": _iso3,
        "nombre": _capital,
        "pais": _pais,
        "zona_horaria": _zona,
        "es_capital_departamento": True,
        "solo_facturacion": True,
        "id_departamento": _codigo_dep,
    })


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
    """Inserta los departamentos/regiones que falten. Idempotente (por codigo).

    Requiere que `pais` ya este sembrado: cada region cuelga de su pais real.
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


def sembrar_ciudades_facturacion(db: Session) -> int:
    """Inserta las ciudades de facturacion que falten (las de vuelos ya estan).

    Idempotente por codigo. Importa `Ciudad` dentro para no acoplar este modulo
    al de vuelos en tiempo de importacion.
    """
    from app.modules.vuelos.models import Ciudad

    existentes = set(db.scalars(select(Ciudad.codigo)))
    departamentos = mapa_departamentos(db)
    nuevos = []
    for datos in CIUDADES_FACTURACION_SEMILLA:
        if datos["codigo"] in existentes:
            continue
        valores = dict(datos)
        id_departamento = departamentos.get(valores.pop("id_departamento"))
        if id_departamento is None:
            continue
        nuevos.append(Ciudad(**valores, id_departamento=id_departamento))
    db.add_all(nuevos)
    db.commit()
    return len(nuevos)


def asegurar_ciudades_facturacion(db: Session) -> int:
    """Alias usado en el arranque de la app (ver app/main.py)."""
    return sembrar_ciudades_facturacion(db)


def mapa_departamentos(db: Session) -> dict[str, int]:
    """Codigo de departamento -> id. Lo usa el backfill de `ciudad`."""
    return {d.codigo: d.id for d in db.scalars(select(Departamento))}
