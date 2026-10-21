"""003_ciudades: tabla ciudad (catalogo en base de datos, RNF13)

El contenido del catalogo (32 capitales + 5 ciudades del exterior) NO se inserta aqui: lo
siembra la aplicacion al arrancar (`app.modules.vuelos.seeds.asegurar_ciudades`, idempotente).

Revision ID: 003_ciudades
Revises: 002_roles
Create Date: 2026-10-20
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_ciudades"
down_revision: Union[str, None] = "002_roles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ciudad",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("codigo", sa.String(length=3), nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("pais", sa.String(length=100), nullable=False),
        sa.Column("zona_horaria", sa.String(length=64), nullable=False),
        sa.Column("es_capital_departamento", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("grupo_internacional", sa.Enum("COLOMBIA", "EXTERIOR", name="grupo_internacional"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("codigo"),
    )


def downgrade() -> None:
    op.drop_table("ciudad")
    # Los tipos ENUM de Postgres no se eliminan solos con drop_table (igual que en 001 y 002).
    sa.Enum(name="grupo_internacional").drop(op.get_bind(), checkfirst=True)
