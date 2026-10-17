"""HU2 - Gestionar perfil y HU3 - Cambiar contrasena (B1-06, B1-07)."""
from tests.conftest import auth_headers, datos_registro_cliente, login


def _registrar_y_loguear(client) -> str:
    client.post("/auth/registro", data=datos_registro_cliente())
    return login(client, "anagomez", "clavesegura123")


def test_obtener_mi_perfil(client):
    token = _registrar_y_loguear(client)
    resp = client.get("/me", headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["usuario"] == "anagomez"
    assert data["dni"] == "1000000001"


def test_actualizar_perfil_cambia_campos_permitidos(client):
    token = _registrar_y_loguear(client)
    # El front envia multipart/form-data (permite adjuntar la foto en la misma llamada).
    resp = client.put(
        "/me",
        data={"nombres": "Ana Maria", "telefono": "3001234567", "fecha_nacimiento": "1996-01-02", "lugar_nacimiento": ""},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["nombres"] == "Ana Maria"
    assert resp.json()["telefono"] == "3001234567"
    assert resp.json()["fecha_nacimiento"] == "1996-01-02"
    assert resp.json()["lugar_nacimiento"] == "Pereira"  # campo vacio = sin cambio


def test_actualizar_perfil_rechaza_fecha_futura(client):
    token = _registrar_y_loguear(client)
    resp = client.put("/me", data={"fecha_nacimiento": "2999-01-01"}, headers=auth_headers(token))
    assert resp.status_code == 422
    assert "fecha_nacimiento" in resp.json()["error"]["fields"]


def test_actualizar_perfil_con_foto_devuelve_imagen_url(client, tmp_path, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "PERFILES_DIR", str(tmp_path))
    token = _registrar_y_loguear(client)
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 32
    resp = client.put(
        "/me",
        data={"nombres": "Ana"},
        files={"imagen": ("foto.png", png, "image/png")},
        headers=auth_headers(token),
    )
    assert resp.status_code == 200, resp.text
    url = resp.json()["imagen_url"]
    assert url.startswith("/") and url.endswith(".png") and "\\" not in url


def test_actualizar_perfil_no_permite_cambiar_el_documento(client):
    token = _registrar_y_loguear(client)
    # El schema PerfilUpdate no expone `dni`; aunque el cliente lo envie,
    # FastAPI lo ignora porque no es un campo del modelo.
    resp = client.put("/me", data={"dni": "9999999999"}, headers=auth_headers(token))
    assert resp.status_code == 200
    assert resp.json()["dni"] == "1000000001"


def test_cambiar_password_exitoso_y_login_con_la_nueva(client):
    token = _registrar_y_loguear(client)
    resp = client.put(
        "/me/password",
        json={"password_actual": "clavesegura123", "password_nueva": "otraClaveSegura456"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 204

    resp_login_vieja = client.post("/auth/login", json={"identificador": "anagomez", "password": "clavesegura123"})
    assert resp_login_vieja.status_code == 401

    resp_login_nueva = client.post(
        "/auth/login", json={"identificador": "anagomez", "password": "otraClaveSegura456"}
    )
    assert resp_login_nueva.status_code == 200


def test_cambiar_password_falla_si_la_actual_no_coincide(client):
    token = _registrar_y_loguear(client)
    resp = client.put(
        "/me/password",
        json={"password_actual": "incorrecta", "password_nueva": "otraClaveSegura456"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "password_incorrecta"


def test_solicitar_cambio_de_correo_y_verificarlo(client, db_session):
    from app.core.security import create_invite_token
    from app.modules.usuarios.models import Usuario

    token = _registrar_y_loguear(client)

    resp = client.post(
        "/me/correo",
        json={"correo_nuevo": "ana.nueva@example.com", "password_actual": "clavesegura123"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 202, resp.text

    # El correo real lo recibiria Mailpit; en la prueba se reconstruye el
    # token tal como lo haria ese correo, para validar la verificacion.
    usuario = db_session.query(Usuario).filter_by(usuario="anagomez").one()
    assert usuario.correo_pendiente == "ana.nueva@example.com"
    assert usuario.correo == "ana.gomez@example.com"  # aun no cambia

    token_verificacion = create_invite_token(administrador_id=usuario.id, expire_hours=48)
    resp_verificar = client.post("/auth/verificar-correo", json={"token": token_verificacion})
    assert resp_verificar.status_code == 200, resp_verificar.text
    assert resp_verificar.json()["correo"] == "ana.nueva@example.com"
    assert resp_verificar.json()["correo_pendiente"] is None


def test_solicitar_cambio_de_correo_falla_si_password_incorrecta(client):
    token = _registrar_y_loguear(client)
    resp = client.post(
        "/me/correo",
        json={"correo_nuevo": "ana.nueva@example.com", "password_actual": "incorrecta"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "password_incorrecta"


def test_cambio_de_correo_por_put_me_multipart_responde_202(client, db_session):
    """Forma que usa el front: PUT /me con correo_nuevo + password_actual."""
    from app.modules.usuarios.models import Usuario

    token = _registrar_y_loguear(client)
    resp = client.put(
        "/me",
        data={"correo_nuevo": "ana.nueva@example.com", "password_actual": "clavesegura123"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 202, resp.text
    assert resp.json()["correo_pendiente"] == "ana.nueva@example.com"
    assert resp.json()["correo"] == "ana.gomez@example.com"


def test_cambio_de_correo_por_put_me_con_password_mala_da_error_por_campo(client):
    token = _registrar_y_loguear(client)
    resp = client.put(
        "/me",
        data={"correo_nuevo": "ana.nueva@example.com", "password_actual": "incorrecta"},
        headers=auth_headers(token),
    )
    assert resp.status_code == 400
    assert "password_actual" in resp.json()["error"]["fields"]


def test_cambio_de_correo_por_put_me_sin_password_da_422(client):
    token = _registrar_y_loguear(client)
    resp = client.put("/me", data={"correo_nuevo": "ana.nueva@example.com"}, headers=auth_headers(token))
    assert resp.status_code == 422
    assert "password_actual" in resp.json()["error"]["fields"]


def test_url_imagen_normaliza_rutas_de_windows():
    from app.modules.usuarios.schemas import url_imagen

    assert url_imagen(None) is None
    assert url_imagen("static/perfiles/a.png") == "/static/perfiles/a.png"
    assert url_imagen("static\\perfiles\\a.png") == "/static/perfiles/a.png"
