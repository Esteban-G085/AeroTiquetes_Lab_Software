"""007_quitar_roles: elimina la matriz de roles (rol, rol_modulo)

Revision ID: 007_quitar_roles
Revises: 008_compras_financiero
Create Date: 2026-11-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007_quitar_roles"
down_revision: Union[str, None] = "008_compras_financiero"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("rol_modulo")
    op.drop_table("rol")


def downgrade() -> None:
    op.create_table(
        "rol",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "rol_modulo",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_rol", sa.Integer(), nullable=False),
        sa.Column("modulo", sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(["id_rol"], ["rol.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
