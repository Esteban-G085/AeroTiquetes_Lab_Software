"""Servicios del modulo catalogos."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.catalogos.models import Pais


def listar_paises_activos(db: Session) -> list[Pais]:
    stmt = select(Pais).where(Pais.activo.is_(True)).order_by(Pais.orden.asc(), Pais.nombre.asc())
    return list(db.scalars(stmt).all())


def obtener_pais_canonico(db: Session, valor: str) -> Pais | None:
    """Busca un pais activo por nombre (case-insensitive), ignorando espacios."""
    if not valor:
        return None
    nombre = valor.strip()
    if not nombre:
        return None
    stmt = select(Pais).where(Pais.activo.is_(True)).where(Pais.nombre.ilike(nombre))
    return db.scalars(stmt).first()
