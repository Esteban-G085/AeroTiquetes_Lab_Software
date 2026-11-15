"""009_noticias: noticia y suscripcion (HU11, B2-15)

Revision ID: 009_noticias
Revises: 008_compras_financiero
Create Date: 2026-11-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009_noticias"
down_revision: Union[str, None] = "008_compras_financiero"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "noticia",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_vuelo", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.String(length=20), server_default="vuelo", nullable=False),
        sa.Column("titulo", sa.String(length=150), nullable=True),
        sa.Column("imagen_url", sa.String(length=500), nullable=True),
        sa.Column("publicada_en", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("vigente_hasta", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["id_vuelo"], ["vuelo.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id_vuelo"),
    )
    op.create_index("ix_noticia_vigente_hasta", "noticia", ["vigente_hasta"])
    op.create_table(
        "suscripcion",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_cliente", sa.Integer(), nullable=False),
        sa.Column("correo", sa.String(length=255), nullable=False),
        sa.Column("creada_en", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["id_cliente"], ["cliente.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id_cliente"),
    )


def downgrade() -> None:
    op.drop_table("suscripcion")
    op.drop_index("ix_noticia_vigente_hasta", table_name="noticia")
    op.drop_table("noticia")
