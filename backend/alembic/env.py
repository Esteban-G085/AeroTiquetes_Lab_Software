"""
Entorno de Alembic. La URL de conexion sale de app.core.config (es decir, de
.env), no de alembic.ini, para que dev y CI usen exactamente la misma
configuracion que la aplicacion.

Importa Base y todos los modulos de modelos para que autogenerate los vea.
Cuando B2 agregue sus modelos (vuelos, busqueda), basta con importarlos aqui
tambien.
"""
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import get_settings
from app.core.db import Base

# Importa los modelos de cada modulo para que Base.metadata los conozca.
from app.modules.usuarios import models as usuarios_models  # noqa: F401
from app.modules.vuelos import models as vuelos_models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
