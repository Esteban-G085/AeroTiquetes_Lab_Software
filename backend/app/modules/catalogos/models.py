"""Modelos ORM del catalogo geografico (paises y departamentos/regiones)."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func, text
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


class Departamento(Base):
    """Departamento de Colombia o region de ciudades del exterior.

    Los 32 departamentos colombianos cuelgan de `pais=Colombia`; las 5 regiones
    del exterior (Europa, Norteamerica,etc.) agrupan a las ciudades foraneas.
    """

    __tablename__ = "departamento"
    __table_args__ = (UniqueConstraint("id_pais", "nombre", name="uq_departamento_pais_nombre"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_pais: Mapped[int] = mapped_column(ForeignKey("pais.id", ondelete="CASCADE"), nullable=False, index=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    codigo: Mapped[str] = mapped_column(String(10), nullable=False, unique=True)
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
