"""Historial de busquedas de clientes autenticados (B2-11)."""
from datetime import date

import pytest

from app.core.security import create_access_token
from app.modules.vuelos.models import Busqueda
from tests.conftest import auth_headers, datos_registro_cliente, login


@pytest.fixture()
def token_cliente(client):
    client.post("/auth/registro", data=datos_registro_cliente())
    return login(client, "anagomez", "clavesegura123")


def _historial(db_session) -> list[Busqueda]:
    db_session.expire_all()
    return db_session.query(Busqueda).order_by(Busqueda.id).all()


def test_el_cliente_que_busca_deja_su_historial(client, db_session, token_cliente):
    resp = client.get(
        "/vuelos",
        params={"origen": "bog", "destino": "MDE", "fecha": "2030-01-15"},
        headers=auth_headers(token_cliente),
    )
    assert resp.status_code == 200
    [registro] = _historial(db_session)
    assert registro.origen.codigo == "BOG" and registro.destino.codigo == "MDE"
    assert registro.fecha_salida == date(2030, 1, 15)
    assert registro.creada_en.tzinfo is not None
    assert registro.id_cliente > 0


def test_se_guarda_aunque_no_haya_resultados(client, db_session, token_cliente):
    resp = client.get("/vuelos", params={"origen": "BOG", "destino": "MAD"}, headers=auth_headers(token_cliente))
    assert resp.json()["total"] == 0
    assert len(_historial(db_session)) == 1


def test_con_un_solo_criterio_tambien_se_guarda(client, db_session, token_cliente):
    cab = auth_headers(token_cliente)
    client.get("/vuelos", params={"destino": "MIA"}, headers=cab)
    client.get("/vuelos", params={"fecha": "2030-02-01"}, headers=cab)
    solo_destino, solo_fecha = _historial(db_session)
    assert solo_destino.origen is None and solo_destino.destino.codigo == "MIA" and solo_destino.fecha_salida is None
    assert solo_fecha.origen is None and solo_fecha.destino is None and solo_fecha.fecha_salida == date(2030, 2, 1)


def test_el_visitante_no_deja_rastro(client, db_session):
    assert client.get("/vuelos", params={"origen": "BOG", "destino": "MDE"}).status_code == 200
    assert _historial(db_session) == []


def test_un_token_invalido_o_vencido_se_trata_como_visitante(client, db_session):
    resp = client.get("/vuelos", params={"origen": "BOG"}, headers=auth_headers("esto.no.es.un.token"))
    assert resp.status_code == 200  # la busqueda es publica: nunca 401
    assert _historial(db_session) == []


def test_otros_roles_no_guardan_historial(client, db_session):
    from app.core.config import get_settings

    settings = get_settings()
    token_root = login(client, settings.ROOT_ID, settings.ROOT_PASSWORD)
    assert client.get("/vuelos", params={"origen": "BOG"}, headers=auth_headers(token_root)).status_code == 200
    assert _historial(db_session) == []


def test_sin_criterios_de_ruta_ni_fecha_no_se_guarda(client, db_session, token_cliente):
    cab = auth_headers(token_cliente)
    client.get("/vuelos", headers=cab)
    client.get("/vuelos", params={"precioMax": 500000, "duracionMin": 30, "orden": "precio_asc"}, headers=cab)
    assert _historial(db_session) == []


def test_una_ciudad_desconocida_se_guarda_como_nula_y_si_no_hay_mas_no_se_guarda(client, db_session, token_cliente):
    cab = auth_headers(token_cliente)
    client.get("/vuelos", params={"origen": "XXX"}, headers=cab)
    assert _historial(db_session) == []
    client.get("/vuelos", params={"origen": "XXX", "destino": "BOG"}, headers=cab)
    [registro] = _historial(db_session)
    assert registro.origen is None and registro.destino.codigo == "BOG"


def test_paginar_no_repite_la_busqueda(client, db_session, token_cliente):
    cab = auth_headers(token_cliente)
    client.get("/vuelos", params={"origen": "BOG", "pagina": 1}, headers=cab)
    client.get("/vuelos", params={"origen": "BOG", "pagina": 2}, headers=cab)
    assert len(_historial(db_session)) == 1


def test_una_busqueda_invalida_no_se_guarda(client, db_session, token_cliente):
    resp = client.get("/vuelos", params={"origen": "BOG", "orden": "al_azar"}, headers=auth_headers(token_cliente))
    assert resp.status_code == 422
    assert _historial(db_session) == []


def test_el_detalle_de_un_vuelo_no_es_una_busqueda(client, db_session, token_cliente):
    client.get("/vuelos/1", headers=auth_headers(token_cliente))
    assert _historial(db_session) == []


def test_si_falla_el_guardado_la_busqueda_responde_igual(client, db_session, token_cliente, monkeypatch):
    from app.modules.vuelos import service

    def _falla(*args, **kwargs):
        raise RuntimeError("base de datos caida")

    monkeypatch.setattr(db_session.__class__, "commit", _falla, raising=True)
    # El commit falla solo dentro de registrar_busqueda; la respuesta ya estaba calculada.
    resultado = service.registrar_busqueda(db_session, 1, origen="BOG", destino=None, fecha=None)
    assert resultado is None


def test_cada_cliente_tiene_su_propio_historial(client, db_session, token_cliente):
    client.post(
        "/auth/registro",
        data=datos_registro_cliente(dni="1000000002", correo="otro@example.com", usuario="otrocliente"),
    )
    token_otro = login(client, "otrocliente", "clavesegura123")
    client.get("/vuelos", params={"origen": "BOG"}, headers=auth_headers(token_cliente))
    client.get("/vuelos", params={"origen": "MDE"}, headers=auth_headers(token_otro))
    registros = _historial(db_session)
    assert len(registros) == 2 and registros[0].id_cliente != registros[1].id_cliente


def test_eliminar_la_ciudad_deja_el_historial_con_nulo_y_el_cliente_lo_arrastra(db_session):
    """Reglas de integridad de la tabla: ver la migracion 005 (SET NULL en ciudad, CASCADE en cliente)."""
    from sqlalchemy import inspect

    fks = {fk["referred_table"]: fk["options"].get("ondelete") for fk in inspect(db_session.get_bind()).get_foreign_keys("busqueda")}
    assert fks == {"cliente": "CASCADE", "ciudad": "SET NULL"}
