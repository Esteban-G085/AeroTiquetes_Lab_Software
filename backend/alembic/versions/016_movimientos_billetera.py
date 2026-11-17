"""Auditoria interna de la billetera (recargas, pagos y reintegros).

Cada `debitar`/`acreditar` deja una fila con el monto con signo y el saldo
resultante. Es uso interno: el historial y los comprobantes siguen fuera del
contrato de cliente (R19/R20), por eso no se expone ninguna ruta nueva.

Revision ID: 016_movimientos_billetera
Revises: 015_bandeja_salida
Create Date: 2026-11-17
"""
import sqlalchemy as sa
from alembic import op

revision: str = "016_movimientos_billetera"
down_revision: str | None = "015_bandeja_salida"
branch_labels: str | None = None
depends_on: str | None = None

_TIPO_ENUM = "tipo_movimiento_billetera"
_INDICE = "ix_movimiento_billetera_id_billetera"


def upgrade() -> None:
    op.create_table(
        "movimiento_billetera",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_billetera", sa.Integer(), nullable=False),
        # SQLAlchemy guarda los NOMBRES del enum (RECARGA/COMPRA/REINTEGRO), igual que en 008.
        sa.Column("tipo", sa.Enum("RECARGA", "COMPRA", "REINTEGRO", name=_TIPO_ENUM), nullable=False),
        sa.Column("monto", sa.Integer(), nullable=False),
        sa.Column("saldo_resultante", sa.Integer(), nullable=False),
        sa.Column("referencia", sa.String(length=80), nullable=True),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.ForeignKeyConstraint(["id_billetera"], ["billetera.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(_INDICE, "movimiento_billetera", ["id_billetera"], unique=False)


def downgrade() -> None:
    op.drop_index(_INDICE, table_name="movimiento_billetera")
    op.drop_table("movimiento_billetera")
    sa.Enum(name=_TIPO_ENUM).drop(op.get_bind(), checkfirst=True)
