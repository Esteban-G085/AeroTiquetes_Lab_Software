"""
Modelos SQLAlchemy de Ciudades y Vuelos (B2-02).

Tablas (seccion 9 del plan, ajustada al contrato de F2 en `frontend/docs/CONTRATO_VUELOS.md`):

    ciudad   catalogo en la base de datos, no en el codigo (RNF13)
    vuelo    un vuelo programado por un administrador

Decisiones a tener en cuenta:

* `ciudad.codigo` es obligatorio y unico (3 letras). El plan lo marca como opcional, pero el
  contrato de F2 lo usa como clave estable: es lo que viaja en origen/destino.
* Fechas en UTC (`FechaUTC`, seccion 5.3). La hora local se calcula con la `zona_horaria` de la ciudad.
* `vuelo.codigo` es el consecutivo `AT-####` generado por el sistema (D3); se deriva del `id`
  (ver `service.crear_vuelo`), asi dos programaciones simultaneas nunca repiten codigo.
* `vuelo.id_administrador` es OPCIONAL y se pone en NULL si el administrador se elimina
  (HU23 permite eliminar administradores). Con la FK obligatoria, eliminar a un admin que
  hubiera programado vuelos fallaria en PostgreSQL. Los vuelos de ejemplo tampoco tienen admin.
* Sin aerolinea, numero manual, `es_directo` ni asientos libres (D3). La tabla `silla` se crea
  en la Iteracion 2; `cupos_*` guardan la disponibilidad actual por clase (D4).
"""
import enum
from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, Enum, ForeignKey, Integer, String, false, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base
from app.core.tipos import FechaUTC

# La FK `vuelo.id_administrador` apunta a `administrador`: esa tabla debe estar en los mismos
# metadatos sin importar en que orden se importen los modulos.
from app.modules.usuarios import models as _usuarios_models  # noqa: F401


class TipoVuelo(str, enum.Enum):
    NACIONAL = "nacional"
    INTERNACIONAL = "internacional"


class EstadoVuelo(str, enum.Enum):
    """D16: el enum incluye los 4 estados desde la migracion inicial."""

    PROGRAMADO = "programado"
    SUCEDIDO = "sucedido"
    REALIZADO = "realizado"
    CANCELADO = "cancelado"


class GrupoInternacional(str, enum.Enum):
    """D5: un vuelo internacional une una ciudad de cada grupo, en cualquier sentido."""

    COLOMBIA = "colombia"
    EXTERIOR = "exterior"


# Capacidad automatica por tipo (D4): (economica, primera). Nacional 150, internacional 250.
CUPOS_POR_TIPO: dict[TipoVuelo, tuple[int, int]] = {
    TipoVuelo.NACIONAL: (125, 25),
    TipoVuelo.INTERNACIONAL: (200, 50),
}


def codigo_para(id_vuelo: int) -> str:
    """Codigo consecutivo visible: AT-0001, AT-0002, ... (D3)."""
    return f"AT-{id_vuelo:04d}"


class Ciudad(Base):
    __tablename__ = "ciudad"

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(3), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    pais: Mapped[str] = mapped_column(String(100), nullable=False)
    zona_horaria: Mapped[str] = mapped_column(String(64), nullable=False)  # IANA, ej. America/Bogota
    es_capital_departamento: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    grupo_internacional: Mapped[GrupoInternacional | None] = mapped_column(
        Enum(GrupoInternacional, name="grupo_internacional"), nullable=True
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Ciudad {self.codigo} {self.nombre!r}>"


class Vuelo(Base):
    __tablename__ = "vuelo"
    __table_args__ = (
        CheckConstraint("id_origen <> id_destino", name="ck_vuelo_origen_distinto_destino"),
        CheckConstraint("duracion_min > 0", name="ck_vuelo_duracion_positiva"),
        CheckConstraint("costo > 0", name="ck_vuelo_costo_positivo"),
        CheckConstraint("cupos_primera >= 0 AND cupos_economica >= 0", name="ck_vuelo_cupos_no_negativos"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)

    # Indices en origen, destino y fecha: la busqueda debe responder en <= 3 s (RNF01).
    id_origen: Mapped[int] = mapped_column(ForeignKey("ciudad.id"), nullable=False, index=True)
    id_destino: Mapped[int] = mapped_column(ForeignKey("ciudad.id"), nullable=False, index=True)
    tipo: Mapped[TipoVuelo] = mapped_column(Enum(TipoVuelo, name="tipo_vuelo"), nullable=False)

    salida_utc: Mapped[datetime] = mapped_column(FechaUTC, nullable=False, index=True)
    duracion_min: Mapped[int] = mapped_column(Integer, nullable=False)
    llegada_utc: Mapped[datetime] = mapped_column(FechaUTC, nullable=False)  # salida + duracion (D15)

    costo: Mapped[int] = mapped_column(Integer, nullable=False)  # COP por persona; igual para todas las clases
    estado: Mapped[EstadoVuelo] = mapped_column(
        Enum(EstadoVuelo, name="estado_vuelo"), nullable=False, default=EstadoVuelo.PROGRAMADO
    )
    cupos_primera: Mapped[int] = mapped_column(Integer, nullable=False)
    cupos_economica: Mapped[int] = mapped_column(Integer, nullable=False)

    fecha_programacion: Mapped[datetime] = mapped_column(FechaUTC, nullable=False, server_default=func.now())
    id_administrador: Mapped[int | None] = mapped_column(
        ForeignKey("administrador.id", ondelete="SET NULL"), nullable=True
    )

    origen: Mapped[Ciudad] = relationship(foreign_keys=[id_origen], lazy="joined")
    destino: Mapped[Ciudad] = relationship(foreign_keys=[id_destino], lazy="joined")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Vuelo {self.codigo} {self.estado}>"


class Busqueda(Base):
    """Historial de busquedas de un cliente autenticado (B2-11, `005_busquedas`).

    Lo necesita el modulo de Recomendacion (Iteracion 4) y no se puede reconstruir despues.
    Guarda lo que el cliente busco: origen, destino y fecha de salida (cualquiera puede faltar).
    Vive aqui, junto a `Ciudad`, para que los metadatos de Alembic y de las pruebas la incluyan.
    """

    __tablename__ = "busqueda"

    id: Mapped[int] = mapped_column(primary_key=True)
    id_cliente: Mapped[int] = mapped_column(ForeignKey("cliente.id", ondelete="CASCADE"), nullable=False, index=True)
    id_origen: Mapped[int | None] = mapped_column(ForeignKey("ciudad.id", ondelete="SET NULL"), nullable=True)
    id_destino: Mapped[int | None] = mapped_column(ForeignKey("ciudad.id", ondelete="SET NULL"), nullable=True)
    fecha_salida: Mapped[date | None] = mapped_column(Date, nullable=True)  # dia buscado, en hora de Colombia
    creada_en: Mapped[datetime] = mapped_column(FechaUTC, nullable=False, server_default=func.now())

    origen: Mapped[Ciudad | None] = relationship(foreign_keys=[id_origen], lazy="joined")
    destino: Mapped[Ciudad | None] = relationship(foreign_keys=[id_destino], lazy="joined")
