"""HU23 - Gestionar administradores (B1-08)."""
from app.core.config import get_settings
from tests.conftest import auth_headers, login


def _login_root(client) -> str:
    settings = get_settings()
    return login(client, settings.ROOT_ID, settings.ROOT_PASSWORD)


def test_root_crea_administrador_queda_pendiente(client, db_session):
    from app.modules.usuarios.models import Administrador, EstadoAdministrador

    token_root = _login_root(client)
    resp = client.post(
        "/root/administradores",
        json={"correo": "nuevo.admin@example.com", "nombre": "Carlos Perez"},
        headers=auth_headers(token_root),
    )
    assert resp.status_code == 201, resp.text
    admin_id = resp.json()["id"]

    admin = db_session.get(Administrador, admin_id)
    assert admin.estado == EstadoAdministrador.PENDIENTE
    assert admin.token_invitacion is not None


def test_administrador_pendiente_no_puede_iniciar_sesion(client):
    token_root = _login_root(client)
    client.post(
        "/root/administradores",
        json={"correo": "nuevo.admin@example.com", "nombre": "Carlos Perez"},
        headers=auth_headers(token_root),
    )
    resp = client.post("/auth/login", json={"identificador": "nuevo.admin@example.com", "password": "loquesea"})
    assert resp.status_code == 401


def test_completar_registro_de_administrador_y_login(client, db_session):
    from app.modules.usuarios.models import Administrador

    token_root = _login_root(client)
    resp = client.post(
        "/root/administradores",
        json={"correo": "nuevo.admin@example.com", "nombre": "Carlos Perez"},
        headers=auth_headers(token_root),
    )
    admin_id = resp.json()["id"]
    admin = db_session.get(Administrador, admin_id)
    invite_token = admin.token_invitacion

    resp_completar = client.post(
        "/auth/completar-registro",
        data={
            "token": invite_token,
            "dni": "2000000001",
            "nombres": "Carlos",
            "apellidos": "Perez",
            "fecha_nacimiento": "1988-03-15",
            "lugar_nacimiento": "Bogota",
            "direccion_facturacion": "Carrera 7 # 1-20",
            "genero": "masculino",
            "correo": "nuevo.admin@example.com",
            "usuario": "carlosperez",
            "password": "claveAdmin123",
        },
    )
    assert resp_completar.status_code == 201, resp_completar.text
    assert resp_completar.json()["rol"] == "administrador"

    resp_login = client.post("/auth/login", json={"identificador": "carlosperez", "password": "claveAdmin123"})
    assert resp_login.status_code == 200, resp_login.text


def test_completar_registro_con_token_usado_dos_veces_falla(client, db_session):
    from app.modules.usuarios.models import Administrador

    token_root = _login_root(client)
    resp = client.post(
        "/root/administradores",
        json={"correo": "nuevo.admin@example.com", "nombre": "Carlos Perez"},
        headers=auth_headers(token_root),
    )
    admin_id = resp.json()["id"]
    invite_token = db_session.get(Administrador, admin_id).token_invitacion

    datos = {
        "token": invite_token,
        "dni": "2000000001",
        "nombres": "Carlos",
        "apellidos": "Perez",
        "fecha_nacimiento": "1988-03-15",
        "lugar_nacimiento": "Bogota",
        "direccion_facturacion": "Carrera 7 # 1-20",
        "genero": "masculino",
        "correo": "nuevo.admin@example.com",
        "usuario": "carlosperez",
        "password": "claveAdmin123",
    }
    resp1 = client.post("/auth/completar-registro", data=datos)
    assert resp1.status_code == 201

    resp2 = client.post("/auth/completar-registro", data={**datos, "usuario": "otrocarlos"})
    assert resp2.status_code == 400
    assert resp2.json()["error"]["code"] == "invitacion_usada"


def test_listar_y_eliminar_administrador(client, db_session):
    from app.modules.usuarios.models import Usuario

    token_root = _login_root(client)
    resp = client.post(
        "/root/administradores",
        json={"correo": "nuevo.admin@example.com", "nombre": "Carlos Perez"},
        headers=auth_headers(token_root),
    )
    admin_id = resp.json()["id"]

    resp_listar = client.get("/root/administradores", headers=auth_headers(token_root))
    assert resp_listar.status_code == 200
    assert any(a["id"] == admin_id for a in resp_listar.json())
    item = next(a for a in resp_listar.json() if a["id"] == admin_id)
    assert item["nombre"] and item["estado"] == "pendiente" and "imagen_url" in item

    resp_eliminar = client.delete(f"/root/administradores/{admin_id}", headers=auth_headers(token_root))
    assert resp_eliminar.status_code == 204
    assert db_session.get(Usuario, admin_id) is None


def test_crear_administrador_con_correo_duplicado_falla(client):
    token_root = _login_root(client)
    client.post(
        "/root/administradores",
        json={"correo": "nuevo.admin@example.com", "nombre": "Carlos Perez"},
        headers=auth_headers(token_root),
    )
    resp = client.post(
        "/root/administradores",
        json={"correo": "nuevo.admin@example.com", "nombre": "Otro Nombre"},
        headers=auth_headers(token_root),
    )
    assert resp.status_code == 409


def test_validar_invitacion_devuelve_correo_y_nombre_sin_consumirla(client, db_session):
    from app.modules.usuarios.models import Administrador

    token_root = _login_root(client)
    resp = client.post(
        "/root/administradores",
        json={"correo": "nuevo.admin@example.com", "nombre": "Carlos Perez"},
        headers=auth_headers(token_root),
    )
    token_invitacion = db_session.get(Administrador, resp.json()["id"]).token_invitacion

    for _ in range(2):  # se puede consultar varias veces: no consume el enlace
        r = client.get("/auth/completar-registro", params={"token": token_invitacion})
        assert r.status_code == 200, r.text
        assert r.json() == {"correo": "nuevo.admin@example.com", "nombre": "Carlos Perez"}


def test_validar_invitacion_con_token_malo_da_410(client):
    r = client.get("/auth/completar-registro", params={"token": "basura"})
    assert r.status_code == 410
    assert r.json()["error"]["code"] == "invitacion_vencida"
