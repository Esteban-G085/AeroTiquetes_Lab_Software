"""012_noticia_vuelo_opcional: id_vuelo opcional en noticia

Revision ID: 012_noticia_vuelo_opcional
Revises: 011_asientos
Create Date: 2026-11-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "012_noticia_vuelo_opcional"
down_revision: Union[str, None] = "011_asientos"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Quitar restriccion NOT NULL y UNIQUE de id_vuelo (batch para SQLite).
    with op.batch_alter_table("noticia") as batch_op:
        batch_op.alter_column("id_vuelo", nullable=True, existing_type=sa.Integer())
        batch_op.drop_constraint("noticia_id_vuelo_key", type_="unique")


def downgrade() -> None:
    with op.batch_alter_table("noticia") as batch_op:
        batch_op.create_unique_constraint("noticia_id_vuelo_key", ["id_vuelo"])
        batch_op.alter_column("id_vuelo", nullable=False, existing_type=sa.Integer())
