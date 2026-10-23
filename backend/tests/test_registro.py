"""HU4 - Registro de cliente (B1-05)."""
from tests.conftest import datos_registro_cliente


def test_registro_cliente_exitoso(client):
    resp = client.post("/auth/registro", data=datos_registro_cliente())
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["rol"] == "cliente"
    assert data["usuario"] == "anagomez"
    assert data["correo"] == "ana.gomez@example.com"


def test_registro_rechaza_fecha_de_nacimiento_futura(client):
    resp = client.post("/auth/registro", data=datos_registro_cliente(fecha_nacimiento="2999-01-01"))
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validacion"


def test_registro_rechaza_lugar_de_nacimiento_inventado(client):
    resp = client.post("/auth/registro", data=datos_registro_cliente(lugar_nacimiento="País de las Maravillas"))
    assert resp.status_code == 422
    body = resp.json()
    assert body["error"]["code"] == "lugar_nacimiento_invalido"
    assert "lugar_nacimiento" in body["error"]["fields"]


def test_registro_normaliza_el_pais_al_nombre_canonico(client, db_session):
    from app.modules.usuarios.models import Usuario

    resp = client.post("/auth/registro", data=datos_registro_cliente(lugar_nacimiento="  colombia  "))
    assert resp.status_code == 201, resp.text
    usuario = db_session.query(Usuario).filter_by(usuario="anagomez").one()
    assert usuario.lugar_nacimiento == "Colombia"


def test_catalogo_de_paises_devuelve_los_activos(client):
    resp = client.get("/catalogos/paises")
    assert resp.status_code == 200
    paises = resp.json()
    assert len(paises) >= 50
    nombres = [p["nombre"] for p in paises]
    assert "Colombia" in nombres
    assert "País de las Maravillas" not in nombres


def test_registro_rechaza_correo_duplicado(client):
    resp1 = client.post("/auth/registro", data=datos_registro_cliente())
    assert resp1.status_code == 201

    resp2 = client.post(
        "/auth/registro",
        data=datos_registro_cliente(dni="1000000002", usuario="otrousuario"),
    )
    assert resp2.status_code == 409
    body = resp2.json()
    assert body["error"]["code"] == "dato_duplicado"
    assert "correo" in body["error"]["fields"]


def test_registro_rechaza_dni_duplicado(client):
    resp1 = client.post("/auth/registro", data=datos_registro_cliente())
    assert resp1.status_code == 201

    resp2 = client.post(
        "/auth/registro",
        data=datos_registro_cliente(correo="otro@example.com", usuario="otrousuario"),
    )
    assert resp2.status_code == 409
    assert "dni" in resp2.json()["error"]["fields"]


def test_registro_rechaza_usuario_duplicado(client):
    resp1 = client.post("/auth/registro", data=datos_registro_cliente())
    assert resp1.status_code == 201

    resp2 = client.post(
        "/auth/registro",
        data=datos_registro_cliente(correo="otro@example.com", dni="1000000003"),
    )
    assert resp2.status_code == 409
    assert "usuario" in resp2.json()["error"]["fields"]


def test_cliente_recien_registrado_puede_iniciar_sesion(client):
    client.post("/auth/registro", data=datos_registro_cliente())
    resp = client.post("/auth/login", json={"identificador": "anagomez", "password": "clavesegura123"})
    assert resp.status_code == 200, resp.text


def test_cliente_puede_iniciar_sesion_con_correo(client):
    client.post("/auth/registro", data=datos_registro_cliente())
    resp = client.post(
        "/auth/login", json={"identificador": "ana.gomez@example.com", "password": "clavesegura123"}
    )
    assert resp.status_code == 200, resp.text
