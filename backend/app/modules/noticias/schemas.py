"""Contratos de Noticias y suscripciones (Sprint 2, B2-15)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.modules.vuelos.schemas import VueloOut


class NoticiaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    titulo: str
    contenido: str
    imagen_url: str | None = Field(None, description="Imagen alusiva; null = el front muestra la de por defecto.")
    publicada_en: datetime
    vuelo: VueloOut


class PaginaNoticias(BaseModel):
    total: int
    pagina: int
    tamano: int
    items: list[NoticiaOut]


class SuscripcionOut(BaseModel):
    suscrito: bool
    desde: datetime | None = Field(None, description="Cuando se suscribio (null si no esta suscrito).")


class CancelarPorToken(BaseModel):
    token: str = Field(min_length=10, max_length=64, description="El `token` del enlace del correo.")
