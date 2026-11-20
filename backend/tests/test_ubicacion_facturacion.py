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
    assert len(departamentos) == 37  # 32 de Colombia + 5 regiones del exterior

    ciudades = list(db_session.scalars(select(Ciudad)))
    assert len(ciudades) == 37
    assert all(ciudad.id_departamento is not None for ciudad in ciudades)  # backfill

    codigos = {d.codigo for d in departamentos}
    assert {"CO-BDC", "EXT-EU", "EXT-AP"}.issubset(codigos)


def test_catalogos_filtrados_por_pais_y_departamento(client):
    colombia = client.get("/catalogos/departamentos?pais=Colombia").json()
    exterior = client.get("/catalogos/departamentos?pais=ES").json()
    assert len(colombia) == 32 and len(exterior) == 5  # Colombia: 32; cualquier exterior: 5 regiones
    assert "EXT-EU" in {d["codigo"] for d in exterior}

    bogota = client.get("/catalogos/ciudades?departamento=CO-BDC").json()
    exterior_na = client.get("/catalogos/ciudades?departamento=EXT-NA").json()
    assert [c["codigo"] for c in bogota] == ["BOG"]
    assert {c["codigo"] for c in exterior_na} == {"NYC", "MIA"}
    assert client.get("/catalogos/departamentos?pais=Inventado").json() == []
    assert client.get("/catalogos/ciudades?departamento=NO-EXISTE").json() == []


def test_cualquier_pais_del_exterior_ofrece_las_cinco_regiones(client):
    """No hace falta que el pais tenga una region asignada de fabrica (HU4)."""
    for pais in ("México", "Perú", "Francia", "PE", "FR"):
        regiones = client.get("/catalogos/departamentos?pais=" + pais).json()
        assert len(regiones) == 5, pais
        assert {r["codigo"] for r in regiones} == {
            "EXT-EU", "EXT-GB", "EXT-NA", "EXT-SA", "EXT-AP",
        }


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


def test_registro_con_ciudad_del_exterior(client):
    token = _registrar(
        client,
        pais_facturacion="Estados Unidos",
        departamento_facturacion="EXT-NA",
        ciudad_facturacion="MIA",
    )
    perfil = client.get("/me", headers=auth_headers(token)).json()
    assert perfil["pais_facturacion"] == "Estados Unidos"
    assert perfil["departamento_facturacion"] == "EXT-NA"
    assert perfil["ciudad_facturacion"] == "MIA"


def test_registro_de_persona_en_un_pais_sin_region_asignada(client):
    """México no tiene región propia, pero puede elegir cualquier región exterior."""
    token = _registrar(
        client,
        pais_facturacion="México",
        departamento_facturacion="EXT-NA",
        ciudad_facturacion="NYC",
    )
    perfil = client.get("/me", headers=auth_headers(token)).json()
    assert perfil["pais_facturacion"] == "México"
    assert perfil["departamento_facturacion"] == "EXT-NA"
    assert perfil["ciudad_facturacion"] == "NYC"


@pytest.mark.parametrize(
    "campos,campo_error",
    [
        (dict(pais_facturacion="Colombia"), "departamento_facturacion"),
        (dict(pais_facturacion="Colombia", departamento_facturacion="CO-BDC"), "ciudad_facturacion"),
        (dict(pais_facturacion="País Inventado", departamento_facturacion="CO-BDC", ciudad_facturacion="BOG"), "pais_facturacion"),
        (dict(pais_facturacion="Colombia", departamento_facturacion="EXT-EU", ciudad_facturacion="MAD"), "departamento_facturacion"),
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
            departamento_facturacion="EXT-EU",
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
