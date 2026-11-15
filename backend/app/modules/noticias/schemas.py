"""Contrato de Noticias: la forma que espera `frontend/src/features/noticias` (ver `CONTRATO_SPRINT2.md` §4)."""
from datetime import datetime

from pydantic import BaseModel, EmailStr


class CiudadNoticia(BaseModel):
    ciudad: str
    codigo: str


class NoticiaOut(BaseModel):
    id: int
    tipo: str
    titulo: str | None = None
    vuelo_id: int
    origen: CiudadNoticia
    destino: CiudadNoticia
    salida: datetime
    salida_zona: str
    precio: int
    moneda: str = "COP"
    imagen_url: str | None = None
    publicada_en: datetime
    vigente_hasta: datetime
    descuento_pct: int | None = None
    precio_original: int | None = None


class ListaNoticias(BaseModel):
    items: list[NoticiaOut]


class SuscripcionOut(BaseModel):
    suscrito: bool
    correo: str | None = None


class SuscripcionCrear(BaseModel):
    correo: EmailStr
