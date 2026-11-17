"""Los tokens de correo no deben poder autenticar APIs (separacion de proposito)."""
from jose import jwt

from app.core import security
from tests.conftest import auth_headers, datos_registro_cliente, login


def _login(client) -> str:
    datos = datos_registro_cliente()
    assert client.post("/auth/registro", data=datos).status_code == 201
    return login(client, datos["usuario"], datos["password"])


def test_token_de_acceso_lleva_tipo_y_rol(client):
    token = _login(client)
    payload = security.decode_access_token(token)
    assert payload["tipo"] == "access"
    assert payload["rol"] == "cliente"


def test_invitacion_de_admin_no_autentica_api(client):
    token = security.create_invite_token(administrador_id=1, expire_hours=1)
    assert client.get("/me", headers=auth_headers(token)).status_code == 401


def test_verificacion_de_correo_no_autentica_api(client):
    token = security.create_verification_token(usuario_id=1)
    assert client.get("/me", headers=auth_headers(token)).status_code == 401


def test_un_token_sin_tipo_no_autentica_api(client):
    token = jwt.encode(
        {"sub": "1", "rol": "cliente", "exp": 4102444800},
        security.settings.JWT_SECRET,
        algorithm=security.settings.JWT_ALGORITHM,
    )
    assert client.get("/me", headers=auth_headers(token)).status_code == 401


def test_verificacion_y_invitacion_no_son_intercambiables():
    verificacion = security.create_verification_token(usuario_id=7)
    invitacion = security.create_invite_token(administrador_id=7, expire_hours=1)

    assert security.decode_verification_token(verificacion) == 7
    assert security.decode_invite_token(invitacion) == 7

    try:
        security.decode_invite_token(verificacion)
    except security.TokenError:
        pass
    else:
        raise AssertionError("Un token de verificacion no debe servir como invitacion")

    try:
        security.decode_verification_token(invitacion)
    except security.TokenError:
        pass
    else:
        raise AssertionError("Un token de invitacion no debe servir como verificacion")
