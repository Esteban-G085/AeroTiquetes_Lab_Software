"""Contratos de Noticias y suscripciones (Sprint 2, B2-15)."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.modules.vuelos.schemas import VueloOut


class CiudadNoticia(BaseModel):
    ciudad: str
    codigo: str


class NoticiaOut(BaseModel):
    id: int
    tipo: str
    titulo: str | None = None
    contenido: str | None = None
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


class PaginaNoticias(BaseModel):
    total: int
    pagina: int
    tamano: int
    items: list[NoticiaOut]


class NoticiaCrear(BaseModel):
    """Cuerpo de `POST /admin/noticias`. El administrador crea una noticia manualmente."""
    id_vuelo: int | None = Field(None, description="Vuelo al que esta vinculada la noticia (opcional).")
    tipo: str = Field("vuelo", max_length=20, description="Tipo de noticia.")
    titulo: str | None = Field(None, max_length=200, description="Titulo de la noticia.")
    contenido: str | None = Field(None, description="Contenido/cuerpo de la noticia.")
    imagen_url: str | None = Field(None, max_length=500, description="URL de la imagen alusiva.")
    vigente_hasta: datetime | None = Field(None, description="Fecha hasta la que esta vigente (si se omite, 8 dias desde ahora).")


class SuscripcionOut(BaseModel):
    suscrito: bool
    correo: str | None = None


class CancelarPorToken(BaseModel):
    token: str = Field(min_length=10, max_length=64, description="El `token` del enlace del correo.")


class SuscripcionCrear(BaseModel):
    correo: EmailStr
