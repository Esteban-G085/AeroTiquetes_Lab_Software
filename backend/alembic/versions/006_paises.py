"""006_paises: catálogo de países para lugar de nacimiento

Añade la tabla `pais` con nombres canónicos activos para validar
`lugar_nacimiento` en registro de clientes, completar registro de
administradores y edición de perfil.

Revision ID: 006_paises
Revises: 005_busquedas
Create Date: 2026-10-23
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.modules.catalogos.seeds import PAISES_SEMILLA


revision: str = "006_paises"
down_revision: Union[str, None] = "005_busquedas"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pais",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("codigo_iso2", sa.String(length=2), nullable=True),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("orden", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("actualizado_en", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("codigo_iso2"),
    )
    # `unique=True` + `index=True` en el modelo se traduce en un indice unico.
    op.create_index(op.f("ix_pais_nombre"), "pais", ["nombre"], unique=True)
    op.create_index(op.f("ix_pais_activo"), "pais", ["activo"], unique=False)

    pais_table = sa.table(
        "pais",
        sa.column("codigo_iso2", sa.String),
        sa.column("nombre", sa.String),
        sa.column("activo", sa.Boolean),
        sa.column("orden", sa.Integer),
    )
    op.bulk_insert(
        pais_table,
        [
            {"codigo_iso2": codigo, "nombre": nombre, "activo": True, "orden": orden}
            for orden, (codigo, nombre) in enumerate(PAISES_SEMILLA)
        ],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_pais_activo"), table_name="pais")
    op.drop_index(op.f("ix_pais_nombre"), table_name="pais")
    op.drop_table("pais")
