"""Correos pendientes de entrega (bandeja de salida con reintentos).

Un codigo de reserva no se puede perder porque el SMTP este caido: el mensaje se
guarda aqui y un worker lo reintenta. El envio en `BackgroundTasks` sigue siendo
el primer intento; si falla, la fila queda `pendiente` para el worker.
"""
from datetime import datetime

from sqlalchemy import Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base
from app.core.tipos import FechaUTC


class NotificacionPendiente(Base):
    __tablename__ = "notificacion_pendiente"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tipo: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    destinatario: Mapped[str] = mapped_column(String(255), nullable=False)
    asunto: Mapped[str] = mapped_column(String(200), nullable=False)
    cuerpo_html: Mapped[str] = mapped_column(Text, nullable=False)
    estado: Mapped[str] = mapped_column(String(15), nullable=False, default="pendiente", index=True)
    intentos: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    creada_en: Mapped[datetime] = mapped_column(
        FechaUTC, nullable=False, server_default=func.now(), index=True
    )
    proximo_intento_en: Mapped[datetime] = mapped_column(
        FechaUTC, nullable=False, server_default=func.now(), index=True
    )
    ultimo_error: Mapped[str | None] = mapped_column(Text, nullable=True)
