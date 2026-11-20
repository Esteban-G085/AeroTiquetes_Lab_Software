"""HU10 - Billetera virtual simulada y tarjetas (B1-16)."""
from datetime import date

import pytest

from app.core.config import get_settings
from app.modules.financiero.models import Billetera, Tarjeta
from tests.conftest import auth_headers, crear_tarjeta_valida, datos_registro_cliente, login, recargar


def _token(client, **over) -> str:
    datos = datos_registro_cliente(**over)
    assert client.post("/auth/registro", data=datos).status_code == 201
    return login(client, datos["usuario"], datos["password"])


@pytest.fixture()
def cab(client):
    return auth_headers(_token(client))


def _tarjeta(**over) -> dict:
    anio = date.today().year + 3
    base = dict(tipo="credito", numero="4111 1111 1111 1111", titular="Ana  Gomez", fecha_expiracion=f"12/{anio}", codigo="123")
    base.update(over)
    return base


# ------------------------------------------------------------------------- saldo
def test_la_billetera_se_crea_con_saldo_cero_en_el_primer_acceso(client, cab, db_session):
    assert db_session.query(Billetera).count() == 0
    resp = client.get("/mi-billetera", headers=cab)
    assert resp.status_code == 200 and resp.json() == {"saldo": 0}
    assert client.get("/mi-billetera", headers=cab).json() == {"saldo": 0}
    assert db_session.query(Billetera).count() == 1  # no se duplica


def test_agregar_saldo_suma(client, cab):
    id_tarjeta = crear_tarjeta_valida(client, cab)["id"]
    assert recargar(client, cab, 500_000, id_tarjeta).json() == {"saldo": 500_000}
    assert recargar(client, cab, 250_000, id_tarjeta).json() == {"saldo": 750_000}
    assert client.get("/mi-billetera", headers=cab).json() == {"saldo": 750_000}


@pytest.mark.parametrize("cuerpo", [{"monto": 0}, {"monto": -5}, {"monto": 2_000_000_000}, {"monto": "mucho"}, {}])
def test_monto_invalido_a_agregar(client, cab, cuerpo):
    resp = client.post("/mi-billetera/agregar-saldo", json=cuerpo, headers=cab)
    assert resp.status_code == 422 and resp.json()["error"]["code"] == "validacion"


def test_no_se_puede_fijar_el_saldo(client, cab):
    # Solo recargas: no existe PUT /mi-billetera (antes permitia editar el saldo libremente).
    assert client.put("/mi-billetera", json={"saldo": -1}, headers=cab).status_code == 405
    assert client.get("/mi-billetera", headers=cab).json() == {"saldo": 0}


def test_cada_cliente_tiene_su_propia_billetera(client):
    a = auth_headers(_token(client))
    b = auth_headers(_token(client, dni="2000000002", usuario="otro", correo="otro@example.com"))
    recargar(client, a, 10_000)
    assert client.get("/mi-billetera", headers=b).json() == {"saldo": 0}


# ------------------------------------------------------------------------- tarjetas
def test_agregar_listar_editar_y_eliminar_tarjeta(client, cab, db_session):
    creada = client.post("/mi-billetera/tarjetas", json=_tarjeta(), headers=cab)
    assert creada.status_code == 201, creada.text
    t = creada.json()
    assert t["tipo"] == "credito" and t["titular"] == "Ana Gomez"
    assert t["ultimos4"] == "1111" and t["numero_enmascarado"] == "**** **** **** 1111"
    assert "numero" not in t and "codigo" not in t  # nunca se devuelven completos

    # R10: en la base de datos si se guarda la informacion completa
    fila = db_session.get(Tarjeta, t["id"])
    assert fila.numero == "4111111111111111" and fila.codigo == "123"

    lista = client.get("/mi-billetera/tarjetas", headers=cab).json()["items"]
    assert [x["id"] for x in lista] == [t["id"]]

    editada = client.put(f"/mi-billetera/tarjetas/{t['id']}", json={"tipo": "debito", "titular": "Ana M. Gomez"}, headers=cab)
    assert editada.status_code == 200
    assert editada.json()["tipo"] == "debito" and editada.json()["titular"] == "Ana M. Gomez"
    assert editada.json()["ultimos4"] == "1111"  # lo que no se envia no cambia

    assert client.delete(f"/mi-billetera/tarjetas/{t['id']}", headers=cab).status_code == 204
    assert client.get("/mi-billetera/tarjetas", headers=cab).json()["items"] == []


def test_se_pueden_registrar_varias_tarjetas_de_ambos_tipos(client, cab):
    client.post("/mi-billetera/tarjetas", json=_tarjeta(), headers=cab)
    client.post("/mi-billetera/tarjetas", json=_tarjeta(tipo="debito", numero="5500000000000004"), headers=cab)
    items = client.get("/mi-billetera/tarjetas", headers=cab).json()["items"]
    assert [i["tipo"] for i in items] == ["credito", "debito"]


def test_no_se_repite_el_numero_de_tarjeta_del_mismo_cliente(client, cab):
    client.post("/mi-billetera/tarjetas", json=_tarjeta(), headers=cab)
    resp = client.post("/mi-billetera/tarjetas", json=_tarjeta(numero="4111 1111 1111 1111"), headers=cab)
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "tarjeta_duplicada"


@pytest.mark.parametrize(
    "campo,valor",
    [
        ("numero", "1234"), ("numero", "4111-1111-abcd-1234"), ("numero", "4111111111111234"),
        ("codigo", "12"), ("codigo", "12a"),
        ("fecha_expiracion", "13/2099"), ("fecha_expiracion", "01/2020"), ("fecha_expiracion", "2099-12"),
        ("titular", "   "), ("tipo", "prepago"),
    ],
)
def test_tarjeta_invalida(client, cab, campo, valor):
    resp = client.post("/mi-billetera/tarjetas", json=_tarjeta(**{campo: valor}), headers=cab)
    assert resp.status_code == 422, resp.text
    assert campo in resp.json()["error"]["fields"]


def test_la_marca_se_deriva_del_numero(client, cab):
    visa = client.post("/mi-billetera/tarjetas", json=_tarjeta(), headers=cab).json()
    master = client.post(
        "/mi-billetera/tarjetas", json=_tarjeta(numero="5500000000000004"), headers=cab
    ).json()
    assert visa["marca"] == "Visa" and master["marca"] == "Mastercard"


def test_vencimiento_acepta_mm_aa(client, cab):
    anio = (date.today().year + 2) % 100
    resp = client.post("/mi-billetera/tarjetas", json=_tarjeta(fecha_expiracion=f"06/{anio:02d}"), headers=cab)
    assert resp.status_code == 201
    assert resp.json()["fecha_expiracion"] == f"06/{date.today().year + 2}"


def test_no_se_puede_tocar_la_tarjeta_de_otro_cliente(client, cab):
    id_ajena = client.post("/mi-billetera/tarjetas", json=_tarjeta(), headers=cab).json()["id"]
    otro = auth_headers(_token(client, dni="2000000002", usuario="otro", correo="otro@example.com"))
    assert client.put(f"/mi-billetera/tarjetas/{id_ajena}", json={"titular": "X"}, headers=otro).status_code == 404
    assert client.delete(f"/mi-billetera/tarjetas/{id_ajena}", headers=otro).status_code == 404
    assert client.get("/mi-billetera/tarjetas", headers=otro).json()["items"] == []


# ------------------------------------------------------------------------- permisos
@pytest.mark.parametrize("metodo,ruta", [
    ("get", "/mi-billetera"), ("get", "/mi-billetera/tarjetas"),
    ("post", "/mi-billetera/agregar-saldo"),
])
def test_visitante_sin_token_recibe_401(client, metodo, ruta):
    resp = getattr(client, metodo)(ruta)
    assert resp.status_code == 401


def test_root_no_tiene_billetera(client):
    settings = get_settings()
    cab_root = auth_headers(login(client, settings.ROOT_ID, settings.ROOT_PASSWORD))
    resp = client.get("/mi-billetera", headers=cab_root)
    assert resp.status_code == 403 and resp.json()["error"]["code"] == "permiso_denegado"
