"""011_asientos: asientos individuales por vuelo (selección de silla)

Revision ID: 011_asientos
Revises: 010_noticia_contenido
Create Date: 2026-11-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "011_asientos"
down_revision: Union[str, None] = "010_noticia_contenido"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "asiento",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_vuelo", sa.Integer(), nullable=False),
        sa.Column("numero", sa.String(length=5), nullable=False),
        sa.Column("fila", sa.Integer(), nullable=False),
        sa.Column("columna", sa.String(length=1), nullable=False),
        sa.Column(
            "clase",
            sa.Enum("ECONOMICA", "PRIMERA", name="clase_asiento"),
            nullable=False,
        ),
        sa.Column(
            "estado",
            sa.Enum(
                "DISPONIBLE", "OCUPADO", "BLOQUEADO", name="estado_asiento"
            ),
            nullable=False,
            server_default="DISPONIBLE",
        ),
        sa.Column("id_tiquete", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["id_vuelo"], ["vuelo.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["id_tiquete"], ["tiquete.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id_vuelo", "numero", name="uq_asiento_vuelo_numero"),
    )
    op.create_index(
        op.f("ix_asiento_id_vuelo"), "asiento", ["id_vuelo"], unique=False
    )
    op.create_index(
        op.f("ix_asiento_estado"), "asiento", ["estado"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_asiento_estado"), table_name="asiento")
    op.drop_index(op.f("ix_asiento_id_vuelo"), table_name="asiento")
    op.drop_table("asiento")
    bind = op.get_bind()
    for nombre in ("estado_asiento", "clase_asiento"):
        sa.Enum(name=nombre).drop(bind, checkfirst=True)
