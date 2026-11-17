"""009_costo_primera: precio diferenciado por clase en vuelo (economica / primera)

Revision ID: 009_costo_primera
Revises: 008_compras_financiero
Create Date: 2026-11-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009_costo_primera"
down_revision: Union[str, None] = "008_compras_financiero"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "vuelo",
        sa.Column("costo_primera", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_check_constraint(
        "ck_vuelo_costo_primera_no_negativo",
        "vuelo",
        "costo_primera >= 0",
    )


def downgrade() -> None:
    op.drop_constraint("ck_vuelo_costo_primera_no_negativo", table_name="vuelo")
    op.drop_column("vuelo", "costo_primera")
