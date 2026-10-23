"""Schemas del modulo catalogos."""
from pydantic import BaseModel, ConfigDict


class PaisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo_iso2: str | None = None
    nombre: str
