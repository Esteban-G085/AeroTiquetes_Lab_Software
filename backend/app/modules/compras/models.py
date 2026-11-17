"""
Modelos de Compra y reserva (HU6-HU9, B1-11).

Tablas:

    viajero   datos de quien viaja (R19); un cliente puede reutilizar sus viajeros
    reserva   grupo de tiquetes retenidos hasta 24 h (se libera al vencer)
    compra    grupo de tiquetes pagados con la billetera
    tiquete   un asiento de un vuelo para un viajero (la unidad que se reserva, compra y cancela)

Decisiones (ver CAMBIOS_SPRINT2.md):

* No hay tabla de carrito: el carrito vive en el front y llega completo en `POST /compras` (R21-R22).
* Una reserva que se paga se convierte en compra: la reserva queda `comprada` y sus tiquetes pasan
  a `comprado` con el mismo codigo de reserva.
* `tiquete.numero_silla` guarda la silla asignada al azar (nacional 1-25 primera / 26-150 economica;
  internacional 1-50 / 51-250). La tabla `silla` y el cambio de silla son de la Iteracion 3; al
  cancelar o vencer se pone en NULL, y `UNIQUE (id_vuelo, numero_silla)` garantiza que dos tiquetes
  nunca comparten silla.
* `tiquete.documento` repite el documento del viajero para poder garantizar en la base de datos
  que una persona no esta dos veces (activa) en el mismo vuelo (R20), venga de quien venga la compra.
* `codigo_reserva` es unico por viajero dentro de una operacion; en un trayecto completo la ida y el
  regreso del mismo viajero comparten codigo (R24: distinto para cada viajero).
"""
import enum
from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.core.tipos import FechaUTC
from app.modules.usuarios import models as _usuarios_models  # noqa: F401
from app.modules.vuelos.models import Vuelo


class ClaseTiquete(str, enum.Enum):
    PRIMERA = "primera"
    ECONOMICA = "economica"


class TrayectoTiquete(str, enum.Enum):
    UNICO = "unico"  # origen -> destino
    IDA = "ida"  # primer tramo de un trayecto completo
    REGRESO = "regreso"  # segundo tramo (destino -> origen)


class EstadoTiquete(str, enum.Enum):
    RESERVADO = "reservado"
    COMPRADO = "comprado"
    CANCELADO = "cancelado"
    VENCIDO = "vencido"  # la reserva expiro sin pagarse


class EstadoReserva(str, enum.Enum):
    ACTIVA = "activa"
    COMPRADA = "comprada"
    CANCELADA = "cancelada"
    VENCIDA = "vencida"


class EstadoCompra(str, enum.Enum):
    PAGADA = "pagada"
    PARCIALMENTE_CANCELADA = "parcialmente_cancelada"
    CANCELADA = "cancelada"


ESTADOS_ACTIVOS = (EstadoTiquete.RESERVADO, EstadoTiquete.COMPRADO)

# Se guardan los NOMBRES del enum (convencion de SQLAlchemy, igual que en `vuelo`).
_ACTIVO_SQL = text("estado IN ('RESERVADO', 'COMPRADO')")


class Viajero(Base):
    __tablename__ = "viajero"
    __table_args__ = (UniqueConstraint("id_cliente", "documento", name="uq_viajero_cliente_documento"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    id_cliente: Mapped[int] = mapped_column(ForeignKey("cliente.id", ondelete="CASCADE"), nullable=False, index=True)
    documento: Mapped[str] = mapped_column(String(30), nullable=False)
    nombres: Mapped[str] = mapped_column(String(100), nullable=False)
    apellidos: Mapped[str] = mapped_column(String(100), nullable=False)
    fecha_nacimiento: Mapped[date] = mapped_column(Date, nullable=False)
    genero: Mapped[str] = mapped_column(String(30), nullable=False)
    telefono: Mapped[str] = mapped_column(String(30), nullable=False)
    correo: Mapped[str] = mapped_column(String(255), nullable=False)
    nombre_contacto: Mapped[str] = mapped_column(String(150), nullable=False)
    telefono_contacto: Mapped[str] = mapped_column(String(30), nullable=False)


class Reserva(Base):
    __tablename__ = "reserva"

    id: Mapped[int] = mapped_column(primary_key=True)
    id_cliente: Mapped[int] = mapped_column(ForeignKey("cliente.id", ondelete="CASCADE"), nullable=False, index=True)
    estado: Mapped[EstadoReserva] = mapped_column(
        Enum(EstadoReserva, name="estado_reserva"), nullable=False, default=EstadoReserva.ACTIVA
    )
    creada_en: Mapped[datetime] = mapped_column(FechaUTC, nullable=False, server_default=func.now())
    expira_en: Mapped[datetime] = mapped_column(FechaUTC, nullable=False, index=True)

    tiquetes: Mapped[list["Tiquete"]] = relationship(back_populates="reserva", order_by="Tiquete.id")


class Compra(Base):
    __tablename__ = "compra"

    id: Mapped[int] = mapped_column(primary_key=True)
    id_cliente: Mapped[int] = mapped_column(ForeignKey("cliente.id", ondelete="CASCADE"), nullable=False, index=True)
    # Si la compra nacio de pagar una reserva, apunta a ella (una reserva se paga una sola vez).
    id_reserva: Mapped[int | None] = mapped_column(ForeignKey("reserva.id"), unique=True, nullable=True)
    estado: Mapped[EstadoCompra] = mapped_column(
        Enum(EstadoCompra, name="estado_compra"), nullable=False, default=EstadoCompra.PAGADA
    )
    total: Mapped[int] = mapped_column(Integer, nullable=False)  # COP pagados
    pagada_en: Mapped[datetime] = mapped_column(FechaUTC, nullable=False, server_default=func.now())

    tiquetes: Mapped[list["Tiquete"]] = relationship(back_populates="compra", order_by="Tiquete.id")


class Tiquete(Base):
    __tablename__ = "tiquete"
    __table_args__ = (
        UniqueConstraint("id_vuelo", "numero_silla", name="uq_tiquete_vuelo_silla"),
        UniqueConstraint("codigo_reserva", "id_vuelo", name="uq_tiquete_codigo_vuelo"),
        # Una persona (por documento) solo puede tener UN tiquete activo en un mismo vuelo (R20).
        Index(
            "uq_tiquete_vuelo_documento_activo",
            "id_vuelo",
            "documento",
            unique=True,
            postgresql_where=_ACTIVO_SQL,
            sqlite_where=_ACTIVO_SQL,
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    id_cliente: Mapped[int] = mapped_column(ForeignKey("cliente.id", ondelete="CASCADE"), nullable=False, index=True)
    id_reserva: Mapped[int | None] = mapped_column(ForeignKey("reserva.id"), nullable=True, index=True)
    id_compra: Mapped[int | None] = mapped_column(ForeignKey("compra.id"), nullable=True, index=True)
    id_viajero: Mapped[int] = mapped_column(ForeignKey("viajero.id"), nullable=False)
    id_vuelo: Mapped[int] = mapped_column(ForeignKey("vuelo.id"), nullable=False, index=True)

    documento: Mapped[str] = mapped_column(String(30), nullable=False)  # copia del documento del viajero
    codigo_reserva: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    clase: Mapped[ClaseTiquete] = mapped_column(Enum(ClaseTiquete, name="clase_tiquete"), nullable=False)
    trayecto: Mapped[TrayectoTiquete] = mapped_column(Enum(TrayectoTiquete, name="trayecto_tiquete"), nullable=False)
    numero_silla: Mapped[str | None] = mapped_column(String(5), nullable=True)  # ej. "12A"
    precio: Mapped[int] = mapped_column(Integer, nullable=False)  # COP, el costo del vuelo al momento
    estado: Mapped[EstadoTiquete] = mapped_column(Enum(EstadoTiquete, name="estado_tiquete"), nullable=False)
    creado_en: Mapped[datetime] = mapped_column(FechaUTC, nullable=False, server_default=func.now())
    cancelado_en: Mapped[datetime | None] = mapped_column(FechaUTC, nullable=True)

    reserva: Mapped[Reserva | None] = relationship(back_populates="tiquetes")
    compra: Mapped[Compra | None] = relationship(back_populates="tiquetes")
    viajero: Mapped[Viajero] = relationship(lazy="joined")
    vuelo: Mapped[Vuelo] = relationship(lazy="joined")
