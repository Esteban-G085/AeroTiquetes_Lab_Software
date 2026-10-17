"""002_roles: tablas rol, rol_modulo (matriz de permisos de HU24)

Revision ID: 002_roles
Revises: 001_usuarios
Create Date: 2026-10-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_roles"
down_revision: Union[str, None] = "001_usuarios"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "rol",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "nombre",
            sa.Enum("ROOT", "ADMINISTRADOR", "CLIENTE", "VISITANTE", name="rol_nombre_catalogo"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre"),
    )

    op.create_table(
        "rol_modulo",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("rol_id", sa.Integer(), nullable=False),
        sa.Column("modulo", sa.String(length=50), nullable=False),
        sa.Column("permitido", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.ForeignKeyConstraint(["rol_id"], ["rol.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("rol_id", "modulo", name="uq_rol_modulo"),
    )


def downgrade() -> None:
    op.drop_table("rol_modulo")
    op.drop_table("rol")
    sa.Enum(name="rol_nombre_catalogo").drop(op.get_bind(), checkfirst=True)
