"""010_noticia_contenido: campo contenido en noticia para noticias creadas por admin

Revision ID: 010_noticia_contenido
Revises: 009_costo_primera
Create Date: 2026-11-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "010_noticia_contenido"
down_revision: Union[str, None] = "009_costo_primera"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "noticia",
        sa.Column("contenido", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("noticia", "contenido")
