"""
Modelos de Gestion financiera (HU10, B1-11): billetera virtual simulada y tarjetas.

* Una billetera por cliente (R01), creada con saldo 0 en el primer acceso (ver `service`).
* El saldo es un entero en COP, igual que `vuelo.costo`; nunca negativo (CHECK).
* `MovimientoBilletera` es una auditoria INTERNA (recargas, pagos y reintegros). No se expone
  en la API ni en la UI: R19/R20 siguen excluyendo historial y comprobantes para el cliente.
* Las tarjetas guardan el numero completo, titular, vencimiento y codigo (R06, R10); es una
  billetera SIMULADA, no hay pasarela de pago (R12, R13). Las respuestas de la API enmascaran
  el numero y nunca devuelven el codigo.
"""
import enum
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint, DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint, text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
# La FK apunta a `cliente`: esa tabla debe estar en los mismos metadatos.
from app.modules.usuarios import models as _usuarios_models  # noqa: F401


class TipoTarjeta(str, enum.Enum):
    CREDITO = "credito"
    DEBITO = "debito"


class TipoMovimiento(str, enum.Enum):
    """Auditoria interna. Los valores coinciden con el contrato de la tabla."""
    RECARGA = "recarga"
    COMPRA = "compra"
    REINTEGRO = "reintegro"


class Billetera(Base):
    __tablename__ = "billetera"
    __table_args__ = (CheckConstraint("saldo >= 0", name="ck_billetera_saldo_no_negativo"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    id_cliente: Mapped[int] = mapped_column(
        ForeignKey("cliente.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    saldo: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")  # COP

    tarjetas: Mapped[list["Tarjeta"]] = relationship(
        back_populates="billetera", cascade="all, delete-orphan", order_by="Tarjeta.id"
    )
    movimientos: Mapped[list["MovimientoBilletera"]] = relationship(
        back_populates="billetera", cascade="all, delete-orphan", order_by="MovimientoBilletera.id"
    )


class MovimientoBilletera(Base):
    """Registro interno de cada cambio de saldo. Nunca se devuelve al cliente (R19/R20)."""

    __tablename__ = "movimiento_billetera"

    id: Mapped[int] = mapped_column(primary_key=True)
    id_billetera: Mapped[int] = mapped_column(
        ForeignKey("billetera.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tipo: Mapped[TipoMovimiento] = mapped_column(
        Enum(TipoMovimiento, name="tipo_movimiento_billetera"), nullable=False
    )
    monto: Mapped[int] = mapped_column(Integer, nullable=False)  # con signo: + recarga/reintegro, - compra
    saldo_resultante: Mapped[int] = mapped_column(Integer, nullable=False)
    referencia: Mapped[str | None] = mapped_column(String(80), nullable=True)
    # Auditoria de la recarga: que tarjeta registrada se uso (nunca se pide el CVV al recargar).
    id_tarjeta: Mapped[int | None] = mapped_column(
        ForeignKey("tarjeta.id", ondelete="SET NULL"), nullable=True
    )
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc), server_default=text("CURRENT_TIMESTAMP"),
    )

    billetera: Mapped[Billetera] = relationship(back_populates="movimientos")


class Tarjeta(Base):
    __tablename__ = "tarjeta"
    __table_args__ = (UniqueConstraint("id_billetera", "numero", name="uq_tarjeta_billetera_numero"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    id_billetera: Mapped[int] = mapped_column(
        ForeignKey("billetera.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tipo: Mapped[TipoTarjeta] = mapped_column(Enum(TipoTarjeta, name="tipo_tarjeta"), nullable=False)
    numero: Mapped[str] = mapped_column(String(19), nullable=False)  # solo digitos
    titular: Mapped[str] = mapped_column(String(150), nullable=False)
    fecha_expiracion: Mapped[str] = mapped_column(String(7), nullable=False)  # MM/AAAA
    codigo: Mapped[str] = mapped_column(String(4), nullable=False)

    billetera: Mapped[Billetera] = relationship(back_populates="tarjetas")
