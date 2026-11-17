"""009_costo_primera: precio diferenciado por clase en vuelo (economica / primera)

Revision ID: 009_costo_primera
Revises: 007_quitar_roles
Create Date: 2026-11-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009_costo_primera"
down_revision: Union[str, None] = "007_quitar_roles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite no soporta ALTER ... ADD CONSTRAINT: batch mode recrea la tabla.
    with op.batch_alter_table("vuelo") as batch_op:
        batch_op.add_column(
            sa.Column("costo_primera", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.create_check_constraint(
            "ck_vuelo_costo_primera_no_negativo",
            "costo_primera >= 0",
        )


def downgrade() -> None:
    with op.batch_alter_table("vuelo") as batch_op:
        batch_op.drop_constraint("ck_vuelo_costo_primera_no_negativo", type_="check")
        batch_op.drop_column("costo_primera")
