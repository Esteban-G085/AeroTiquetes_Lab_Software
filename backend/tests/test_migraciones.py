"""
Migraciones de Alembic (B2-02): se aplican, se revierten y coinciden con los modelos.

Corren sobre una base SQLite temporal (como el resto de la suite). La verificacion contra PostgreSQL
real (enums, timestamptz, ON DELETE SET NULL) se hace a mano con `alembic upgrade head`.
"""
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect

from app.core.config import get_settings
from app.core.db import Base

BACKEND = Path(__file__).resolve().parent.parent
TABLAS_DE_VUELOS = {"ciudad", "vuelo", "busqueda"}


def _config() -> Config:
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    return cfg


@pytest.fixture()
def url_temporal(tmp_path, monkeypatch):
    """Apunta Alembic (que lee DATABASE_URL de la configuracion) a una base temporal."""
    url = f"sqlite:///{tmp_path / 'migraciones.db'}"
    monkeypatch.setenv("DATABASE_URL", url)
    get_settings.cache_clear()
    yield url
    monkeypatch.undo()
    get_settings.cache_clear()


def test_hay_una_sola_cabeza_y_la_cadena_es_001_a_006():
    """Seccion 5.4 del plan: sin `multiple heads`."""
    script = ScriptDirectory.from_config(_config())
    assert script.get_heads() == ["006_paises"]
    cadena = [r.revision for r in script.walk_revisions()][::-1]
    assert cadena == [
        "001_usuarios", "002_roles", "003_ciudades", "004_vuelos", "005_busquedas", "006_paises",
    ]


def test_upgrade_head_crea_las_tablas_e_indices(url_temporal):
    command.upgrade(_config(), "head")
    inspector = inspect(create_engine(url_temporal))
    assert TABLAS_DE_VUELOS <= set(inspector.get_table_names())

    columnas = {c["name"] for c in inspector.get_columns("vuelo")}
    assert columnas == {
        "id", "codigo", "id_origen", "id_destino", "tipo", "salida_utc", "duracion_min", "llegada_utc",
        "costo", "estado", "cupos_primera", "cupos_economica", "fecha_programacion", "id_administrador",
    }
    indices = {i["name"] for i in inspector.get_indexes("vuelo")}
    assert {"ix_vuelo_id_origen", "ix_vuelo_id_destino", "ix_vuelo_salida_utc"} <= indices

    destinos_fk = {fk["referred_table"] for fk in inspector.get_foreign_keys("vuelo")}
    assert destinos_fk == {"ciudad", "administrador"}

    columnas_busqueda = {c["name"] for c in inspector.get_columns("busqueda")}
    assert columnas_busqueda == {"id", "id_cliente", "id_origen", "id_destino", "fecha_salida", "creada_en"}
    assert "ix_busqueda_id_cliente" in {i["name"] for i in inspector.get_indexes("busqueda")}


def test_las_migraciones_coinciden_con_los_modelos(url_temporal):
    """Si alguien cambia un modelo (de cualquier modulo) sin crear su migracion, esta prueba lo detecta."""
    command.upgrade(_config(), "head")
    with create_engine(url_temporal).connect() as conexion:
        diferencias = compare_metadata(MigrationContext.configure(conexion), Base.metadata)
    assert diferencias == []


def test_downgrade_a_la_002_quita_las_tablas_de_vuelos_y_se_puede_volver_a_subir(url_temporal):
    cfg = _config()
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "002_roles")
    tablas = set(inspect(create_engine(url_temporal)).get_table_names())
    assert not (TABLAS_DE_VUELOS & tablas)
    assert {"usuario", "administrador", "rol"} <= tablas  # lo de B1 queda intacto

    command.upgrade(cfg, "head")
    assert TABLAS_DE_VUELOS <= set(inspect(create_engine(url_temporal)).get_table_names())


def test_downgrade_hasta_el_inicio_deja_la_base_vacia(url_temporal):
    cfg = _config()
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "base")
    assert set(inspect(create_engine(url_temporal)).get_table_names()) <= {"alembic_version"}
