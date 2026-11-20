"""020_geografia_por_pais: cada pais solo ofrece sus propias regiones y ciudades.

Sustituye las 5 regiones genericas `EXT-*` por geografia coherente:

* 32 departamentos de Colombia (sin cambios).
* 11 paises con regiones y ciudades reales (China, España, México, Peru,
  Argentina, Chile, Brasil, Estados Unidos, Reino Unido, Francia y Japon).
* 48 paises con una unica "Region de X" y la capital de X.

Las ciudades que solo sirven para facturacion se marcan con `solo_facturacion`
para que no aparezcan en los selects de vuelos.

Revision ID: 020_geografia_por_pais
Revises: 019_recarga_con_tarjeta
Create Date: 2026-11-20
"""
import sqlalchemy as sa
from alembic import op

from app.modules.catalogos.seeds import (
    CIUDAD_DEPARTAMENTO,
    CIUDADES_FACTURACION_SEMILLA,
    DEPARTAMENTOS_SEMILLA,
)

revision: str = "020_geografia_por_pais"
down_revision: str | None = "019_recarga_con_tarjeta"
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

_CIUDAD = sa.table(
    "ciudad",
    sa.column("codigo", sa.String(3)),
    sa.column("nombre", sa.String(100)),
    sa.column("pais", sa.String(100)),
    sa.column("zona_horaria", sa.String(64)),
    sa.column("es_capital_departamento", sa.Boolean),
    sa.column("solo_facturacion", sa.Boolean),
    sa.column("id_departamento", sa.Integer),
)


def _mapa_codigos(bind, tabla: str) -> dict[str, int]:
    return {
        codigo: id_fila
        for id_fila, codigo in bind.execute(sa.text(f"SELECT id, codigo FROM {tabla}")).all()
    }


def upgrade() -> None:
    bind = op.get_bind()

    with op.batch_alter_table("ciudad") as batch_op:
        batch_op.add_column(
            sa.Column(
                "solo_facturacion", sa.Boolean(), nullable=False, server_default=sa.text("false")
            )
        )

    paises = {
        nombre: id_pais
        for id_pais, nombre in bind.execute(sa.text("SELECT id, nombre FROM pais")).all()
    }
    departamentos_existentes = set(_mapa_codigos(bind, "departamento"))
    nuevos_departamentos = [
        {
            "id_pais": paises[pais],
            "codigo": codigo,
            "nombre": nombre,
            "activo": True,
            "orden": orden,
        }
        for orden, (codigo, nombre, pais) in enumerate(DEPARTAMENTOS_SEMILLA)
        if codigo not in departamentos_existentes and pais in paises
    ]
    if nuevos_departamentos:
        op.bulk_insert(_DEPARTAMENTO, nuevos_departamentos)

    bind.execute(sa.text("UPDATE departamento SET activo = false WHERE codigo LIKE 'EXT-%'"))

    departamentos = _mapa_codigos(bind, "departamento")
    ciudades_existentes = set(_mapa_codigos(bind, "ciudad"))
    nuevas_ciudades = []
    for datos in CIUDADES_FACTURACION_SEMILLA:
        if datos["codigo"] in ciudades_existentes:
            continue
        id_departamento = departamentos.get(datos["id_departamento"])
        if id_departamento is None:
            continue
        nuevas_ciudades.append(
            {
                "codigo": datos["codigo"],
                "nombre": datos["nombre"],
                "pais": datos["pais"],
                "zona_horaria": datos["zona_horaria"],
                "es_capital_departamento": datos["es_capital_departamento"],
                "solo_facturacion": True,
                "id_departamento": id_departamento,
            }
        )
    if nuevas_ciudades:
        op.bulk_insert(_CIUDAD, nuevas_ciudades)

    # Las 5 ciudades de vuelos que antes colgaban de EXT-* pasan a su region real.
    departamentos = _mapa_codigos(bind, "departamento")
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

    # Cuentas antiguas que hubieran guardado una EXT-*: se reubican en su pais.
    ext_ids = {
        id_departamento
        for id_departamento, codigo in bind.execute(
            sa.text("SELECT id, codigo FROM departamento WHERE codigo LIKE 'EXT-%'")
        ).all()
    }
    for id_usuario, id_pais, id_dep_actual in bind.execute(
        sa.text(
            "SELECT id, id_pais_facturacion, id_departamento_facturacion FROM usuario"
        )
    ).all():
        if id_dep_actual not in ext_ids or id_pais is None:
            continue
        destino = bind.execute(
            sa.text(
                "SELECT id FROM departamento WHERE id_pais = :pais AND activo = true "
                "ORDER BY orden LIMIT 1"
            ),
            {"pais": id_pais},
        ).first()
        if not destino:
            continue
        ciudad = bind.execute(
            sa.text(
                "SELECT id FROM ciudad WHERE id_departamento = :dep ORDER BY nombre LIMIT 1"
            ),
            {"dep": destino[0]},
        ).first()
        if ciudad:
            bind.execute(
                sa.text(
                    "UPDATE usuario SET id_departamento_facturacion = :dep, "
                    "id_ciudad_facturacion = :ciu WHERE id = :usr"
                ),
                {"dep": destino[0], "ciu": ciudad[0], "usr": id_usuario},
            )


def downgrade() -> None:
    bind = op.get_bind()

    bind.execute(sa.text("UPDATE departamento SET activo = true WHERE codigo LIKE 'EXT-%'"))
    bind.execute(
        sa.text(
            "UPDATE usuario SET id_departamento_facturacion = NULL, "
            "id_ciudad_facturacion = NULL WHERE id_ciudad_facturacion IN "
            "(SELECT id FROM ciudad WHERE solo_facturacion = true)"
        )
    )
    bind.execute(sa.text("DELETE FROM ciudad WHERE solo_facturacion = true"))
    bind.execute(
        sa.text(
            "UPDATE usuario SET id_departamento_facturacion = NULL "
            "WHERE id_departamento_facturacion NOT IN "
            "(SELECT id FROM departamento WHERE codigo LIKE 'CO-%' OR codigo LIKE 'EXT-%')"
        )
    )
    bind.execute(
        sa.text(
            "UPDATE ciudad SET id_departamento = NULL WHERE id_departamento NOT IN "
            "(SELECT id FROM departamento WHERE codigo LIKE 'CO-%' OR codigo LIKE 'EXT-%')"
        )
    )
    bind.execute(
        sa.text(
            "DELETE FROM departamento WHERE codigo NOT LIKE 'CO-%' AND codigo NOT LIKE 'EXT-%'"
        )
    )
    bind.execute(sa.text("UPDATE ciudad SET id_departamento = NULL WHERE codigo IN ('MAD','LON','NYC','MIA','BUE')"))

    with op.batch_alter_table("ciudad") as batch_op:
        batch_op.drop_column("solo_facturacion")
