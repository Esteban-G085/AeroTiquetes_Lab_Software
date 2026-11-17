"""013_modelado_noticias: pone las migraciones al dia con los modelos de noticias y asientos.

Revision ID: 013_modelado_noticias
Revises: 012_noticia_vuelo_opcional
Create Date: 2026-11-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "013_modelado_noticias"
down_revision: Union[str, None] = "012_noticia_vuelo_opcional"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_AHORA = sa.text("CURRENT_TIMESTAMP")


def upgrade() -> None:
    # SQLite no soporta ALTER ... ADD CONSTRAINT: batch mode recrea la tabla.
    with op.batch_alter_table("noticia") as batch_op:
        batch_op.alter_column("titulo", existing_type=sa.String(length=200), nullable=True)
        batch_op.add_column(
            sa.Column("tipo", sa.String(length=20), nullable=False, server_default="vuelo")
        )
        batch_op.add_column(
            sa.Column("vigente_hasta", sa.DateTime(timezone=True), nullable=False, server_default=_AHORA)
        )
        batch_op.create_index(op.f("ix_noticia_vigente_hasta"), ["vigente_hasta"], unique=False)

    with op.batch_alter_table("suscripcion") as batch_op:
        batch_op.add_column(
            sa.Column("correo", sa.String(length=255), nullable=False, server_default="")
        )


def downgrade() -> None:
    with op.batch_alter_table("suscripcion") as batch_op:
        batch_op.drop_column("correo")

    with op.batch_alter_table("noticia") as batch_op:
        batch_op.drop_index(op.f("ix_noticia_vigente_hasta"))
        batch_op.drop_column("vigente_hasta")
        batch_op.drop_column("tipo")
        batch_op.alter_column("titulo", existing_type=sa.String(length=200), nullable=False)
