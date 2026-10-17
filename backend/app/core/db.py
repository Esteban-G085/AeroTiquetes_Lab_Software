"""
Conexion a la base de datos (SQLAlchemy 2.x, sesiones sincronas).

Usa psycopg (v3) contra PostgreSQL en desarrollo/produccion. En los tests,
conftest.py sobre-escribe `DATABASE_URL` por una base SQLite en archivo
temporal, separada de la de desarrollo (seccion 5.1 del plan de sprint).
"""
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

_connect_args = {"check_same_thread": False} if settings.is_sqlite else {}

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, connect_args=_connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Clase base declarativa compartida por todos los modulos (usuarios, y en
    el futuro vuelos/busqueda), para que todas las tablas vivan en los mismos
    metadatos y Alembic las detecte sin configuracion adicional."""
    pass


def get_db() -> Generator[Session, None, None]:
    """Dependencia de FastAPI: una sesion por request, cerrada siempre al final."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    """Para usar fuera de un request (ej. el seed del root al arrancar)."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
