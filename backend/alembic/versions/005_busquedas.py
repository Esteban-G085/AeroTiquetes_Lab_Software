"""005_busquedas: historial de busquedas de clientes

Guarda origen, destino y fecha de salida de lo que busca un cliente autenticado (B2-11).
Si el cliente se elimina, su historial se elimina con el; si una ciudad se elimina, queda en NULL.

Revision ID: 005_busquedas
Revises: 004_vuelos
Create Date: 2026-10-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005_busquedas"
down_revision: Union[str, None] = "004_vuelos"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "busqueda",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_cliente", sa.Integer(), nullable=False),
        sa.Column("id_origen", sa.Integer(), nullable=True),
        sa.Column("id_destino", sa.Integer(), nullable=True),
        sa.Column("fecha_salida", sa.Date(), nullable=True),
        sa.Column("creada_en", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["id_cliente"], ["cliente.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_origen"], ["ciudad.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["id_destino"], ["ciudad.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_busqueda_id_cliente"), "busqueda", ["id_cliente"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_busqueda_id_cliente"), table_name="busqueda")
    op.drop_table("busqueda")
