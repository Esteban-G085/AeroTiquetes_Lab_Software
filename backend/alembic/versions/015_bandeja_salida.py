"""Bandeja de salida de correos con reintentos.

Los codigos de reserva se guardan antes de intentar enviarlos: si el SMTP cae,
el worker reintenta sin perder el mensaje ni deshacer la compra.

Revision ID: 015_bandeja_salida
Revises: 014_sillas_texto
Create Date: 2026-11-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "015_bandeja_salida"
down_revision: Union[str, None] = "014_sillas_texto"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_AHORA = sa.text("CURRENT_TIMESTAMP")


def upgrade() -> None:
    op.create_table(
        "notificacion_pendiente",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.String(length=40), nullable=False),
        sa.Column("destinatario", sa.String(length=255), nullable=False),
        sa.Column("asunto", sa.String(length=200), nullable=False),
        sa.Column("cuerpo_html", sa.Text(), nullable=False),
        sa.Column("estado", sa.String(length=15), nullable=False, server_default="pendiente"),
        sa.Column("intentos", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("creada_en", sa.DateTime(timezone=True), nullable=False, server_default=_AHORA),
        sa.Column("proximo_intento_en", sa.DateTime(timezone=True), nullable=False, server_default=_AHORA),
        sa.Column("ultimo_error", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notificacion_pendiente_tipo"), "notificacion_pendiente", ["tipo"], unique=False)
    op.create_index(op.f("ix_notificacion_pendiente_estado"), "notificacion_pendiente", ["estado"], unique=False)
    op.create_index(op.f("ix_notificacion_pendiente_creada_en"), "notificacion_pendiente", ["creada_en"], unique=False)
    op.create_index(
        op.f("ix_notificacion_pendiente_proximo_intento_en"),
        "notificacion_pendiente", ["proximo_intento_en"], unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_notificacion_pendiente_proximo_intento_en"), table_name="notificacion_pendiente")
    op.drop_index(op.f("ix_notificacion_pendiente_creada_en"), table_name="notificacion_pendiente")
    op.drop_index(op.f("ix_notificacion_pendiente_estado"), table_name="notificacion_pendiente")
    op.drop_index(op.f("ix_notificacion_pendiente_tipo"), table_name="notificacion_pendiente")
    op.drop_table("notificacion_pendiente")
