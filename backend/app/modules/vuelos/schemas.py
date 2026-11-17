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
from app.modules.vuelos.models import (
    Asiento,
    ClaseAsiento,
    EstadoAsiento,
    EstadoVuelo,
    GrupoInternacional,
    TipoVuelo,
    Vuelo,
)


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
    costo: int = Field(description="Por persona, en COP. Clase economica (D3).")
    costo_primera: int = Field(description="Por persona, en COP. Clase primera. Si no se indica, igual que economica.")
    cupos_economica: int
    cupos_primera: int
    fecha_programacion: datetime
    tiquetes_vendidos: int = Field(0, description="Tiquetes activos (reservados o comprados).")


class PaginaVuelos(BaseModel):
    total: int = Field(description="Total de vuelos que cumplen los criterios (sin paginar).")
    pagina: int
    tamano: int = Field(description="Cantidad maxima de items por pagina.")
    items: list[VueloOut]

    @classmethod
    def armar(cls, total: int, vuelos: list, pagina: int, tamano: int) -> "PaginaVuelos":
        """Pagina de respuesta a partir de modelos `Vuelo` de SQLAlchemy."""
        return cls(total=total, pagina=pagina, tamano=tamano, items=[VueloOut.model_validate(v) for v in vuelos])


def vuelo_con_tiquetes_vendidos(vuelo: Vuelo, tiquetes_vendidos: int = 0) -> VueloOut:
    """Construye un VueloOut a partir de un modelo Vuelo, agregando tiquetes_vendidos."""
    return VueloOut(
        id=vuelo.id,
        codigo=vuelo.codigo,
        tipo=vuelo.tipo,
        estado=vuelo.estado,
        origen=CiudadVuelo(
            codigo=vuelo.origen.codigo,
            nombre=vuelo.origen.nombre,
            pais=vuelo.origen.pais,
            zona_horaria=vuelo.origen.zona_horaria,
        ),
        destino=CiudadVuelo(
            codigo=vuelo.destino.codigo,
            nombre=vuelo.destino.nombre,
            pais=vuelo.destino.pais,
            zona_horaria=vuelo.destino.zona_horaria,
        ),
        salida_utc=vuelo.salida_utc,
        llegada_utc=vuelo.llegada_utc,
        duracion_min=vuelo.duracion_min,
        costo=vuelo.costo,
        costo_primera=vuelo.costo_primera,
        cupos_economica=vuelo.cupos_economica,
        cupos_primera=vuelo.cupos_primera,
        fecha_programacion=vuelo.fecha_programacion,
        tiquetes_vendidos=tiquetes_vendidos,
    )


class AsientoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    numero: str
    fila: int
    columna: str
    clase: ClaseAsiento
    estado: EstadoAsiento
    id_tiquete: int | None = None


class VueloCrear(BaseModel):
    """Lo unico que digita el administrador (HU18). El resto lo genera el sistema."""

    tipo: TipoVuelo
    origen: str = Field(min_length=3, max_length=3, description="Codigo de ciudad, ej. BOG")
    destino: str = Field(min_length=3, max_length=3, description="Codigo de ciudad, ej. MDE")
    fecha: date = Field(description="YYYY-MM-DD")
    hora: time = Field(description="HH:MM en hora de Colombia (America/Bogota)")
    duracion: int = Field(gt=0, description="Minutos")
    costo: int = Field(gt=0, description="Por persona, en COP. Clase economica.")
    costo_primera: int | None = Field(None, gt=0, description="Por persona, en COP. Clase primera. Si se omite, igual que economica.")


class VueloEditar(BaseModel):
    """Cuerpo de `PUT /admin/vuelos/{id}` (HU12). Es un reemplazo: se envian todos los datos del vuelo.

    El `tipo` NO se envia: se deduce de las ciudades (si alguna es del exterior, es internacional).
    `estado` es opcional; si se omite o es el actual se editan los datos, y si es distinto el
    vuelo solo cambia de estado (ver `service.editar_vuelo`).
    """

    origen: str = Field(min_length=3, max_length=3, description="Codigo de ciudad, ej. BOG")
    destino: str = Field(min_length=3, max_length=3, description="Codigo de ciudad, ej. MDE")
    fecha: date = Field(description="YYYY-MM-DD")
    hora: time = Field(description="HH:MM en hora de Colombia (America/Bogota)")
    duracion_min: int = Field(gt=0, description="Minutos")
    precio: int = Field(gt=0, description="Por persona, en COP. Clase economica.")
    precio_primera: int | None = Field(None, gt=0, description="Por persona, en COP. Clase primera. Si se omite, igual que economica.")
    estado: EstadoVuelo | None = None


class VueloCancelar(BaseModel):
    """Cuerpo de `PATCH /admin/vuelos/{id}/cancelar` (HU13).

    `motivo` es opcional cuando no hay tiquetes vendidos, pero obligatorio (minimo 10 caracteres)
    cuando el vuelo ya tiene reservas o compras activas.
    """

    motivo: str | None = Field(None, max_length=300, description="Causa de fuerza mayor; obligatoria si hay tiquetes vendidos.")
