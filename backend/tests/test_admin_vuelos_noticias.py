"""HU11-HU14 - Noticias y suscripcion, editar vuelo, cancelar vuelo y vuelos realizados (B2-12 a B2-15).

Reutiliza los fixtures de administrador y cliente de `test_contrato_vuelos` y las ayudas de `test_compras`.
"""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.modules.compras.models import EstadoReserva, EstadoTiquete, Reserva, Tiquete
from app.modules.noticias import service as noticias
from app.modules.noticias.models import Noticia
from app.modules.vuelos import service
from app.modules.vuelos.models import EstadoVuelo, Vuelo
from app.modules.vuelos.seeds import sembrar_vuelos_ejemplo
from tests.conftest import auth_headers
from tests.test_compras import _cuerpo, _cupos, _item, _otro_cliente, _saldo, _token, _viajero
from tests.test_contrato_vuelos import _agregar_vuelo, token_admin, token_cliente  # noqa: F401


@pytest.fixture()
def adm(token_admin):
    return auth_headers(token_admin)


@pytest.fixture()
def cab(client):
    return auth_headers(_token(client))


@pytest.fixture()
def con_saldo(client, cab):
    client.post("/mi-billetera/agregar-saldo", json={"monto": 5_000_000}, headers=cab)
    return cab


def _programar(client, adm, *, dias=10, origen="BOG", destino="MDE", tipo="nacional"):
    fecha = (datetime.now(timezone.utc) + timedelta(days=dias)).date().isoformat()
    resp = client.post(
        "/admin/vuelos", headers=adm,
        json=dict(tipo=tipo, origen=origen, destino=destino, fecha=fecha, hora="08:15", duracion=55, costo=250_000),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


def _edicion(vuelo: dict, **cambios) -> dict:
    salida = datetime.fromisoformat(vuelo["salida_utc"].replace("Z", "+00:00")) - timedelta(hours=5)  # hora de Colombia
    base = dict(
        fecha=salida.date().isoformat(), hora=salida.strftime("%H:%M"), origen=vuelo["origen"]["codigo"],
        destino=vuelo["destino"]["codigo"], duracion_min=vuelo["duracion_min"], precio=vuelo["costo"],
    )
    base.update(cambios)
    return base


# ============================================================================ roles
@pytest.mark.parametrize(
    "metodo,ruta",
    [("put", "/admin/vuelos/1"), ("patch", "/admin/vuelos/1/cancelar"), ("get", "/admin/vuelos/realizados")],
)
def test_rutas_de_administracion_exigen_administrador(client, token_cliente, metodo, ruta):
    assert getattr(client, metodo)(ruta).status_code == 401
    assert getattr(client, metodo)(ruta, headers=auth_headers(token_cliente)).status_code == 403


@pytest.mark.parametrize("ruta", ["/noticias/suscripcion"])
def test_noticias_sin_token_401(client, ruta):
    assert client.get(ruta).status_code == 401


def test_suscripcion_solo_cliente_y_noticias_cliente_o_admin(client, adm, cab):
    assert client.get("/noticias", headers=adm).status_code == 200
    assert client.get("/noticias", headers=cab).status_code == 200
    assert client.get("/noticias/suscripcion", headers=adm).status_code == 403
    assert client.put("/noticias/suscripcion", json={"correo": "a@b.co"}, headers=adm).status_code == 403


# ============================================================================ HU12: editar vuelo
def test_editar_cambia_fecha_hora_ruta_duracion_y_costo(client, adm):
    v = _programar(client, adm, dias=10)
    cuerpo = _edicion(v, hora="09:30", destino="CLO", duracion_min=70, precio=300_000)
    resp = client.put(f"/admin/vuelos/{v['id']}", json=cuerpo, headers=adm)
    assert resp.status_code == 200, resp.text
    e = resp.json()
    assert e["id"] == v["id"] and e["codigo"] == v["codigo"] and e["estado"] == "programado"
    assert e["destino"]["codigo"] == "CLO" and e["costo"] == 300_000 and e["duracion_min"] == 70
    assert e["salida_utc"].endswith("T14:30:00Z")  # 09:30 de Colombia (UTC-5)
    salida = datetime.fromisoformat(e["salida_utc"].replace("Z", "+00:00"))
    assert datetime.fromisoformat(e["llegada_utc"].replace("Z", "+00:00")) == salida + timedelta(minutes=70)
    assert e["cupos_economica"] == v["cupos_economica"] and e["tiquetes_vendidos"] == 0
    assert client.get(f"/admin/vuelos/{v['id']}", headers=adm).json()["costo"] == 300_000


def test_editar_valida_las_ciudades_con_las_reglas_de_hu18(client, adm):
    v = _programar(client, adm)
    r = client.put(f"/admin/vuelos/{v['id']}", json=_edicion(v, destino="BOG"), headers=adm)
    assert r.status_code == 422 and "destino" in r.json()["error"]["fields"]
    r = client.put(f"/admin/vuelos/{v['id']}", json=_edicion(v, destino="MIA"), headers=adm)  # nacional no puede ir al exterior
    assert r.status_code == 422 and "destino" in r.json()["error"]["fields"]
    r = client.put(f"/admin/vuelos/{v['id']}", json=_edicion(v, fecha="2020-01-01"), headers=adm)
    assert r.status_code == 422 and "fecha" in r.json()["error"]["fields"]
    r = client.put(f"/admin/vuelos/{v['id']}", json=_edicion(v, destino="XXX"), headers=adm)
    assert r.status_code == 422 and "destino" in r.json()["error"]["fields"]
    r = client.put(f"/admin/vuelos/{v['id']}", json=_edicion(v, precio=0, duracion_min=0), headers=adm)
    assert r.status_code == 422 and {"precio", "duracion_min"} <= set(r.json()["error"]["fields"])


def test_editar_un_internacional_conserva_su_tipo(client, adm):
    v = _programar(client, adm, origen="BOG", destino="MIA", tipo="internacional")
    ok = client.put(f"/admin/vuelos/{v['id']}", json=_edicion(v, destino="MAD"), headers=adm)
    assert ok.status_code == 200 and ok.json()["tipo"] == "internacional"
    mal = client.put(f"/admin/vuelos/{v['id']}", json=_edicion(v, destino="MDE"), headers=adm)  # dos ciudades de Colombia
    assert mal.status_code == 422


def test_no_se_edita_un_vuelo_con_tiquetes_vendidos_ni_reservados(client, db_session, adm, con_saldo):
    v = _programar(client, adm)
    vuelo = db_session.get(Vuelo, v["id"])
    assert client.post("/reservas", json=_cuerpo(_item(vuelo)), headers=con_saldo).status_code == 201
    r = client.put(f"/admin/vuelos/{v['id']}", json=_edicion(v, precio=1), headers=adm)
    assert r.status_code == 409 and r.json()["error"]["code"] == "vuelo_con_tiquetes"
    assert "1 tiquete vendido" in r.json()["error"]["message"]


def test_no_se_edita_un_vuelo_que_ya_sucedio_estaba_cancelado_o_no_existe(client, db_session, adm):
    sucedido = _agregar_vuelo(db_session, "BOG", "MDE", dias=-1, estado=EstadoVuelo.PROGRAMADO)  # salio hace un dia
    r = client.put(f"/admin/vuelos/{sucedido.id}", json=_edicion(client.get(f"/admin/vuelos/{sucedido.id}", headers=adm).json()), headers=adm)
    assert r.status_code == 409 and r.json()["error"]["code"] in ("vuelo_sucedido", "vuelo_realizado")

    v = _programar(client, adm)
    assert client.patch(f"/admin/vuelos/{v['id']}/cancelar", json={}, headers=adm).status_code == 200
    r = client.put(f"/admin/vuelos/{v['id']}", json=_edicion(v), headers=adm)
    assert r.status_code == 409 and r.json()["error"]["code"] == "vuelo_cancelado"

    assert client.put("/admin/vuelos/99999", json=_edicion(v), headers=adm).status_code == 404


# ============================================================================ HU13: cancelar vuelo
def test_cancelar_un_vuelo_sin_tiquetes_no_pide_motivo(client, adm):
    v = _programar(client, adm)
    resp = client.patch(f"/admin/vuelos/{v['id']}/cancelar", json={}, headers=adm)
    assert resp.status_code == 200 and resp.json()["estado"] == "cancelado"
    assert client.patch(f"/admin/vuelos/{v['id']}/cancelar", headers=adm).status_code == 409  # sin cuerpo y ya cancelado


def test_cancelar_con_tiquetes_exige_causa_de_fuerza_mayor(client, db_session, adm, con_saldo):
    v = _programar(client, adm)
    vuelo = db_session.get(Vuelo, v["id"])
    assert client.post("/compras", json=_cuerpo(_item(vuelo)), headers=con_saldo).status_code == 201

    for cuerpo in ({}, {"motivo": "corto"}, {"motivo": "   "}):
        r = client.patch(f"/admin/vuelos/{v['id']}/cancelar", json=cuerpo, headers=adm)
        assert r.status_code == 422 and "motivo" in r.json()["error"]["fields"], cuerpo
    assert client.patch(f"/admin/vuelos/{v['id']}/cancelar", json={"motivo": "x" * 301}, headers=adm).status_code == 422
    assert db_session.get(Vuelo, v["id"]).estado == EstadoVuelo.PROGRAMADO


def test_cancelar_reintegra_compras_cancela_reservas_y_devuelve_cupos(client, db_session, adm, con_saldo):
    v = _programar(client, adm)
    vuelo = db_session.get(Vuelo, v["id"])
    antes = _saldo(client, con_saldo)
    compra = client.post("/compras", json=_cuerpo(_item(vuelo, [_viajero(1), _viajero(2)])), headers=con_saldo).json()
    reserva = client.post("/reservas", json=_cuerpo(_item(vuelo, [_viajero(3)], clase="primera")), headers=_otro_cliente(client))
    assert reserva.status_code == 201, reserva.text
    assert _saldo(client, con_saldo) == antes - compra["total"]

    resp = client.patch(
        f"/admin/vuelos/{v['id']}/cancelar", json={"motivo": "Cierre del aeropuerto por tormenta"}, headers=adm
    )
    assert resp.status_code == 200 and resp.json()["estado"] == "cancelado"

    assert _saldo(client, con_saldo) == antes  # reintegro total de la compra
    db_session.expire_all()
    estados = {t.estado for t in db_session.scalars(select(Tiquete).where(Tiquete.id_vuelo == vuelo.id))}
    assert estados == {EstadoTiquete.CANCELADO}
    assert db_session.scalars(select(Reserva)).one().estado == EstadoReserva.CANCELADA
    assert _cupos(db_session, vuelo) == (vuelo.cupos_primera, vuelo.cupos_economica)
    # y el historial del cliente lo muestra cancelado
    hist = client.get("/mi-historial", headers=con_saldo).json()
    assert all(t["estado"] == "cancelado" for op in hist["items"] for t in op["tiquetes"])


def test_un_vuelo_cancelado_ya_no_se_puede_comprar_ni_reservar(client, db_session, adm, con_saldo):
    v = _programar(client, adm)
    vuelo = db_session.get(Vuelo, v["id"])
    client.patch(f"/admin/vuelos/{v['id']}/cancelar", json={}, headers=adm)
    r = client.post("/compras", json=_cuerpo(_item(vuelo)), headers=con_saldo)
    assert r.status_code == 409 and r.json()["error"]["code"] == "vuelo_no_disponible"
    assert client.post("/reservas", json=_cuerpo(_item(vuelo)), headers=con_saldo).status_code == 409


def test_no_se_cancela_un_vuelo_que_ya_sucedio_o_no_existe(client, db_session, adm):
    v = _agregar_vuelo(db_session, "BOG", "MDE", dias=-1)
    r = client.patch(f"/admin/vuelos/{v.id}/cancelar", json={}, headers=adm)
    assert r.status_code == 409 and r.json()["error"]["code"] in ("vuelo_sucedido", "vuelo_realizado")
    assert client.patch("/admin/vuelos/99999/cancelar", json={}, headers=adm).status_code == 404


# ============================================================================ HU14 / HU22: realizados y estados automaticos
def test_los_estados_pasan_solos_de_programado_a_sucedido_y_a_realizado(client, db_session):
    ahora = datetime.now(timezone.utc)
    en_vuelo = _agregar_vuelo(db_session, "BOG", "MDE", dias=0)
    en_vuelo.salida_utc, en_vuelo.llegada_utc = ahora - timedelta(minutes=10), ahora + timedelta(minutes=50)
    aterrizado = _agregar_vuelo(db_session, "BOG", "CLO", dias=0)
    aterrizado.salida_utc, aterrizado.llegada_utc = ahora - timedelta(hours=3), ahora - timedelta(hours=2)
    futuro = _agregar_vuelo(db_session, "BOG", "CTG", dias=2)
    db_session.commit()

    assert service.actualizar_estados(db_session) == 3  # en_vuelo -> sucedido; aterrizado -> sucedido -> realizado
    db_session.expire_all()
    assert db_session.get(Vuelo, en_vuelo.id).estado == EstadoVuelo.SUCEDIDO
    assert db_session.get(Vuelo, aterrizado.id).estado == EstadoVuelo.REALIZADO
    assert db_session.get(Vuelo, futuro.id).estado == EstadoVuelo.PROGRAMADO
    assert service.actualizar_estados(db_session) == 0  # idempotente


def test_realizados_lista_sucedidos_y_realizados_con_tiquetes_vendidos(client, db_session, adm):
    sembrar_vuelos_ejemplo(db_session)  # incluye AT-0011, ya sucedido
    r = client.get("/admin/vuelos/realizados", headers=adm)
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["total"] == len(cuerpo["items"]) >= 1
    assert {v["estado"] for v in cuerpo["items"]} <= {"sucedido", "realizado"}
    assert all("tiquetes_vendidos" in v for v in cuerpo["items"])
    salidas = [v["salida_utc"] for v in cuerpo["items"]]
    assert salidas == sorted(salidas, reverse=True)


def test_el_panel_muestra_los_tiquetes_vendidos(client, db_session, adm, con_saldo):
    v = _programar(client, adm)
    vuelo = db_session.get(Vuelo, v["id"])
    client.post("/compras", json=_cuerpo(_item(vuelo, [_viajero(1), _viajero(2)])), headers=con_saldo)
    lista = client.get("/admin/vuelos", headers=adm).json()["items"]
    assert next(x for x in lista if x["id"] == v["id"])["tiquetes_vendidos"] == 2
    assert client.get(f"/admin/vuelos/{v['id']}", headers=adm).json()["tiquetes_vendidos"] == 2


# ============================================================================ HU11: noticias
def test_al_programar_un_vuelo_se_publica_su_noticia(client, adm, cab):
    v = _programar(client, adm)
    items = client.get("/noticias", headers=cab).json()["items"]
    [n] = [x for x in items if x["vuelo_id"] == v["id"]]
    assert n["tipo"] == "vuelo" and n["precio"] == 250_000 and n["moneda"] == "COP"
    assert n["origen"] == {"ciudad": "Bogotá", "codigo": "BOG"} and n["destino"]["codigo"] == "MDE"
    assert n["salida"] == v["salida_utc"] and n["salida_zona"] == "America/Bogota"
    assert n["imagen_url"] is None and n["descuento_pct"] is None
    publicada = datetime.fromisoformat(n["publicada_en"].replace("Z", "+00:00"))
    vigente = datetime.fromisoformat(n["vigente_hasta"].replace("Z", "+00:00"))
    assert vigente - publicada == timedelta(days=8)


def test_la_noticia_sale_con_los_datos_editados_del_vuelo(client, adm, cab):
    v = _programar(client, adm)
    client.put(f"/admin/vuelos/{v['id']}", json=_edicion(v, destino="CLO", precio=199_000), headers=adm)
    [n] = [x for x in client.get("/noticias", headers=cab).json()["items"] if x["vuelo_id"] == v["id"]]
    assert n["destino"]["codigo"] == "CLO" and n["precio"] == 199_000


def test_la_noticia_se_retira_a_los_8_dias_o_si_el_vuelo_se_cancela(client, db_session, adm):
    v = _programar(client, adm, dias=30)
    ahora = datetime.now(timezone.utc)
    assert any(n.vuelo_id == v["id"] for n in noticias.listar_vigentes(db_session, ahora))
    assert not any(n.vuelo_id == v["id"] for n in noticias.listar_vigentes(db_session, ahora + timedelta(days=9)))

    client.patch(f"/admin/vuelos/{v['id']}/cancelar", json={}, headers=adm)
    assert not any(n.vuelo_id == v["id"] for n in noticias.listar_vigentes(db_session, ahora))


def test_la_noticia_se_retira_cuando_el_vuelo_ya_salio(client, db_session, adm):
    v = _programar(client, adm, dias=30)
    vuelo = db_session.get(Vuelo, v["id"])
    vuelo.salida_utc = datetime.now(timezone.utc) - timedelta(hours=1)
    db_session.commit()
    assert not any(n.vuelo_id == v["id"] for n in noticias.listar_vigentes(db_session))


def test_publicar_faltantes_crea_las_de_los_vuelos_que_ya_existian_sin_duplicar(client, db_session):
    sembrar_vuelos_ejemplo(db_session)
    creadas = noticias.publicar_faltantes(db_session)
    assert creadas >= 15
    assert noticias.publicar_faltantes(db_session) == 0
    assert db_session.scalar(select(Noticia.id).limit(1)) is not None


def test_publicar_faltantes_ignora_vuelos_programados_hace_mas_de_8_dias(client, db_session):
    v = _agregar_vuelo(db_session, "BOG", "MDE", dias=20)
    v.fecha_programacion = datetime.now(timezone.utc) - timedelta(days=30)
    db_session.commit()
    assert noticias.publicar_faltantes(db_session) == 0


# ============================================================================ HU11: suscripcion
def test_suscripcion_alta_consulta_cambio_y_baja(client, cab):
    assert client.get("/noticias/suscripcion", headers=cab).json() == {"suscrito": False, "correo": "ana.gomez@example.com"}
    r = client.put("/noticias/suscripcion", json={"correo": "Otra@Correo.com"}, headers=cab)
    assert r.status_code == 200 and r.json() == {"suscrito": True, "correo": "otra@correo.com"}
    assert client.get("/noticias/suscripcion", headers=cab).json()["suscrito"] is True
    assert client.put("/noticias/suscripcion", json={"correo": "nuevo@correo.com"}, headers=cab).json()["correo"] == "nuevo@correo.com"
    assert client.delete("/noticias/suscripcion", headers=cab).status_code == 204
    assert client.get("/noticias/suscripcion", headers=cab).json()["suscrito"] is False
    assert client.delete("/noticias/suscripcion", headers=cab).status_code == 204  # idempotente


def test_suscripcion_con_correo_invalido_da_422(client, cab):
    r = client.put("/noticias/suscripcion", json={"correo": "no-es-correo"}, headers=cab)
    assert r.status_code == 422 and "correo" in r.json()["error"]["fields"]


def test_los_suscritos_reciben_un_correo_al_programarse_un_vuelo(client, adm, cab, correos):
    client.put("/noticias/suscripcion", json={"correo": "suscrito@correo.com"}, headers=cab)
    antes = len(correos)
    v = _programar(client, adm)
    enviados = [c for c in correos[antes:] if c["destinatario"] == "suscrito@correo.com"]
    assert len(enviados) == 1 and v["codigo"] in enviados[0]["cuerpo"] and "Bogotá → Medellín" in enviados[0]["cuerpo"]

    client.delete("/noticias/suscripcion", headers=cab)
    antes = len(correos)
    _programar(client, adm, dias=11)
    assert not [c for c in correos[antes:] if c["destinatario"] == "suscrito@correo.com"]
