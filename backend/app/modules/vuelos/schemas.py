"""
Contrato v0 de Ciudades y Vuelos (B2-00).

Refleja EXACTAMENTE lo que el frontend (F2) espera: ver `frontend/docs/CONTRATO_VUELOS.md`.
Nombres en snake_case; fechas como instantes ISO 8601 en UTC (terminan en `Z`); el front
las muestra en la zona horaria de cada ciudad.
"""
from datetime import date, datetime, time
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

# Los enums de dominio viven en models.py (una sola definicion para la API y la base de datos).
from app.modules.vuelos.models import EstadoVuelo, GrupoInternacional, TipoVuelo


class ClaseVuelo(str, Enum):
    ECONOMICA = "economica"
    PRIMERA = "primera"


class OrdenVuelos(str, Enum):
    FECHA_ASC = "fecha_asc"
    PRECIO_ASC = "precio_asc"
    PRECIO_DESC = "precio_desc"
    DURACION_ASC = "duracion_asc"
    DURACION_DESC = "duracion_desc"


class UsoCiudad(str, Enum):
    NACIONAL = "nacional"
    INTERNACIONAL = "internacional"


# ---------------------------------------------------------------------------
# Ciudades
# ---------------------------------------------------------------------------
class CiudadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # se arma desde el modelo SQLAlchemy

    codigo: str = Field(description="Clave estable de 3 letras. Es lo que viaja en origen/destino.")
    nombre: str
    pais: str
    zona_horaria: str = Field(description="Zona IANA, ej. America/Bogota")
    es_capital_departamento: bool
    grupo_internacional: GrupoInternacional | None = Field(
        None, description="`colombia` o `exterior` si la ciudad admite vuelos internacionales; null si no."
    )


class ListaCiudades(BaseModel):
    items: list[CiudadOut]


class CiudadVuelo(BaseModel):
    """Ciudad tal como viene embebida dentro de un vuelo."""

    model_config = ConfigDict(from_attributes=True)

    codigo: str
    nombre: str
    pais: str
    zona_horaria: str


# ---------------------------------------------------------------------------
# Vuelos
# ---------------------------------------------------------------------------
class VueloOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str = Field(description="Consecutivo AT-#### generado por el backend (D3).")
    tipo: TipoVuelo
    estado: EstadoVuelo
    origen: CiudadVuelo
    destino: CiudadVuelo
    salida_utc: datetime
    llegada_utc: datetime = Field(description="salida + duracion, calculada por el backend (D15).")
    duracion_min: int
    costo: int = Field(description="Por persona, en COP. No depende de la clase (D3).")
    cupos_economica: int
    cupos_primera: int
    fecha_programacion: datetime


class PaginaVuelos(BaseModel):
    total: int = Field(description="Total de vuelos que cumplen los criterios (sin paginar).")
    pagina: int
    tamano: int = Field(description="Cantidad maxima de items por pagina.")
    items: list[VueloOut]

    @classmethod
    def armar(cls, total: int, vuelos: list, pagina: int, tamano: int) -> "PaginaVuelos":
        """Pagina de respuesta a partir de modelos `Vuelo` de SQLAlchemy."""
        return cls(total=total, pagina=pagina, tamano=tamano, items=[VueloOut.model_validate(v) for v in vuelos])


class VueloAdminOut(VueloOut):
    """Vuelo en las pantallas del administrador: ademas, cuantos tiquetes activos (comprados o reservados) tiene."""

    tiquetes_vendidos: int = Field(0, description="Tiquetes activos: comprados o reservados (retienen cupo).")


class PaginaVuelosAdmin(BaseModel):
    total: int
    pagina: int
    tamano: int
    items: list[VueloAdminOut]


class ListaVuelosAdmin(BaseModel):
    total: int
    items: list[VueloAdminOut]


def vuelo_admin(vuelo, vendidos: int) -> VueloAdminOut:
    out = VueloAdminOut.model_validate(vuelo)
    out.tiquetes_vendidos = vendidos
    return out


class VueloCrear(BaseModel):
    """Lo unico que digita el administrador (HU18). El resto lo genera el sistema."""

    tipo: TipoVuelo
    origen: str = Field(min_length=3, max_length=3, description="Codigo de ciudad, ej. BOG")
    destino: str = Field(min_length=3, max_length=3, description="Codigo de ciudad, ej. MDE")
    fecha: date = Field(description="YYYY-MM-DD")
    hora: time = Field(description="HH:MM en hora de Colombia (America/Bogota)")
    duracion: int = Field(gt=0, description="Minutos")
    costo: int = Field(gt=0, description="Por persona, en COP")


class VueloEditar(BaseModel):
    """Edicion de un vuelo programado (HU12): fecha, hora, origen, destino, duracion y costo.

    Fecha y hora en hora de Colombia, igual que al programarlo. El tipo (nacional o internacional) no cambia.
    """

    fecha: date = Field(description="YYYY-MM-DD")
    hora: time = Field(description="HH:MM en hora de Colombia (America/Bogota)")
    origen: str = Field(min_length=3, max_length=3, description="Codigo de ciudad, ej. BOG")
    destino: str = Field(min_length=3, max_length=3, description="Codigo de ciudad, ej. MDE")
    duracion_min: int = Field(gt=0, le=1440, description="Minutos")
    precio: int = Field(gt=0, le=100_000_000, description="Por persona, en COP")


class VueloCancelar(BaseModel):
    motivo: str | None = Field(None, max_length=300, description="Causa de fuerza mayor; obligatoria si hay tiquetes.")
