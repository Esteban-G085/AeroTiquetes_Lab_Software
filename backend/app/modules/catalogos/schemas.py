"""Schemas del modulo catalogos."""
from pydantic import BaseModel, ConfigDict, Field


class PaisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo_iso2: str | None = None
    nombre: str


class DepartamentoOut(BaseModel):
    """Departamento de Colombia o region del exterior, para el select de facturacion."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo: str
    nombre: str
    id_pais: int


class CiudadFacturacionOut(BaseModel):
    """Ciudad del catalogo, filtrable por departamento para el select dependiente."""

    model_config = ConfigDict(from_attributes=True)

    codigo: str
    nombre: str
    pais: str
    id_departamento: int | None = Field(None, description="Null solo en datos anteriores a la migracion 018.")
