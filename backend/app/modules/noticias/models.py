"""
Modelos de Noticias y Mensajes (Sprint 2, B2-11).

    noticia      se crea sola al programar un vuelo (HU11)
    suscripcion  un cliente recibe por correo las noticias nuevas; se cancela cuando quiera
    mensaje      cliente -> administrador   (SOLO LA TABLA: se usa en las Iteraciones 3 y 4)
    respuesta    administrador -> cliente   (SOLO LA TABLA: se usa en la Iteracion 4)

Decisiones:

* Una noticia por vuelo (`id_vuelo` unico). Si el vuelo se borra, su noticia tambien (CASCADE).
* La noticia NO guarda un estado de "publicada/retirada": la regla (maximo 8 dias y solo mientras el
  vuelo siga `programado`) se calcula al consultar, asi nunca queda desfasada (ver `service.noticias_visibles`).
* `imagen_url` es opcional: la imagen alusiva la sube un administrador mas adelante; mientras tanto el
  front muestra una imagen por defecto.
* Una suscripcion por cliente (`id_cliente` unico). Cancelar la deja `activa = False`; volver a
  suscribirse la reactiva con un token nuevo. `token_cancelacion` viaja en el enlace de cada correo.
"""
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, String, Text, false, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.core.tipos import FechaUTC
from app.modules.usuarios import models as _usuarios_models  # noqa: F401  (FK a cliente y administrador)
from app.modules.vuelos.models import Vuelo


class Noticia(Base):
    __tablename__ = "noticia"

    id: Mapped[int] = mapped_column(primary_key=True)
    id_vuelo: Mapped[int] = mapped_column(
        ForeignKey("vuelo.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    contenido: Mapped[str] = mapped_column(Text, nullable=False)
    imagen_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    publicada_en: Mapped[datetime] = mapped_column(FechaUTC, nullable=False, server_default=func.now(), index=True)

    vuelo: Mapped[Vuelo] = relationship(lazy="joined")


class Suscripcion(Base):
    __tablename__ = "suscripcion"

    id: Mapped[int] = mapped_column(primary_key=True)
    id_cliente: Mapped[int] = mapped_column(
        ForeignKey("cliente.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    activa: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=false())
    token_cancelacion: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    creada_en: Mapped[datetime] = mapped_column(FechaUTC, nullable=False, server_default=func.now())
    cancelada_en: Mapped[datetime | None] = mapped_column(FechaUTC, nullable=True)


class Mensaje(Base):
    __tablename__ = "mensaje"

    id: Mapped[int] = mapped_column(primary_key=True)
    id_cliente: Mapped[int] = mapped_column(
        ForeignKey("cliente.id", ondelete="CASCADE"), nullable=False, index=True
    )
    asunto: Mapped[str] = mapped_column(String(150), nullable=False)
    contenido: Mapped[str] = mapped_column(Text, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(FechaUTC, nullable=False, server_default=func.now())


class Respuesta(Base):
    __tablename__ = "respuesta"

    id: Mapped[int] = mapped_column(primary_key=True)
    id_mensaje: Mapped[int] = mapped_column(
        ForeignKey("mensaje.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # NULL si el administrador se elimina (HU23), igual que `vuelo.id_administrador`.
    id_administrador: Mapped[int | None] = mapped_column(
        ForeignKey("administrador.id", ondelete="SET NULL"), nullable=True
    )
    contenido: Mapped[str] = mapped_column(Text, nullable=False)
    creada_en: Mapped[datetime] = mapped_column(FechaUTC, nullable=False, server_default=func.now())
