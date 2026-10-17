"""
Modelos SQLAlchemy del modulo Usuarios (B1-01).

Diseno (herencia por tablas unidas / joined-table inheritance):

    usuario (tabla base: login + perfil comun)
      ├── root            (1 fila; su "Id" de acceso es usuario.usuario)
      ├── administrador    (estado pendiente/activo + datos de la invitacion)
      └── cliente          (sin columnas propias aun; aqui se enganchara la
                             billetera en la Iteracion 2 sin tocar `usuario`)

Se eligio este diseno (en vez de una sola tabla ancha) para que cada tabla
hija pueda crecer de forma independiente sin agregar columnas nulas a los
demas roles, y porque la FK de `vuelo.id_administrador` (modulo de B2) puede
apuntar limpiamente a `administrador.id`.

`rol` y `rol_modulo` (migracion 002_roles) implementan la matriz de permisos
de HU24: los 4 roles son fijos (no se crean ni eliminan), pero que modulo ve
cada rol si es editable por el root.
"""
import enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String, UniqueConstraint, func
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


# Los 9 modulos del SRS (RNF12); el Sprint 1 solo usa "usuarios",
# "administracion_vuelos" y "busqueda", pero la matriz completa se siembra
# desde ahora para que HU24 no deba volver a migrar en iteraciones futuras.
MODULOS_SISTEMA: tuple[str, ...] = (
    "administracion_vuelos",
    "compra_reserva",
    "usuarios",
    "noticias",
    "busqueda",
    "gestion_financiera",
    "checkin_silla",
    "recomendacion",
    "chatbot",
)


# Nombre legible de cada modulo (lo usa la pantalla "Gestionar roles" del front
# como encabezado de columna; el id es el que se guarda en la base de datos).
MODULOS_NOMBRES: dict[str, str] = {
    "administracion_vuelos": "Administración de vuelos",
    "compra_reserva": "Compra y reserva",
    "usuarios": "Usuarios",
    "noticias": "Noticias",
    "busqueda": "Búsqueda",
    "gestion_financiera": "Gestión financiera",
    "checkin_silla": "Check-in y silla",
    "recomendacion": "Recomendación",
    "chatbot": "Chatbot",
}


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
    # Sin columnas propias en este sprint; la billetera (Iteracion 2) se
    # engancha aqui mas adelante sin tocar `usuario`.

    usuario: Mapped[Usuario] = relationship(back_populates="cliente")


class Rol(Base):
    """Los 4 roles del sistema. Fila fija, sembrada una sola vez (HU24: no se
    crean ni eliminan roles, solo se activan/desactivan sus modulos)."""

    __tablename__ = "rol"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[RolNombre] = mapped_column(Enum(RolNombre, name="rol_nombre_catalogo"), unique=True, nullable=False)

    modulos: Mapped[list["RolModulo"]] = relationship(back_populates="rol", cascade="all, delete-orphan")


class RolModulo(Base):
    """Matriz rol x modulo (HU24). `permitido` es lo unico editable por root."""

    __tablename__ = "rol_modulo"
    __table_args__ = (UniqueConstraint("rol_id", "modulo", name="uq_rol_modulo"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    rol_id: Mapped[int] = mapped_column(ForeignKey("rol.id", ondelete="CASCADE"), nullable=False)
    modulo: Mapped[str] = mapped_column(String(50), nullable=False)
    permitido: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    rol: Mapped[Rol] = relationship(back_populates="modulos")
