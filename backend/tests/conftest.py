"""
Fixtures compartidas. Usa una base de datos SQLite en un archivo temporal,
completamente separada de la de desarrollo (seccion 5.1 del plan de sprint).

No se requiere un servidor Postgres para correr la suite; eso hace que
`pytest` corra igual en CI que en la maquina de cualquiera del equipo.
"""
import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("JWT_SECRET", "secreto-de-pruebas")
os.environ.setdefault("ROOT_ID", "root")
os.environ.setdefault("ROOT_PASSWORD", "root12345")

from app.core import db as db_module  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.db import Base, get_db  # noqa: E402

# Importa los modelos de cada modulo para que Base.metadata los conozca
# *antes* de que la fixture `engine` llame a create_all. Sin este import, la
# primera prueba de toda la corrida (antes de que app.main importe los
# modelos de forma transitiva) creara una BD sin tablas.
from app.modules.usuarios import models as _usuarios_models  # noqa: E402,F401
from app.modules.vuelos import models as _vuelos_models  # noqa: E402,F401

get_settings.cache_clear()


@pytest.fixture()
def db_path(tmp_path):
    return tmp_path / "test.db"


@pytest.fixture()
def engine(db_path):
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def TestingSessionLocal(engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db_session(TestingSessionLocal):
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def app(TestingSessionLocal, monkeypatch):
    # Import diferido: para que las variables de entorno de arriba ya esten
    # puestas antes de que app.main cargue Settings().
    from app.main import app as fastapi_app

    def _override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    fastapi_app.dependency_overrides[get_db] = _override_get_db

    # El lifespan de main.py (siembra de root y roles) usa session_scope(),
    # que no pasa por la dependencia get_db. Se apunta tambien a la BD de
    # pruebas para que ese arranque no intente conectarse a Postgres.
    monkeypatch.setattr(db_module, "SessionLocal", TestingSessionLocal)

    yield fastapi_app
    fastapi_app.dependency_overrides.clear()


@pytest.fixture()
def client(app):
    # El lifespan de la app (ver app/main.py) siembra el root por defecto y
    # la matriz de roles al entrar al context manager; no hace falta
    # repetirlo aqui.
    with TestClient(app) as c:
        yield c


def login(client: TestClient, identificador: str, password: str) -> str:
    resp = client.post("/auth/login", json={"identificador": identificador, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def datos_registro_cliente(**overrides) -> dict:
    base = dict(
        dni="1000000001",
        nombres="Ana",
        apellidos="Gomez",
        fecha_nacimiento="1995-05-20",
        lugar_nacimiento="Pereira",
        direccion_facturacion="Calle 10 # 5-20",
        genero="femenino",
        correo="ana.gomez@example.com",
        usuario="anagomez",
        password="clavesegura123",
    )
    base.update(overrides)
    return base
