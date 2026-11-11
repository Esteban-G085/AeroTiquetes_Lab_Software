"""007_noticias: noticia, suscripcion, mensaje y respuesta (Sprint 2, B2-11)

`mensaje` y `respuesta` se crean ahora (lo pide el plan del Sprint 2) pero se usan en las
Iteraciones 3 y 4.

Revision ID: 007_noticias
Revises: 006_paises
Create Date: 2026-11-10
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007_noticias"
down_revision: Union[str, None] = "006_paises"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_AHORA = sa.text("CURRENT_TIMESTAMP")


def upgrade() -> None:
    op.create_table(
        "noticia",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_vuelo", sa.Integer(), nullable=False),
        sa.Column("titulo", sa.String(length=200), nullable=False),
        sa.Column("contenido", sa.Text(), nullable=False),
        sa.Column("imagen_url", sa.String(length=500), nullable=True),
        sa.Column("publicada_en", sa.DateTime(timezone=True), server_default=_AHORA, nullable=False),
        sa.ForeignKeyConstraint(["id_vuelo"], ["vuelo.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id_vuelo"),
    )
    op.create_index(op.f("ix_noticia_publicada_en"), "noticia", ["publicada_en"], unique=False)

    op.create_table(
        "suscripcion",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_cliente", sa.Integer(), nullable=False),
        sa.Column("activa", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("token_cancelacion", sa.String(length=64), nullable=False),
        sa.Column("creada_en", sa.DateTime(timezone=True), server_default=_AHORA, nullable=False),
        sa.Column("cancelada_en", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["id_cliente"], ["cliente.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id_cliente"),
        sa.UniqueConstraint("token_cancelacion"),
    )

    op.create_table(
        "mensaje",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_cliente", sa.Integer(), nullable=False),
        sa.Column("asunto", sa.String(length=150), nullable=False),
        sa.Column("contenido", sa.Text(), nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=_AHORA, nullable=False),
        sa.ForeignKeyConstraint(["id_cliente"], ["cliente.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_mensaje_id_cliente"), "mensaje", ["id_cliente"], unique=False)

    op.create_table(
        "respuesta",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_mensaje", sa.Integer(), nullable=False),
        sa.Column("id_administrador", sa.Integer(), nullable=True),
        sa.Column("contenido", sa.Text(), nullable=False),
        sa.Column("creada_en", sa.DateTime(timezone=True), server_default=_AHORA, nullable=False),
        sa.ForeignKeyConstraint(["id_mensaje"], ["mensaje.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_administrador"], ["administrador.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_respuesta_id_mensaje"), "respuesta", ["id_mensaje"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_respuesta_id_mensaje"), table_name="respuesta")
    op.drop_table("respuesta")
    op.drop_index(op.f("ix_mensaje_id_cliente"), table_name="mensaje")
    op.drop_table("mensaje")
    op.drop_table("suscripcion")
    op.drop_index(op.f("ix_noticia_publicada_en"), table_name="noticia")
    op.drop_table("noticia")
