"""004_vuelos: tabla vuelo

Depende de `001_usuarios` (FK a `administrador`) y de `003_ciudades` (FK a `ciudad`); por eso
cuelga de la 003, que a su vez cuelga de la 002 de B1 (seccion 5.4 del plan: una sola cabeza).

`id_administrador` es opcional y pasa a NULL si el administrador se elimina (HU23).

Revision ID: 004_vuelos
Revises: 003_ciudades
Create Date: 2026-10-20
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_vuelos"
down_revision: Union[str, None] = "003_ciudades"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "vuelo",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("codigo", sa.String(length=20), nullable=False),
        sa.Column("id_origen", sa.Integer(), nullable=False),
        sa.Column("id_destino", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.Enum("NACIONAL", "INTERNACIONAL", name="tipo_vuelo"), nullable=False),
        sa.Column("salida_utc", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duracion_min", sa.Integer(), nullable=False),
        sa.Column("llegada_utc", sa.DateTime(timezone=True), nullable=False),
        sa.Column("costo", sa.Integer(), nullable=False),
        sa.Column(
            "estado",
            sa.Enum("PROGRAMADO", "SUCEDIDO", "REALIZADO", "CANCELADO", name="estado_vuelo"),
            nullable=False,
        ),
        sa.Column("cupos_primera", sa.Integer(), nullable=False),
        sa.Column("cupos_economica", sa.Integer(), nullable=False),
        sa.Column(
            "fecha_programacion",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("id_administrador", sa.Integer(), nullable=True),
        sa.CheckConstraint("id_origen <> id_destino", name="ck_vuelo_origen_distinto_destino"),
        sa.CheckConstraint("duracion_min > 0", name="ck_vuelo_duracion_positiva"),
        sa.CheckConstraint("costo > 0", name="ck_vuelo_costo_positivo"),
        sa.CheckConstraint("cupos_primera >= 0 AND cupos_economica >= 0", name="ck_vuelo_cupos_no_negativos"),
        sa.ForeignKeyConstraint(["id_origen"], ["ciudad.id"]),
        sa.ForeignKeyConstraint(["id_destino"], ["ciudad.id"]),
        sa.ForeignKeyConstraint(["id_administrador"], ["administrador.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("codigo"),
    )
    # RNF01: la busqueda filtra por origen, destino y fecha de salida.
    op.create_index(op.f("ix_vuelo_id_origen"), "vuelo", ["id_origen"], unique=False)
    op.create_index(op.f("ix_vuelo_id_destino"), "vuelo", ["id_destino"], unique=False)
    op.create_index(op.f("ix_vuelo_salida_utc"), "vuelo", ["salida_utc"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_vuelo_salida_utc"), table_name="vuelo")
    op.drop_index(op.f("ix_vuelo_id_destino"), table_name="vuelo")
    op.drop_index(op.f("ix_vuelo_id_origen"), table_name="vuelo")
    op.drop_table("vuelo")
    sa.Enum(name="estado_vuelo").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="tipo_vuelo").drop(op.get_bind(), checkfirst=True)
