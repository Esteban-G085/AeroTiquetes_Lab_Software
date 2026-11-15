"""
Modelos de Noticias y suscripcion (HU11, B2-15).

    noticia       la publicacion de un vuelo recien programado (una por vuelo)
    suscripcion   el cliente que quiere recibir las noticias por correo (una por cliente)

Decisiones (ver CAMBIOS_INTEGRACION_SPRINT2.md):

* La noticia NO copia los datos del vuelo (ruta, salida, precio): se leen del vuelo al consultar. Asi, si el
  administrador edita el vuelo, la noticia ya sale actualizada.
* `vigente_hasta` = publicada + 8 dias (RF05). Ademas la noticia se oculta cuando el vuelo deja de estar
  programado (cancelado, ya salio o realizado, RF06). Nada se borra: se filtra al consultar.
* `tipo` queda en "vuelo". "promocion" existe en el contrato del frontend, pero ninguna historia del sprint
  genera promociones (`descuento_pct` y `precio_original` salen siempre vacios).
"""
from datetime import datetime

from sqlalchemy import ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.tipos import FechaUTC
from app.modules.usuarios import models as _usuarios_models  # noqa: F401
from app.modules.vuelos import models as _vuelos_models  # noqa: F401


class Noticia(Base):
    __tablename__ = "noticia"

    id: Mapped[int] = mapped_column(primary_key=True)
    id_vuelo: Mapped[int] = mapped_column(ForeignKey("vuelo.id", ondelete="CASCADE"), unique=True, nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False, default="vuelo", server_default="vuelo")
    titulo: Mapped[str | None] = mapped_column(String(150), nullable=True)
    imagen_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    publicada_en: Mapped[datetime] = mapped_column(FechaUTC, nullable=False, server_default=func.now())
    vigente_hasta: Mapped[datetime] = mapped_column(FechaUTC, nullable=False, index=True)


class Suscripcion(Base):
    __tablename__ = "suscripcion"

    id: Mapped[int] = mapped_column(primary_key=True)
    id_cliente: Mapped[int] = mapped_column(
        ForeignKey("cliente.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    correo: Mapped[str] = mapped_column(String(255), nullable=False)
    creada_en: Mapped[datetime] = mapped_column(FechaUTC, nullable=False, server_default=func.now())
