"""
Tipos de columna compartidos por los modulos.
"""
from datetime import datetime, timezone

from sqlalchemy import DateTime
from sqlalchemy.types import TypeDecorator


class FechaUTC(TypeDecorator):
    """`timestamptz` que SIEMPRE entrega datetimes con zona horaria (UTC).

    El plan (seccion 5.3) manda guardar fechas y horas en UTC. PostgreSQL ya devuelve
    datetimes con zona, pero SQLite (que usan las pruebas) no guarda la zona y devuelve
    fechas "ingenuas": compararlas con `datetime.now(timezone.utc)` lanza
    `TypeError: can't compare offset-naive and offset-aware datetimes`.

    Con este tipo, en cualquier base de datos:
      * al GUARDAR se exige un datetime con zona y se convierte a UTC;
      * al LEER siempre se obtiene un datetime con zona UTC.

    En la base de datos sigue siendo un `timestamptz` normal, asi que las migraciones usan
    `sa.DateTime(timezone=True)`.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("Se requiere un datetime con zona horaria (usa timezone.utc).")
        return value.astimezone(timezone.utc)

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:  # SQLite: ya se guardo en UTC
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
