"""Root: solo crea administradores y gestiona su propio perfil (Id y contrasena). No hay gestion de roles."""
from app.core.config import get_settings
from tests.conftest import auth_headers, login


def _cab_root(client) -> dict:
    s = get_settings()
    return auth_headers(login(client, s.ROOT_ID, s.ROOT_PASSWORD))


def test_root_ve_su_perfil_con_su_id(client):
    resp = client.get("/me", headers=_cab_root(client))
    assert resp.status_code == 200
    assert resp.json()["rol"] == "root" and resp.json()["usuario"] == get_settings().ROOT_ID


def test_root_cambia_su_contrasena_y_entra_con_la_nueva(client):
    s = get_settings()
    cab = _cab_root(client)
    resp = client.put("/me/password", json={"password_actual": s.ROOT_PASSWORD, "password_nueva": "nuevaclave99"}, headers=cab)
    assert resp.status_code == 204
    assert client.post("/auth/login", json={"identificador": s.ROOT_ID, "password": s.ROOT_PASSWORD}).status_code == 401
    assert login(client, s.ROOT_ID, "nuevaclave99")
    # deja la contrasena como estaba para el resto de la suite
    cab2 = auth_headers(login(client, s.ROOT_ID, "nuevaclave99"))
    client.put("/me/password", json={"password_actual": "nuevaclave99", "password_nueva": s.ROOT_PASSWORD}, headers=cab2)


def test_root_no_cambia_contrasena_con_la_actual_incorrecta(client):
    resp = client.put("/me/password", json={"password_actual": "mala", "password_nueva": "nuevaclave99"}, headers=_cab_root(client))
    assert resp.status_code == 400 and resp.json()["error"]["code"] == "password_incorrecta"


def test_root_no_tiene_datos_personales_ni_correo(client):
    cab = _cab_root(client)
    datos = client.put("/me", data={"nombres": "Super"}, headers=cab)
    assert datos.status_code == 403 and datos.json()["error"]["code"] == "root_solo_password"
    correo = client.post("/me/correo", json={"correo_nuevo": "root@example.com", "password_actual": get_settings().ROOT_PASSWORD}, headers=cab)
    assert correo.status_code == 403 and correo.json()["error"]["code"] == "root_solo_password"


def test_ya_no_existe_la_gestion_de_roles(client):
    cab = _cab_root(client)
    for metodo in ("get", "put"):
        resp = getattr(client, metodo)("/root/roles", headers=cab)
        assert resp.status_code in (404, 405)
    rutas = client.get("/openapi.json").json()["paths"]
    assert "/root/roles" not in rutas


def test_root_sigue_creando_administradores(client):
    resp = client.post("/root/administradores", json={"correo": "nuevo.admin@example.com", "nombre": "Nuevo Admin"}, headers=_cab_root(client))
    assert resp.status_code == 201
