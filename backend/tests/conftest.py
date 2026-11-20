"""
Fixtures compartidas. Usa una base de datos SQLite en un archivo temporal,
completamente separada de la de desarrollo (seccion 5.1 del plan de sprint).

No se requiere un servidor Postgres para correr la suite; eso hace que
`pytest` corra igual en CI que en la maquina de cualquiera del equipo.
"""
import os
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("APP_ENV", "desarrollo")
os.environ.setdefault("JWT_SECRET", "secreto-de-pruebas")
os.environ.setdefault("ROOT_ID", "root")
os.environ.setdefault("ROOT_PASSWORD", "root12345")

# El correo NUNCA sale a internet en las pruebas. Estas variables pisan el
# `.env` de desarrollo (pydantic-settings da prioridad al entorno) y apuntan a
# un Mailpit local inexistente; ademas la fixture `correos` reemplaza el envio
# SMTP por un registro en memoria, asi que no se abre ningun socket.
os.environ["SMTP_HOST"] = "localhost"
os.environ["SMTP_PORT"] = "1025"
os.environ["SMTP_USER"] = ""
os.environ["SMTP_PASSWORD"] = ""

from app.core import db as db_module  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.db import Base, get_db  # noqa: E402

# Importa los modelos de cada modulo para que Base.metadata los conozca
# *antes* de que la fixture `engine` llame a create_all. Sin este import, la
# primera prueba de toda la corrida (antes de que app.main importe los
# modelos de forma transitiva) creara una BD sin tablas.
from app.modules.catalogos import models as _catalogos_models  # noqa: E402,F401
from app.modules.usuarios import models as _usuarios_models  # noqa: E402,F401
from app.modules.vuelos import models as _vuelos_models  # noqa: E402,F401
from app.modules.financiero import models as _financiero_models  # noqa: E402,F401
from app.modules.compras import models as _compras_models  # noqa: E402,F401
from app.modules.noticias import models as _noticias_models  # noqa: E402,F401
from app.modules.notificaciones import models as _notificaciones_models  # noqa: E402,F401

get_settings.cache_clear()


# ---------------------------------------------------------------------------
# Correo: stub global. Ninguna prueba debe enviar correos reales.
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session", autouse=True)
def correos():
    """Reemplaza `app.core.email._enviar` por un registro en memoria.

    Devuelve la lista de correos "enviados" (dicts con destinatario, asunto y
    cuerpo) para que las pruebas puedan comprobar el flujo sin SMTP. Al ser
    `autouse` y de sesion, aplica a toda la suite: ni la invitacion de admin ni
    la verificacion de cambio de correo salen a la red.
    """
    from app.core import email as email_module

    enviados: list[dict] = []
    original = email_module._enviar

    def _capturar(destinatario: str, asunto: str, cuerpo_html: str) -> None:
        enviados.append({"destinatario": destinatario, "asunto": asunto, "cuerpo": cuerpo_html})

    email_module._enviar = _capturar
    try:
        yield enviados
    finally:
        email_module._enviar = original


@pytest.fixture()
def db_path(tmp_path):
    return tmp_path / "test.db"


@pytest.fixture()
def engine(db_path):
    from app.modules.catalogos.seeds import sembrar_departamentos, sembrar_paises

    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)

    # Paises y departamentos: el registro valida `lugar_nacimiento` y la cadena de
    # facturacion contra ellos. Las CIUDADES las siembra el lifespan de la app al
    # abrir `client`; sembrarlas aqui romperia los tests de seeds y de modelos de
    # vuelos, que necesitan partir de una tabla `ciudad` vacia.
    with sessionmaker(bind=engine)() as session:
        sembrar_paises(session)
        sembrar_departamentos(session)

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

    # El lifespan de main.py (siembra de root y catalogos) usa session_scope(),
    # que no pasa por la dependencia get_db. Se apunta tambien a la BD de
    # pruebas para que ese arranque no intente conectarse a Postgres.
    monkeypatch.setattr(db_module, "SessionLocal", TestingSessionLocal)

    yield fastapi_app
    fastapi_app.dependency_overrides.clear()


@pytest.fixture()
def client(app):
    # El lifespan de la app (ver app/main.py) siembra el root por defecto y los
    # catalogos al entrar al context manager; no hace falta repetirlo aqui.
    with TestClient(app) as c:
        yield c


def login(client: TestClient, identificador: str, password: str) -> str:
    resp = client.post("/auth/login", json={"identificador": identificador, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def crear_tarjeta_valida(client, headers: dict, **over) -> dict:
    """Registra una tarjeta que pasa Luhn y esta vigente; devuelve la respuesta."""
    datos = dict(
        tipo="credito",
        numero="4111 1111 1111 1111",
        titular="Ana Gomez",
        fecha_expiracion=f"12/{(date.today().year + 3) % 100:02d}",
        codigo="123",
    )
    datos.update(over)
    resp = client.post("/mi-billetera/tarjetas", json=datos, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


def recargar(client, headers: dict, monto: int, id_tarjeta: int | None = None):
    """Recarga usando una tarjeta propia: reutiliza la primera o crea una valida."""
    if id_tarjeta is None:
        tarjetas = client.get("/mi-billetera/tarjetas", headers=headers).json()["items"]
        id_tarjeta = tarjetas[0]["id"] if tarjetas else crear_tarjeta_valida(client, headers)["id"]
    return client.post(
        "/mi-billetera/agregar-saldo", json={"monto": monto, "id_tarjeta": id_tarjeta}, headers=headers
    )


def datos_registro_cliente(**overrides) -> dict:
    base = dict(
        dni="1000000001",
        nombres="Ana",
        apellidos="Gomez",
        fecha_nacimiento="1995-05-20",
        lugar_nacimiento="Colombia",
        direccion_facturacion="Calle 10 # 5-20",
        genero="femenino",
        correo="ana.gomez@example.com",
        usuario="anagomez",
        password="clavesegura123",
    )
    base.update(overrides)
    return base
