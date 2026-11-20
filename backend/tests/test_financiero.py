"""HU10 - Billetera: solo recargas y auditoria interna de cada cambio de saldo (B1-16)."""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.modules.financiero.models import MovimientoBilletera, Tarjeta, TipoMovimiento
from app.modules.vuelos.models import Vuelo
from tests.conftest import auth_headers, crear_tarjeta_valida, recargar
from tests.test_compras import _cuerpo, _item, _otro_cliente, _saldo, _viajero, cab, v1  # noqa: F401
from tests.test_contrato_vuelos import token_admin  # noqa: F401


@pytest.fixture()
def adm(token_admin):
    return auth_headers(token_admin)


@pytest.fixture()
def con_saldo(client, cab):
    recargar(client, cab, 5_000_000)
    return cab


def _movimientos(db_session) -> list[MovimientoBilletera]:
    db_session.rollback()  # la API usa otra sesion: cerramos la nuestra para ver lo confirmado
    return list(db_session.scalars(select(MovimientoBilletera).order_by(MovimientoBilletera.id)))


def _programar(client, adm, *, dias=10):
    fecha = (datetime.now(timezone.utc) + timedelta(days=dias)).date().isoformat()
    resp = client.post(
        "/admin/vuelos", headers=adm,
        json=dict(tipo="nacional", origen="BOG", destino="MDE", fecha=fecha, hora="08:15", duracion=55, costo=250_000),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_recarga_auditada(client, db_session, cab):
    tarjeta = crear_tarjeta_valida(client, cab)
    resp = recargar(client, cab, 250_000, id_tarjeta=tarjeta["id"])
    assert resp.status_code == 200 and resp.json()["saldo"] == 250_000

    movimientos = _movimientos(db_session)
    assert len(movimientos) == 1
    mov = movimientos[0]
    assert mov.tipo == TipoMovimiento.RECARGA
    assert mov.monto == 250_000 and mov.saldo_resultante == 250_000
    assert mov.referencia == "recarga" and mov.creado_en is not None
    assert mov.id_tarjeta == tarjeta["id"]  # auditoria de la tarjeta usada


def test_recarga_exige_tarjeta_registrada(client, db_session, cab):
    resp = client.post("/mi-billetera/agregar-saldo", json={"monto": 100_000}, headers=cab)
    assert resp.status_code == 422 and resp.json()["error"]["code"] == "validacion"
    assert "id_tarjeta" in resp.json()["error"]["fields"]

    resp = client.post(
        "/mi-billetera/agregar-saldo", json={"monto": 100_000, "id_tarjeta": 9999}, headers=cab
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "tarjeta_recarga_invalida"
    assert "id_tarjeta" in resp.json()["error"]["fields"]
    assert _movimientos(db_session) == []


def test_recarga_rechaza_tarjeta_ajena(client, db_session, cab):
    ajena = crear_tarjeta_valida(client, cab, numero="5500000000000004")
    otro = _otro_cliente(client)
    resp = recargar(client, otro, 100_000, id_tarjeta=ajena["id"])
    assert resp.status_code == 422 and resp.json()["error"]["code"] == "tarjeta_recarga_invalida"
    assert _movimientos(db_session) == []


def test_recarga_rechaza_tarjeta_vencida(client, db_session, cab):
    tarjeta = crear_tarjeta_valida(client, cab, numero="5500000000000004")
    db_session.rollback()  # la API usa otra sesion
    fila = db_session.get(Tarjeta, tarjeta["id"])
    fila.fecha_expiracion = "01/2020"  # vencio despues de registrarla
    db_session.commit()

    resp = recargar(client, cab, 100_000, id_tarjeta=tarjeta["id"])
    assert resp.status_code == 422 and resp.json()["error"]["code"] == "tarjeta_recarga_invalida"
    assert _movimientos(db_session) == []


def test_ya_no_se_puede_fijar_el_saldo(client, db_session, cab):
    assert client.put("/mi-billetera", json={"saldo": 9_000_000}, headers=cab).status_code == 405
    assert _saldo(client, cab) == 0
    assert _movimientos(db_session) == []


def test_compra_y_cancelacion_registran_compra_y_reintegro(client, db_session, con_saldo, v1):
    compra = client.post("/compras", json=_cuerpo(_item(v1)), headers=con_saldo).json()
    assert compra["total"] == 200_000
    assert _saldo(client, con_saldo) == 4_800_000

    movimientos = _movimientos(db_session)
    assert [(m.tipo, m.monto, m.saldo_resultante, m.referencia) for m in movimientos] == [
        (TipoMovimiento.RECARGA, 5_000_000, 5_000_000, "recarga"),
        (TipoMovimiento.COMPRA, -200_000, 4_800_000, f"compra:{compra['id']}"),
    ]

    resp = client.post(f"/compras/{compra['id']}/cancelar", headers=con_saldo)
    assert resp.status_code == 200, resp.text
    assert resp.json()["reintegro"] == 200_000 and _saldo(client, con_saldo) == 5_000_000

    movimientos = _movimientos(db_session)
    assert [(m.tipo, m.monto, m.saldo_resultante, m.referencia) for m in movimientos][-1] == (
        TipoMovimiento.REINTEGRO, 200_000, 5_000_000, f"cancelacion-compra:{compra['id']}",
    )


def test_cancelar_vuelo_registra_reintegro_por_cliente(client, db_session, adm, con_saldo):
    vuelo = _programar(client, adm)
    objeto = db_session.get(Vuelo, vuelo["id"])
    compra = client.post(
        "/compras", json=_cuerpo(_item(objeto, [_viajero(1), _viajero(2)])), headers=con_saldo
    ).json()

    resp = client.patch(
        f"/admin/vuelos/{vuelo['id']}/cancelar",
        json={"motivo": "clima"},
        headers=adm,
    )
    assert resp.status_code == 200, resp.text
    assert _saldo(client, con_saldo) == 5_000_000  # el reintegro devuelve todo lo pagado

    movimientos = _movimientos(db_session)
    assert [(m.tipo, m.monto, m.referencia) for m in movimientos][-1] == (
        TipoMovimiento.REINTEGRO, compra["total"], f"cancelacion-vuelo:{vuelo['id']}",
    )
