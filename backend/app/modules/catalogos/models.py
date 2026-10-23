"""Modelo ORM del catalogo de paises."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Pais(Base):
    __tablename__ = "pais"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo_iso2: Mapped[str | None] = mapped_column(String(2), unique=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    activo: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=text("true"), nullable=False, index=True
    )
    orden: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"), nullable=False)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
