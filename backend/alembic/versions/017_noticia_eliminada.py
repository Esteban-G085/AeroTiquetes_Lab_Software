"""Borrado logico de noticias (solo administrador).

`eliminada_en` deja la fila en la tabla (para que `publicar_noticias_faltantes`
no vuelva a crear la noticia de un vuelo) pero la saca de las consultas
vigentes, del detalle y del correo a suscriptores.

Revision ID: 017_noticia_eliminada
Revises: 016_movimientos_billetera
Create Date: 2026-11-17
"""
import sqlalchemy as sa
from alembic import op

revision: str = "017_noticia_eliminada"
down_revision: str | None = "016_movimientos_billetera"
branch_labels: str | None = None
depends_on: str | None = None

_INDICE = "ix_noticia_eliminada_en"


def upgrade() -> None:
    op.add_column("noticia", sa.Column("eliminada_en", sa.DateTime(timezone=True), nullable=True))
    op.create_index(_INDICE, "noticia", ["eliminada_en"], unique=False)


def downgrade() -> None:
    op.drop_index(_INDICE, table_name="noticia")
    op.drop_column("noticia", "eliminada_en")
