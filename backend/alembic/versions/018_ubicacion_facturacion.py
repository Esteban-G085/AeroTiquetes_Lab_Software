"""018_ubicacion_facturacion: departamentos y direccion de facturacion estructurada.

Agrega el catalogo `departamento` (32 departamentos de Colombia + 5 regiones del
exterior), vincula `ciudad.id_departamento` (con backfill de las 37 ciudades
existentes) y guarda en `usuario` la cadena pais -> departamento -> ciudad usada
al registrar. `lugar_nacimiento` NO cambia: sigue siendo solo el pais.

Revision ID: 018_ubicacion_facturacion
Revises: 017_noticia_eliminada
Create Date: 2026-11-19
"""
import sqlalchemy as sa
from alembic import op

from app.modules.catalogos.seeds import CIUDAD_DEPARTAMENTO, DEPARTAMENTOS_SEMILLA

revision: str = "018_ubicacion_facturacion"
down_revision: str | None = "017_noticia_eliminada"
branch_labels: str | None = None
depends_on: str | None = None


_DEPARTAMENTO = sa.table(
    "departamento",
    sa.column("id_pais", sa.Integer),
    sa.column("codigo", sa.String(10)),
    sa.column("nombre", sa.String(100)),
    sa.column("activo", sa.Boolean),
    sa.column("orden", sa.Integer),
)


def upgrade() -> None:
    op.create_table(
        "departamento",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("id_pais", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("codigo", sa.String(length=10), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("orden", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "creado_en", sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False,
        ),
        sa.Column(
            "actualizado_en", sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False,
        ),
        sa.ForeignKeyConstraint(["id_pais"], ["pais.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("codigo"),
        sa.UniqueConstraint("id_pais", "nombre", name="uq_departamento_pais_nombre"),
    )
    op.create_index(op.f("ix_departamento_id_pais"), "departamento", ["id_pais"], unique=False)
    op.create_index(op.f("ix_departamento_activo"), "departamento", ["activo"], unique=False)

    # Semilla: los paises ya existen desde la migracion 006.
    bind = op.get_bind()
    paises = {
        nombre: id_pais
        for id_pais, nombre in bind.execute(sa.text("SELECT id, nombre FROM pais")).all()
    }
    op.bulk_insert(
        _DEPARTAMENTO,
        [
            {
                "id_pais": paises[pais],
                "codigo": codigo,
                "nombre": nombre,
                "activo": True,
                "orden": orden,
            }
            for orden, (codigo, nombre, pais) in enumerate(DEPARTAMENTOS_SEMILLA)
            if pais in paises
        ],
    )

    # Vinculacion de las 37 ciudades ya existentes (y de las que se agreguen despues).
    with op.batch_alter_table("ciudad") as batch_op:
        batch_op.add_column(sa.Column("id_departamento", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_ciudad_id_departamento_departamento", "departamento",
            ["id_departamento"], ["id"], ondelete="SET NULL",
        )
        batch_op.create_index(op.f("ix_ciudad_id_departamento"), ["id_departamento"], unique=False)

    departamentos = {
        codigo: id_departamento
        for id_departamento, codigo in bind.execute(
            sa.text("SELECT id, codigo FROM departamento")
        ).all()
    }
    actualizaciones = []
    for id_ciudad, codigo_ciudad in bind.execute(sa.text("SELECT id, codigo FROM ciudad")).all():
        codigo_departamento = CIUDAD_DEPARTAMENTO.get(codigo_ciudad)
        if codigo_departamento in departamentos:
            actualizaciones.append(
                {"id": id_ciudad, "id_departamento": departamentos[codigo_departamento]}
            )
    if actualizaciones:
        bind.execute(
            sa.text("UPDATE ciudad SET id_departamento = :id_departamento WHERE id = :id"),
            actualizaciones,
        )

    # Tres FK nullable: las cuentas antiguas no tienen ubicacion de facturacion.
    with op.batch_alter_table("usuario") as batch_op:
        batch_op.add_column(sa.Column("id_pais_facturacion", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("id_departamento_facturacion", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("id_ciudad_facturacion", sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            "fk_usuario_id_pais_facturacion_pais", "pais", ["id_pais_facturacion"], ["id"]
        )
        batch_op.create_foreign_key(
            "fk_usuario_id_departamento_facturacion_departamento", "departamento",
            ["id_departamento_facturacion"], ["id"],
        )
        batch_op.create_foreign_key(
            "fk_usuario_id_ciudad_facturacion_ciudad", "ciudad",
            ["id_ciudad_facturacion"], ["id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("usuario") as batch_op:
        batch_op.drop_column("id_ciudad_facturacion")
        batch_op.drop_column("id_departamento_facturacion")
        batch_op.drop_column("id_pais_facturacion")

    with op.batch_alter_table("ciudad") as batch_op:
        batch_op.drop_index(op.f("ix_ciudad_id_departamento"))
        batch_op.drop_column("id_departamento")

    op.drop_index(op.f("ix_departamento_activo"), table_name="departamento")
    op.drop_index(op.f("ix_departamento_id_pais"), table_name="departamento")
    op.drop_table("departamento")
