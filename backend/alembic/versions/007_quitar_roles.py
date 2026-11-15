"""007_quitar_roles: elimina la matriz de roles (rol, rol_modulo)

La gestion de roles (HU24) fue un malentendido: root solo crea administradores y
gestiona su propio perfil. Los permisos por rol son fijos en el codigo
(`require_roles`). `usuario.rol` (enum `rol_nombre`) NO se toca.

Revision ID: 007_quitar_roles
Revises: 006_paises
Create Date: 2026-11-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007_quitar_roles"
down_revision: Union[str, None] = "006_paises"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("rol_modulo")
    op.drop_table("rol")
    sa.Enum(name="rol_nombre_catalogo").drop(op.get_bind(), checkfirst=True)


def downgrade() -> None:
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
