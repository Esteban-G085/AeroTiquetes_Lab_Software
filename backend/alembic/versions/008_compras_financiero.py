"""008_compras_financiero: viajero, reserva, compra, tiquete, billetera y tarjeta (B1-11)

Revision ID: 008_compras_financiero
Revises: 007_quitar_roles
Create Date: 2026-11-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008_compras_financiero"
down_revision: Union[str, None] = "007_noticias"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ACTIVO = sa.text("estado IN ('RESERVADO', 'COMPRADO')")


def upgrade() -> None:
    # ------------------------------------------------------------ gestion financiera
    op.create_table(
        "billetera",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_cliente", sa.Integer(), nullable=False),
        sa.Column("saldo", sa.Integer(), server_default="0", nullable=False),
        sa.CheckConstraint("saldo >= 0", name="ck_billetera_saldo_no_negativo"),
        sa.ForeignKeyConstraint(["id_cliente"], ["cliente.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id_cliente"),
    )
    op.create_table(
        "tarjeta",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_billetera", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.Enum("CREDITO", "DEBITO", name="tipo_tarjeta"), nullable=False),
        sa.Column("numero", sa.String(length=19), nullable=False),
        sa.Column("titular", sa.String(length=150), nullable=False),
        sa.Column("fecha_expiracion", sa.String(length=7), nullable=False),
        sa.Column("codigo", sa.String(length=4), nullable=False),
        sa.ForeignKeyConstraint(["id_billetera"], ["billetera.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id_billetera", "numero", name="uq_tarjeta_billetera_numero"),
    )
    op.create_index(op.f("ix_tarjeta_id_billetera"), "tarjeta", ["id_billetera"], unique=False)

    # ------------------------------------------------------------ compra y reserva
    op.create_table(
        "viajero",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_cliente", sa.Integer(), nullable=False),
        sa.Column("documento", sa.String(length=30), nullable=False),
        sa.Column("nombres", sa.String(length=100), nullable=False),
        sa.Column("apellidos", sa.String(length=100), nullable=False),
        sa.Column("fecha_nacimiento", sa.Date(), nullable=False),
        sa.Column("genero", sa.String(length=30), nullable=False),
        sa.Column("telefono", sa.String(length=30), nullable=False),
        sa.Column("correo", sa.String(length=255), nullable=False),
        sa.Column("nombre_contacto", sa.String(length=150), nullable=False),
        sa.Column("telefono_contacto", sa.String(length=30), nullable=False),
        sa.ForeignKeyConstraint(["id_cliente"], ["cliente.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id_cliente", "documento", name="uq_viajero_cliente_documento"),
    )
    op.create_index(op.f("ix_viajero_id_cliente"), "viajero", ["id_cliente"], unique=False)

    op.create_table(
        "reserva",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_cliente", sa.Integer(), nullable=False),
        sa.Column("estado", sa.Enum("ACTIVA", "COMPRADA", "CANCELADA", "VENCIDA", name="estado_reserva"), nullable=False),
        sa.Column("creada_en", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("expira_en", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["id_cliente"], ["cliente.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_reserva_id_cliente"), "reserva", ["id_cliente"], unique=False)
    op.create_index(op.f("ix_reserva_expira_en"), "reserva", ["expira_en"], unique=False)

    op.create_table(
        "compra",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_cliente", sa.Integer(), nullable=False),
        sa.Column("id_reserva", sa.Integer(), nullable=True),
        sa.Column(
            "estado",
            sa.Enum("PAGADA", "PARCIALMENTE_CANCELADA", "CANCELADA", name="estado_compra"),
            nullable=False,
        ),
        sa.Column("total", sa.Integer(), nullable=False),
        sa.Column("pagada_en", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["id_cliente"], ["cliente.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_reserva"], ["reserva.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id_reserva"),
    )
    op.create_index(op.f("ix_compra_id_cliente"), "compra", ["id_cliente"], unique=False)

    op.create_table(
        "tiquete",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_cliente", sa.Integer(), nullable=False),
        sa.Column("id_reserva", sa.Integer(), nullable=True),
        sa.Column("id_compra", sa.Integer(), nullable=True),
        sa.Column("id_viajero", sa.Integer(), nullable=False),
        sa.Column("id_vuelo", sa.Integer(), nullable=False),
        sa.Column("documento", sa.String(length=30), nullable=False),
        sa.Column("codigo_reserva", sa.String(length=10), nullable=False),
        sa.Column("clase", sa.Enum("PRIMERA", "ECONOMICA", name="clase_tiquete"), nullable=False),
        sa.Column("trayecto", sa.Enum("UNICO", "IDA", "REGRESO", name="trayecto_tiquete"), nullable=False),
        sa.Column("numero_silla", sa.Integer(), nullable=True),
        sa.Column("precio", sa.Integer(), nullable=False),
        sa.Column(
            "estado",
            sa.Enum("RESERVADO", "COMPRADO", "CANCELADO", "VENCIDO", name="estado_tiquete"),
            nullable=False,
        ),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("cancelado_en", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["id_cliente"], ["cliente.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["id_reserva"], ["reserva.id"]),
        sa.ForeignKeyConstraint(["id_compra"], ["compra.id"]),
        sa.ForeignKeyConstraint(["id_viajero"], ["viajero.id"]),
        sa.ForeignKeyConstraint(["id_vuelo"], ["vuelo.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id_vuelo", "numero_silla", name="uq_tiquete_vuelo_silla"),
        sa.UniqueConstraint("codigo_reserva", "id_vuelo", name="uq_tiquete_codigo_vuelo"),
    )
    op.create_index(op.f("ix_tiquete_id_cliente"), "tiquete", ["id_cliente"], unique=False)
    op.create_index(op.f("ix_tiquete_id_reserva"), "tiquete", ["id_reserva"], unique=False)
    op.create_index(op.f("ix_tiquete_id_compra"), "tiquete", ["id_compra"], unique=False)
    op.create_index(op.f("ix_tiquete_id_vuelo"), "tiquete", ["id_vuelo"], unique=False)
    op.create_index(op.f("ix_tiquete_codigo_reserva"), "tiquete", ["codigo_reserva"], unique=False)
    op.create_index(
        "uq_tiquete_vuelo_documento_activo",
        "tiquete",
        ["id_vuelo", "documento"],
        unique=True,
        postgresql_where=_ACTIVO,
        sqlite_where=_ACTIVO,
    )


def downgrade() -> None:
    op.drop_index("uq_tiquete_vuelo_documento_activo", table_name="tiquete")
    op.drop_table("tiquete")
    op.drop_table("compra")
    op.drop_table("reserva")
    op.drop_table("viajero")
    op.drop_table("tarjeta")
    op.drop_table("billetera")
    bind = op.get_bind()
    for nombre in (
        "estado_tiquete", "trayecto_tiquete", "clase_tiquete", "estado_compra", "estado_reserva", "tipo_tarjeta",
    ):
        sa.Enum(name=nombre).drop(bind, checkfirst=True)
