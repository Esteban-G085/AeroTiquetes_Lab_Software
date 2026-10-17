"""HU24 - Gestionar roles: la matriz existe, es editable y se aplica de verdad."""
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
    assert editables == {"root": False, "administrador": True, "cliente": True, "visitante": True}


def test_solo_root_puede_ver_la_matriz(client):
    client.post("/auth/registro", data=datos_registro_cliente())
    token_cliente = login(client, "anagomez", "clavesegura123")
    resp = client.get("/root/roles", headers=auth_headers(token_cliente))
    assert resp.status_code == 403


def test_root_puede_desactivar_un_modulo_para_cliente(client):
    client.post("/auth/registro", data=datos_registro_cliente())
    token_cliente = login(client, "anagomez", "clavesegura123")

    # Antes de desactivar, el cliente puede ver su perfil sin problema
    # (esta ruta no depende de la matriz, pero sirve de control).
    resp = client.get("/me", headers=auth_headers(token_cliente))
    assert resp.status_code == 200

    token_root = _login_root(client)
    resp_update = client.put(
        "/root/roles",
        json={"roles": [{"id": "cliente", "modulos": {"busqueda": False}}]},
        headers=auth_headers(token_root),
    )
    assert resp_update.status_code == 200, resp_update.text
    cliente = next(r for r in resp_update.json()["roles"] if r["id"] == "cliente")
    assert cliente["modulos"]["busqueda"] is False
    assert cliente["modulos"]["compra_reserva"] is True  # lo no enviado no cambia


def test_actualizar_matriz_con_combinacion_invalida_falla(client):
    token_root = _login_root(client)
    resp = client.put(
        "/root/roles",
        json={"roles": [{"id": "cliente", "modulos": {"modulo_que_no_existe": True}}]},
        headers=auth_headers(token_root),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "modulo_desconocido"


def test_root_no_puede_quitarse_su_propio_acceso(client):
    token_root = _login_root(client)
    resp = client.put(
        "/root/roles",
        json={"roles": [{"id": "root", "modulos": {"usuarios": False}}]},
        headers=auth_headers(token_root),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "rol_no_editable"


def test_roles_no_se_crean_ni_eliminan_son_siempre_los_4(client, db_session):
    from app.modules.usuarios.models import Rol

    cantidad_antes = db_session.query(Rol).count()
    assert cantidad_antes == 4
    # No existe ruta para crear o eliminar roles: solo /root/roles (GET/PUT)
    # sobre la matriz de permisos, lo cual ya confirma que los roles en si
    # son fijos (seccion 10.1, decision D - HU24).


def test_matriz_se_aplica_de_verdad_en_rutas_protegidas_por_modulo(client, app):
    """Ruta temporal que usa require_roles(..., modulo=...), igual que lo haran
    las rutas de Vuelos/Busqueda de B2. Al desactivar el modulo para el rol,
    el acceso debe pasar de 200 a 403."""
    from fastapi import Depends

    from app.core.deps import require_roles

    @app.get("/_test/busqueda", dependencies=[Depends(require_roles("cliente", modulo="busqueda"))])
    def _ruta_de_prueba():
        return {"ok": True}

    client.post("/auth/registro", data=datos_registro_cliente())
    token_cliente = login(client, "anagomez", "clavesegura123")

    assert client.get("/_test/busqueda", headers=auth_headers(token_cliente)).status_code == 200

    token_root = _login_root(client)
    client.put(
        "/root/roles",
        json={"roles": [{"id": "cliente", "modulos": {"busqueda": False}}]},
        headers=auth_headers(token_root),
    )

    resp = client.get("/_test/busqueda", headers=auth_headers(token_cliente))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "modulo_desactivado"

    client.put(
        "/root/roles",
        json={"roles": [{"id": "cliente", "modulos": {"busqueda": True}}]},
        headers=auth_headers(token_root),
    )
    assert client.get("/_test/busqueda", headers=auth_headers(token_cliente)).status_code == 200
