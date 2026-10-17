"""HU1 - Iniciar sesion, y verificacion del root por defecto (B1-01, B1-04)."""
from app.core.config import get_settings


def test_root_por_defecto_existe_tras_el_arranque(client):
    settings = get_settings()
    resp = client.post(
        "/auth/login",
        json={"identificador": settings.ROOT_ID, "password": settings.ROOT_PASSWORD},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["usuario"]["rol"] == "root"
    assert "access_token" in data
    assert data["expira_en_minutos"] == 30


def test_login_con_password_incorrecta_falla_con_mensaje_generico(client):
    settings = get_settings()
    resp = client.post(
        "/auth/login",
        json={"identificador": settings.ROOT_ID, "password": "clave-equivocada"},
    )
    assert resp.status_code == 401
    body = resp.json()
    assert body["error"]["code"] == "credenciales_invalidas"
    # El mensaje no debe filtrar si fallo el usuario o la contrasena.
    assert "usuario" not in body["error"]["message"].lower() or "contrasena" in body["error"]["message"].lower()


def test_login_con_identificador_inexistente_da_401_no_500(client):
    resp = client.post("/auth/login", json={"identificador": "no-existe", "password": "loquesea"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "credenciales_invalidas"


def test_ruta_protegida_sin_token_da_401(client):
    resp = client.get("/me")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "no_autenticado"


def test_ruta_protegida_con_token_invalido_da_401(client):
    resp = client.get("/me", headers={"Authorization": "Bearer token-falso"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "token_invalido"


def test_ruta_de_root_rechaza_a_un_cliente(client):
    from tests.conftest import auth_headers, datos_registro_cliente, login

    resp = client.post("/auth/registro", data=datos_registro_cliente())
    assert resp.status_code == 201, resp.text

    token = login(client, "anagomez", "clavesegura123")
    resp = client.get("/root/administradores", headers=auth_headers(token))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "permiso_denegado"
