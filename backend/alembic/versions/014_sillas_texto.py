"""Unificar el numero de silla como texto y reconciliar el mapa de asientos.

`tiquete.numero_silla` era INTEGER (1..150 / 1..250) mientras que `asiento.numero`
es texto ("1A", "25E"). Con la seleccion manual de sillas ambas representaciones
chocaban. Esta migracion:

1. Convierte `tiquete.numero_silla` a VARCHAR(5).
2. Traduce los numeros antiguos a etiquetas de fila/columna (5 columnas por fila).
3. Marca como OCUPADO y vincula el `Asiento` correspondiente en los tiquetes activos,
   para que el mapa refleje tambien las sillas asignadas automaticamente.

Revision ID: 014_sillas_texto
Revises: 013_modelado_noticias
Create Date: 2026-11-17
"""
import re

from alembic import op
import sqlalchemy as sa

revision = "014_sillas_texto"
down_revision = "013_modelado_noticias"
branch_labels = None
depends_on = None

_COLUMNAS = "ABCDE"
_ACTIVOS = ("RESERVADO", "COMPRADO")


def _tablas():
    tiquete = sa.table(
        "tiquete",
        sa.column("id", sa.Integer),
        sa.column("id_vuelo", sa.Integer),
        sa.column("numero_silla", sa.String(5)),
        sa.column("estado", sa.String(20)),
    )
    asiento = sa.table(
        "asiento",
        sa.column("id", sa.Integer),
        sa.column("id_vuelo", sa.Integer),
        sa.column("numero", sa.String(5)),
        sa.column("estado", sa.String(20)),
        sa.column("id_tiquete", sa.Integer),
    )
    return tiquete, asiento


def upgrade() -> None:
    bind = op.get_bind()
    tiquete, asiento = _tablas()

    with op.batch_alter_table("tiquete") as batch:
        batch.alter_column(
            "numero_silla",
            existing_type=sa.Integer(),
            type_=sa.String(5),
            existing_nullable=True,
            postgresql_using="numero_silla::text",
        )

    filas = bind.execute(
        sa.select(tiquete.c.id, tiquete.c.id_vuelo, tiquete.c.numero_silla, tiquete.c.estado)
        .where(tiquete.c.numero_silla.is_not(None))
    ).mappings()

    for fila in filas:
        valor = str(fila.numero_silla)
        try:
            n = int(valor)
            numero = f"{(n - 1) // 5 + 1}{_COLUMNAS[(n - 1) % 5]}"
        except ValueError:
            numero = valor  # ya era una etiqueta ("12A")
        if numero != valor:
            bind.execute(
                sa.update(tiquete).where(tiquete.c.id == fila.id).values(numero_silla=numero)
            )
        if fila.estado in _ACTIVOS:
            bind.execute(
                sa.update(asiento)
                .where(asiento.c.id_vuelo == fila.id_vuelo, asiento.c.numero == numero)
                .values(estado="OCUPADO", id_tiquete=fila.id)
            )


def downgrade() -> None:
    bind = op.get_bind()
    tiquete, asiento = _tablas()

    bind.execute(
        sa.update(asiento)
        .where(asiento.c.id_tiquete.is_not(None))
        .values(estado="DISPONIBLE", id_tiquete=None)
    )

    filas = bind.execute(
        sa.select(tiquete.c.id, tiquete.c.numero_silla)
        .where(tiquete.c.numero_silla.is_not(None))
    ).mappings()
    for fila in filas:
        valor = str(fila.numero_silla)
        try:
            n = int(valor)
        except ValueError:
            etiqueta = re.fullmatch(r"(\d+)([A-E])", valor)
            if etiqueta is None:
                bind.execute(
                    sa.update(tiquete).where(tiquete.c.id == fila.id).values(numero_silla=None)
                )
                continue
            fila_numero = int(etiqueta.group(1))
            n = (fila_numero - 1) * len(_COLUMNAS) + _COLUMNAS.index(etiqueta.group(2)) + 1
        bind.execute(
            sa.update(tiquete).where(tiquete.c.id == fila.id).values(numero_silla=n)
        )

    with op.batch_alter_table("tiquete") as batch:
        batch.alter_column(
            "numero_silla",
            existing_type=sa.String(5),
            type_=sa.Integer(),
            existing_nullable=True,
            postgresql_using="numero_silla::integer",
        )
