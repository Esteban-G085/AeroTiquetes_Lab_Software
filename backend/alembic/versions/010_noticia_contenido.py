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
    # 007_noticias ya creo `contenido` (NOT NULL); aqui solo se vuelve opcional
    # para las noticias manuales del administrador.
    with op.batch_alter_table("noticia") as batch_op:
        batch_op.alter_column("contenido", existing_type=sa.Text(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("noticia") as batch_op:
        batch_op.alter_column("contenido", existing_type=sa.Text(), nullable=False)
