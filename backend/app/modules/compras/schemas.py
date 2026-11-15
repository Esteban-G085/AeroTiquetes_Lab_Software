"""
Schemas de Compra y reserva. Contrato para el front: `frontend/docs/CONTRATO_COMPRAS.md`.

Nombres en snake_case; fechas como instantes ISO 8601 en UTC (terminan en `Z`); dinero en COP (enteros).
"""
import re
from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.modules.compras.models import ClaseTiquete, EstadoTiquete, TrayectoTiquete
from app.modules.vuelos.models import EstadoVuelo, TipoVuelo
from app.modules.vuelos.schemas import CiudadVuelo, VueloOut

MAX_VIAJEROS_POR_ITEM = 5  # R: maximo 5 tiquetes por vuelo y cliente
MAX_ITEMS = 10


def _texto(v: str) -> str:
    v = " ".join(v.split())
    if not v:
        raise ValueError("Es obligatorio.")
    return v


# ---------------------------------------------------------------------------
# Entrada
# ---------------------------------------------------------------------------
class ViajeroIn(BaseModel):
    """Datos obligatorios del viajero (R19 de Compra)."""

    documento: str = Field(min_length=4, max_length=30)
    nombres: str = Field(min_length=1, max_length=100)
    apellidos: str = Field(min_length=1, max_length=100)
    fecha_nacimiento: date
    genero: str = Field(min_length=1, max_length=30)
    telefono: str = Field(min_length=7, max_length=30)
    correo: EmailStr
    nombre_contacto: str = Field(min_length=1, max_length=150)
    telefono_contacto: str = Field(min_length=7, max_length=30)

    @field_validator("documento")
    @classmethod
    def _documento(cls, v: str) -> str:
        v = re.sub(r"[\s.-]", "", v).upper()
        if not re.fullmatch(r"[A-Z0-9]{4,30}", v):
            raise ValueError("El documento solo admite letras y numeros.")
        return v

    @field_validator("nombres", "apellidos", "genero", "nombre_contacto")
    @classmethod
    def _limpiar(cls, v: str) -> str:
        return _texto(v)

    @field_validator("telefono", "telefono_contacto")
    @classmethod
    def _telefono(cls, v: str) -> str:
        v = v.strip()
        if not re.fullmatch(r"\+?[\d\s()-]{7,30}", v):
            raise ValueError("Telefono no valido.")
        return v

    @field_validator("fecha_nacimiento")
    @classmethod
    def _no_futura(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("La fecha de nacimiento no puede ser futura.")
        return v


class TrayectoSolicitado(str, Enum):
    UNICO = "unico"  # origen -> destino
    COMPLETO = "completo"  # origen -> destino -> origen


class ItemSolicitud(BaseModel):
    """Un viaje: uno o varios viajeros en la misma clase, en un trayecto unico o completo.

    El carrito de la compra es una lista de estos items (pueden ser de vuelos distintos)."""

    trayecto: TrayectoSolicitado = TrayectoSolicitado.UNICO
    vuelo_id: int = Field(description="Vuelo de ida (o el unico vuelo si el trayecto es unico).")
    vuelo_regreso_id: int | None = Field(default=None, description="Obligatorio si el trayecto es completo.")
    clase: ClaseTiquete
    viajeros: list[ViajeroIn] = Field(min_length=1, max_length=MAX_VIAJEROS_POR_ITEM)

    @model_validator(mode="after")
    def _coherencia(self) -> "ItemSolicitud":
        if self.trayecto == TrayectoSolicitado.COMPLETO:
            if self.vuelo_regreso_id is None:
                raise ValueError("vuelo_regreso_id es obligatorio en un trayecto completo.")
            if self.vuelo_regreso_id == self.vuelo_id:
                raise ValueError("El vuelo de regreso debe ser distinto al de ida.")
        elif self.vuelo_regreso_id is not None:
            raise ValueError("vuelo_regreso_id solo se envia en un trayecto completo.")
        return self


class SolicitudOperacion(BaseModel):
    """Cuerpo de `POST /reservas` y `POST /compras`."""

    items: list[ItemSolicitud] = Field(min_length=1, max_length=MAX_ITEMS)


class CancelarCompraRequest(BaseModel):
    """Opcional: sin cuerpo (o sin `tiquete_ids`) se cancelan todos los tiquetes activos de la compra."""

    tiquete_ids: list[int] | None = Field(default=None, min_length=1)


# ---------------------------------------------------------------------------
# Salida
# ---------------------------------------------------------------------------
class VueloResumen(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    tipo: TipoVuelo
    estado: EstadoVuelo
    origen: CiudadVuelo
    destino: CiudadVuelo
    salida_utc: datetime
    llegada_utc: datetime


class ViajeroOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    documento: str
    nombres: str
    apellidos: str
    correo: str


class TiqueteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo_reserva: str
    estado: EstadoTiquete
    clase: ClaseTiquete
    trayecto: TrayectoTiquete
    numero_silla: int | None = Field(description="Silla asignada al azar; null si el tiquete ya no esta activo.")
    precio: int
    vuelo: VueloResumen
    viajero: ViajeroOut


class OperacionOut(BaseModel):
    """Una reserva o una compra, con sus tiquetes."""

    tipo: str = Field(description="`reserva` o `compra`.")
    id: int
    estado: str = Field(description="Reserva: activa, comprada, cancelada, vencida. Compra: pagada, parcialmente_cancelada, cancelada.")
    creada_en: datetime
    expira_en: datetime | None = Field(description="Solo reservas: momento en que se libera si no se paga.")
    total: int
    id_reserva: int | None = Field(description="Solo compras que nacieron de pagar una reserva.")
    tiquetes: list[TiqueteOut]


class CancelacionOut(BaseModel):
    """Resultado de cancelar una compra o una reserva."""

    operacion: OperacionOut
    reintegro: int = Field(description="COP devueltos a la billetera (0 si era una reserva).")
    saldo: int | None = Field(description="Saldo de la billetera despues del reintegro (solo compras).")


class PaginaHistorial(BaseModel):
    total: int
    pagina: int
    tamano: int
    items: list[OperacionOut]


class VueloRegresoOut(VueloOut):
    """Un vuelo de regreso candidato, con los tiquetes activos que el cliente ya tiene en el."""

    tiquetes_cliente: int = Field(0, description="Tiquetes activos (comprados o reservados) del cliente en este vuelo.")


class MisTiquetesVuelo(BaseModel):
    vuelo_id: int
    activos: int = Field(description="Tiquetes activos (comprados o reservados) del cliente en el vuelo.")
    maximo: int = Field(description="Maximo permitido por vuelo y cliente.")
    disponibles: int = Field(description="Cuantos mas puede agregar.")
