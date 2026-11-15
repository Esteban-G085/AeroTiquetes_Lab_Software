"""
Modelos SQLAlchemy del modulo Usuarios (B1-01).

Diseno (herencia por tablas unidas / joined-table inheritance):

    usuario (tabla base: login + perfil comun)
      ├── root            (1 fila; su "Id" de acceso es usuario.usuario)
      ├── administrador    (estado pendiente/activo + datos de la invitacion)
      └── cliente          (sin columnas propias; su billetera y sus tiquetes viven en
                             el modulo de compras y apuntan a `cliente.id`)

Se eligio este diseno (en vez de una sola tabla ancha) para que cada tabla
hija pueda crecer de forma independiente sin agregar columnas nulas a los
demas roles, y porque la FK de `vuelo.id_administrador` (modulo de B2) puede
apuntar limpiamente a `administrador.id`.

Los permisos por rol son fijos y se aplican con `require_roles(...)` (core/deps).
No existe gestion de roles: root solo crea administradores y gestiona su propio
perfil (la matriz rol x modulo de la migracion 002 se elimino en la 007).
"""
import enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class RolNombre(str, enum.Enum):
    ROOT = "root"
    ADMINISTRADOR = "administrador"
    CLIENTE = "cliente"
    VISITANTE = "visitante"


class EstadoAdministrador(str, enum.Enum):
    PENDIENTE = "pendiente"
    ACTIVO = "activo"


class TimestampMixin:
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Usuario(Base, TimestampMixin):
    """Tabla base: toda cuenta con acceso al sistema (root, administrador o
    cliente) tiene exactamente una fila aqui. 'visitante' no tiene cuenta."""

    __tablename__ = "usuario"

    id: Mapped[int] = mapped_column(primary_key=True)
    rol: Mapped[RolNombre] = mapped_column(Enum(RolNombre, name="rol_nombre"), nullable=False, index=True)

    # Credenciales. `usuario` es el Id del root y el nombre de usuario de
    # administrador/cliente; ambos son unicos pero nullable porque un admin
    # "pendiente" todavia no los ha elegido (D6).
    usuario: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True)
    correo: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    # Correo propuesto mientras se verifica el cambio (D8); se promueve a
    # `correo` solo cuando el enlace de verificacion se confirma.
    correo_pendiente: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Perfil (R03-R12 de Usuarios; comun a administrador y cliente, D2).
    dni: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True)
    nombres: Mapped[str | None] = mapped_column(String(100), nullable=True)
    apellidos: Mapped[str | None] = mapped_column(String(100), nullable=True)
    fecha_nacimiento: Mapped[date | None] = mapped_column(Date, nullable=True)
    lugar_nacimiento: Mapped[str | None] = mapped_column(String(150), nullable=True)
    direccion_facturacion: Mapped[str | None] = mapped_column(String(255), nullable=True)
    genero: Mapped[str | None] = mapped_column(String(30), nullable=True)
    telefono: Mapped[str | None] = mapped_column(String(30), nullable=True)  # opcional (D1/HU4)
    imagen_perfil: Mapped[str | None] = mapped_column(String(255), nullable=True)

    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    root: Mapped["Root | None"] = relationship(back_populates="usuario", cascade="all, delete-orphan", uselist=False)
    administrador: Mapped["Administrador | None"] = relationship(
        back_populates="usuario",
        cascade="all, delete-orphan",
        uselist=False,
        # `Administrador` tiene dos FK hacia `usuario` (su propia PK y
        # `invitado_por_id`, el root que lo invito); hay que indicar
        # explicitamente cual de las dos arma esta relacion 1 a 1.
        foreign_keys="Administrador.id",
    )
    cliente: Mapped["Cliente | None"] = relationship(
        back_populates="usuario", cascade="all, delete-orphan", uselist=False
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Usuario id={self.id} usuario={self.usuario!r} rol={self.rol}>"


class Root(Base):
    __tablename__ = "root"

    id: Mapped[int] = mapped_column(ForeignKey("usuario.id", ondelete="CASCADE"), primary_key=True)
    usuario: Mapped[Usuario] = relationship(back_populates="root")


class Administrador(Base):
    __tablename__ = "administrador"

    id: Mapped[int] = mapped_column(ForeignKey("usuario.id", ondelete="CASCADE"), primary_key=True)
    estado: Mapped[EstadoAdministrador] = mapped_column(
        Enum(EstadoAdministrador, name="estado_administrador"),
        default=EstadoAdministrador.PENDIENTE,
        nullable=False,
    )
    # Nombre informativo capturado al momento de la invitacion (antes de que
    # el admin complete su propio registro con nombres/apellidos reales).
    nombre_invitacion: Mapped[str] = mapped_column(String(150), nullable=False)
    invitado_por_id: Mapped[int | None] = mapped_column(ForeignKey("usuario.id"), nullable=True)
    token_invitacion: Mapped[str | None] = mapped_column(String(500), nullable=True)
    token_expira_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    usuario: Mapped[Usuario] = relationship(back_populates="administrador", foreign_keys=[id])


class Cliente(Base):
    __tablename__ = "cliente"

    id: Mapped[int] = mapped_column(ForeignKey("usuario.id", ondelete="CASCADE"), primary_key=True)
    # Sin columnas propias: billetera, viajeros, reservas y compras apuntan a `cliente.id`.

    usuario: Mapped[Usuario] = relationship(back_populates="cliente")
