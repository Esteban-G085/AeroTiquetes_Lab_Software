"""Ubicacion de facturacion estructurada (pais -> departamento -> ciudad)."""
import pytest
from sqlalchemy import select

from app.modules.catalogos.models import Departamento
from app.modules.vuelos.models import Ciudad
from tests.conftest import auth_headers, datos_registro_cliente, login


def _registrar(client, **campos):
    datos = datos_registro_cliente(**campos)
    resp = client.post("/auth/registro", data=datos)
    assert resp.status_code == 201, resp.text
    return login(client, datos["usuario"], datos["password"])


def test_catalogo_geografico_completo(client, db_session):
    departamentos = list(db_session.scalars(select(Departamento)))
    # 32 de Colombia + 55 de 11 paises curados + 48 regiones genericas.
    assert len(departamentos) == 135
    assert all(d.activo for d in departamentos)

    ciudades = list(db_session.scalars(select(Ciudad)))
    assert len(ciudades) == 135
    assert all(ciudad.id_departamento is not None for ciudad in ciudades)  # backfill

    codigos = {d.codigo for d in departamentos}
    assert {"CO-BDC", "CN-BJ", "ES-MD", "DK-GE"}.issubset(codigos)
    assert not any(c.startswith("EXT-") for c in codigos)  # regiones genericas eliminadas


def test_catalogos_filtrados_por_pais_y_departamento(client):
    colombia = client.get("/catalogos/departamentos?pais=Colombia").json()
    china = client.get("/catalogos/departamentos?pais=CN").json()
    assert len(colombia) == 32
    assert len(china) == 5
    assert {d["codigo"] for d in china} == {"CN-BJ", "CN-SH", "CN-GD", "CN-ZJ", "CN-SC"}

    bogota = client.get("/catalogos/ciudades?departamento=CO-BDC").json()
    pekin = client.get("/catalogos/ciudades?departamento=CN-BJ").json()
    assert [c["codigo"] for c in bogota] == ["BOG"]
    assert [c["codigo"] for c in pekin] == ["PEK"]
    assert client.get("/catalogos/departamentos?pais=Inventado").json() == []
    assert client.get("/catalogos/ciudades?departamento=NO-EXISTE").json() == []


def test_cada_pais_solo_ofrece_sus_propias_regiones(client):
    """China no puede elegir Cono Sur; Dinamarca solo tiene su region (HU4)."""
    china = {r["codigo"] for r in client.get("/catalogos/departamentos?pais=China").json()}
    espana = {r["codigo"] for r in client.get("/catalogos/departamentos?pais=España").json()}
    dinamarca = {r["codigo"] for r in client.get("/catalogos/departamentos?pais=Dinamarca").json()}

    assert all(c.startswith("CN-") for c in china) and len(china) == 5
    assert all(c.startswith("ES-") for c in espana) and len(espana) == 5
    assert dinamarca == {"DK-GE"}


def test_registro_guarda_la_cadena_y_la_devuelve_el_perfil(client):
    token = _registrar(
        client,
        pais_facturacion="Colombia",
        departamento_facturacion="CO-BDC",
        ciudad_facturacion="BOG",
    )
    perfil = client.get("/me", headers=auth_headers(token)).json()
    assert perfil["pais_facturacion"] == "Colombia"
    assert perfil["departamento_facturacion"] == "CO-BDC"
    assert perfil["ciudad_facturacion"] == "BOG"


def test_registro_con_region_y_ciudad_de_china(client):
    token = _registrar(
        client,
        pais_facturacion="China",
        departamento_facturacion="CN-BJ",
        ciudad_facturacion="PEK",
    )
    perfil = client.get("/me", headers=auth_headers(token)).json()
    assert perfil["pais_facturacion"] == "China"
    assert perfil["departamento_facturacion"] == "CN-BJ"
    assert perfil["ciudad_facturacion"] == "PEK"


def test_registro_con_ciudad_del_exterior(client):
    token = _registrar(
        client,
        pais_facturacion="Estados Unidos",
        departamento_facturacion="US-NY",
        ciudad_facturacion="NYC",
    )
    perfil = client.get("/me", headers=auth_headers(token)).json()
    assert perfil["pais_facturacion"] == "Estados Unidos"
    assert perfil["departamento_facturacion"] == "US-NY"
    assert perfil["ciudad_facturacion"] == "NYC"


def test_registro_de_persona_en_un_pais_sin_geografia_curada(client):
    """Dinamarca no tiene regiones reales en el catalogo, pero si su capital."""
    token = _registrar(
        client,
        pais_facturacion="Dinamarca",
        departamento_facturacion="DK-GE",
        ciudad_facturacion="DNK",
    )
    perfil = client.get("/me", headers=auth_headers(token)).json()
    assert perfil["pais_facturacion"] == "Dinamarca"
    assert perfil["departamento_facturacion"] == "DK-GE"
    assert perfil["ciudad_facturacion"] == "DNK"


@pytest.mark.parametrize(
    "campos,campo_error",
    [
        (dict(pais_facturacion="Colombia"), "departamento_facturacion"),
        (dict(pais_facturacion="Colombia", departamento_facturacion="CO-BDC"), "ciudad_facturacion"),
        (dict(pais_facturacion="País Inventado", departamento_facturacion="CO-BDC", ciudad_facturacion="BOG"), "pais_facturacion"),
        (dict(pais_facturacion="Colombia", departamento_facturacion="CN-BJ", ciudad_facturacion="PEK"), "departamento_facturacion"),
        (dict(pais_facturacion="China", departamento_facturacion="AR-BA", ciudad_facturacion="BUE"), "departamento_facturacion"),
        (dict(pais_facturacion="China", departamento_facturacion="CN-BJ", ciudad_facturacion="MAD"), "ciudad_facturacion"),
        (dict(pais_facturacion="Colombia", departamento_facturacion="CO-BDC", ciudad_facturacion="MDE"), "ciudad_facturacion"),
    ],
)
def test_registro_rechaza_cadenas_invalidas(client, campos, campo_error):
    datos = datos_registro_cliente(**campos)
    resp = client.post("/auth/registro", data=datos)
    assert resp.status_code == 422, resp.text
    body = resp.json()["error"]
    assert body["code"] == "ubicacion_facturacion_invalida"
    assert campo_error in body["fields"]


def test_perfil_actualiza_la_ubicacion(client):
    token = _registrar(
        client,
        pais_facturacion="Colombia",
        departamento_facturacion="CO-BDC",
        ciudad_facturacion="BOG",
    )
    cab = auth_headers(token)
    resp = client.put(
        "/me",
        data=dict(
            pais_facturacion="España",
            departamento_facturacion="ES-MD",
            ciudad_facturacion="MAD",
        ),
        headers=cab,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["ciudad_facturacion"] == "MAD"


def test_perfil_rechaza_cadena_incompleta(client):
    token = _registrar(client)
    resp = client.put("/me", data={"ciudad_facturacion": "BOG"}, headers=auth_headers(token))
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "ubicacion_facturacion_invalida"
