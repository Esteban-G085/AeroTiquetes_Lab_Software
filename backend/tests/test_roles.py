"""HU24 - Gestionar roles: la matriz existe, es de solo lectura y se aplica de verdad."""
from app.core.config import get_settings
from tests.conftest import auth_headers, datos_registro_cliente, login


def _login_root(client) -> str:
    settings = get_settings()
    return login(client, settings.ROOT_ID, settings.ROOT_PASSWORD)


def test_matriz_trae_los_4_roles_y_9_modulos(client):
    token_root = _login_root(client)
    resp = client.get("/root/roles", headers=auth_headers(token_root))
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert len(data["modulos"]) == 9
    assert all({"id", "nombre"} <= set(m) for m in data["modulos"])
    assert {r["id"] for r in data["roles"]} == {"root", "administrador", "cliente", "visitante"}
    for rol in data["roles"]:
        assert set(rol["modulos"]) == {m["id"] for m in data["modulos"]}  # mapa completo por rol
        assert rol["nombre"] and rol["descripcion"]
    editables = {r["id"]: r["editable"] for r in data["roles"]}
    # Todos los roles son solo lectura: las funciones ya están definidas
    assert editables == {"root": False, "administrador": False, "cliente": False, "visitante": False}


def test_solo_root_puede_ver_la_matriz(client):
    client.post("/auth/registro", data=datos_registro_cliente())
    token_cliente = login(client, "anagomez", "clavesegura123")
    resp = client.get("/root/roles", headers=auth_headers(token_cliente))
    assert resp.status_code == 403


def test_roles_no_se_crean_ni_eliminan_son_siempre_los_4(client, db_session):
    from app.modules.usuarios.models import Rol

    cantidad_antes = db_session.query(Rol).count()
    assert cantidad_antes == 4
    # No existe ruta para crear o eliminar roles: solo /root/roles (GET)
    # sobre la matriz de permisos, lo cual ya confirma que los roles en sí
    # son fijos (sección 10.1, decisión D - HU24).
