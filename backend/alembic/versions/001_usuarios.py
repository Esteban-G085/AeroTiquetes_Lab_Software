"""001_usuarios: tablas usuario, root, administrador, cliente

Primera migracion del proyecto (seccion 5.4 del plan de sprint: B1 la
publica primero porque B2 necesita que `administrador` ya exista antes de
crear la FK de `vuelo.id_administrador` en su propia migracion 004_vuelos).

Revision ID: 001_usuarios
Revises:
Create Date: 2026-10-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001_usuarios"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "usuario",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "rol",
            sa.Enum("ROOT", "ADMINISTRADOR", "CLIENTE", "VISITANTE", name="rol_nombre"),
            nullable=False,
        ),
        sa.Column("usuario", sa.String(length=50), nullable=True),
        sa.Column("correo", sa.String(length=255), nullable=True),
        sa.Column("correo_pendiente", sa.String(length=255), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("dni", sa.String(length=30), nullable=True),
        sa.Column("nombres", sa.String(length=100), nullable=True),
        sa.Column("apellidos", sa.String(length=100), nullable=True),
        sa.Column("fecha_nacimiento", sa.Date(), nullable=True),
        sa.Column("lugar_nacimiento", sa.String(length=150), nullable=True),
        sa.Column("direccion_facturacion", sa.String(length=255), nullable=True),
        sa.Column("genero", sa.String(length=30), nullable=True),
        sa.Column("telefono", sa.String(length=30), nullable=True),
        sa.Column("imagen_perfil", sa.String(length=255), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("actualizado_en", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("usuario"),
        sa.UniqueConstraint("correo"),
        sa.UniqueConstraint("dni"),
    )
    op.create_index(op.f("ix_usuario_rol"), "usuario", ["rol"], unique=False)

    op.create_table(
        "root",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["id"], ["usuario.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "administrador",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("estado", sa.Enum("PENDIENTE", "ACTIVO", name="estado_administrador"), nullable=False),
        sa.Column("nombre_invitacion", sa.String(length=150), nullable=False),
        sa.Column("invitado_por_id", sa.Integer(), nullable=True),
        sa.Column("token_invitacion", sa.String(length=500), nullable=True),
        sa.Column("token_expira_en", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["id"], ["usuario.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invitado_por_id"], ["usuario.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "cliente",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["id"], ["usuario.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("cliente")
    op.drop_table("administrador")
    op.drop_table("root")
    op.drop_index(op.f("ix_usuario_rol"), table_name="usuario")
    op.drop_table("usuario")
    # Los tipos ENUM de Postgres no se eliminan solos al hacer drop_table;
    # se limpian explicitamente para que un downgrade deje la BD realmente
    # como estaba antes de esta migracion.
    sa.Enum(name="estado_administrador").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="rol_nombre").drop(op.get_bind(), checkfirst=True)
