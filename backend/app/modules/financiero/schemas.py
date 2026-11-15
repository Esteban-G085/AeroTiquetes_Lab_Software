"""
Schemas de Gestion financiera. Contrato: `frontend/docs/CONTRATO_COMPRAS.md`.
Dinero en COP, enteros (igual que `vuelo.costo`).
"""
import re
from datetime import date

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.modules.financiero.models import TipoTarjeta

# Limite de seguridad para un saldo/monto simulado (evita desbordes y errores de digitacion).
MONTO_MAXIMO = 1_000_000_000


class BilleteraOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    saldo: int = Field(description="Saldo disponible en COP.")


class AgregarSaldoRequest(BaseModel):
    monto: int = Field(gt=0, le=MONTO_MAXIMO, description="COP a sumar al saldo actual.")


class EditarSaldoRequest(BaseModel):
    saldo: int = Field(ge=0, le=MONTO_MAXIMO, description="Nuevo saldo total en COP (reemplaza al actual).")


def _solo_digitos(v: str) -> str:
    return re.sub(r"[\s-]", "", v)


def _normalizar_vencimiento(v: str) -> str:
    """Acepta MM/AA o MM/AAAA y devuelve MM/AAAA. Rechaza meses invalidos y tarjetas vencidas."""
    m = re.fullmatch(r"(\d{2})/(\d{2}|\d{4})", v.strip())
    if not m:
        raise ValueError("Usa el formato MM/AA o MM/AAAA.")
    mes, anio = int(m.group(1)), int(m.group(2))
    if anio < 100:
        anio += 2000
    if not 1 <= mes <= 12:
        raise ValueError("El mes debe estar entre 01 y 12.")
    hoy = date.today()
    if (anio, mes) < (hoy.year, hoy.month):
        raise ValueError("La tarjeta esta vencida.")
    return f"{mes:02d}/{anio}"


class _TarjetaCampos(BaseModel):
    @field_validator("numero", check_fields=False)
    @classmethod
    def _numero(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = _solo_digitos(v)
        if not re.fullmatch(r"\d{13,19}", v):
            raise ValueError("El numero debe tener entre 13 y 19 digitos.")
        return v

    @field_validator("fecha_expiracion", check_fields=False)
    @classmethod
    def _vencimiento(cls, v: str | None) -> str | None:
        return None if v is None else _normalizar_vencimiento(v)

    @field_validator("codigo", check_fields=False)
    @classmethod
    def _codigo(cls, v: str | None) -> str | None:
        if v is not None and not re.fullmatch(r"\d{3,4}", v.strip()):
            raise ValueError("El codigo debe tener 3 o 4 digitos.")
        return None if v is None else v.strip()

    @field_validator("titular", check_fields=False)
    @classmethod
    def _titular(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("El titular es obligatorio.")
        return None if v is None else " ".join(v.split())


class TarjetaCrear(_TarjetaCampos):
    tipo: TipoTarjeta
    numero: str = Field(description="13 a 19 digitos (se aceptan espacios o guiones).")
    titular: str = Field(min_length=1, max_length=150)
    fecha_expiracion: str = Field(description="MM/AA o MM/AAAA; no puede estar vencida.")
    codigo: str = Field(description="3 o 4 digitos.")


class TarjetaEditar(_TarjetaCampos):
    """Todos los campos son opcionales: solo se cambia lo que se envia."""

    tipo: TipoTarjeta | None = None
    numero: str | None = None
    titular: str | None = Field(default=None, max_length=150)
    fecha_expiracion: str | None = None
    codigo: str | None = None


class TarjetaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tipo: TipoTarjeta
    titular: str
    fecha_expiracion: str
    numero: str = Field(exclude=True)  # nunca se devuelve completo

    @computed_field
    @property
    def ultimos4(self) -> str:
        return self.numero[-4:]

    @computed_field
    @property
    def numero_enmascarado(self) -> str:
        return f"**** **** **** {self.numero[-4:]}"


class ListaTarjetas(BaseModel):
    items: list[TarjetaOut]
