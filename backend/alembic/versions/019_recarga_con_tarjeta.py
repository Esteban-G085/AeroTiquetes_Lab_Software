"""019_recarga_con_tarjeta: auditar la tarjeta usada al recargar la billetera.

`MovimientoBilletera` sigue siendo auditoria interna, pero ahora guarda que
tarjeta registrada se selecciono para la recarga. Es nullable y usa ON DELETE SET NULL
para no borrar movimientos historicos si la persona elimina la tarjeta.

Revision ID: 019_recarga_con_tarjeta
Revises: 018_ubicacion_facturacion
Create Date: 2026-11-19
"""
import sqlalchemy as sa
from alembic import op

revision: str = "019_recarga_con_tarjeta"
down_revision: str | None = "018_ubicacion_facturacion"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    with op.batch_alter_table("movimiento_billetera") as batch_op:
        batch_op.add_column(sa.Column("id_tarjeta", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_movimiento_billetera_id_tarjeta_tarjeta", "tarjeta",
            ["id_tarjeta"], ["id"], ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("movimiento_billetera") as batch_op:
        batch_op.drop_column("id_tarjeta")
