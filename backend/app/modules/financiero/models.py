"""
Modelos de Gestion financiera (HU10, B1-11): billetera virtual simulada y tarjetas.

* Una billetera por cliente (R01), creada con saldo 0 en el primer acceso (ver `service`).
* El saldo es un entero en COP, igual que `vuelo.costo`; nunca negativo (CHECK).
* Sin historial de movimientos (R19) y sin comprobantes (R20): no hay tabla de movimientos.
* Las tarjetas guardan el numero completo, titular, vencimiento y codigo (R06, R10); es una
  billetera SIMULADA, no hay pasarela de pago (R12, R13). Las respuestas de la API enmascaran
  el numero y nunca devuelven el codigo.
"""
import enum

from sqlalchemy import CheckConstraint, Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
# La FK apunta a `cliente`: esa tabla debe estar en los mismos metadatos.
from app.modules.usuarios import models as _usuarios_models  # noqa: F401


class TipoTarjeta(str, enum.Enum):
    CREDITO = "credito"
    DEBITO = "debito"


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
