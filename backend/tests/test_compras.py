"""HU6-HU9 - Reservar, comprar, cancelar e historial (B1-12 a B1-15, B1-17)."""
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app.modules.compras import service
from app.modules.compras.models import Compra, EstadoReserva, EstadoTiquete, Reserva, Tiquete
from app.modules.financiero.models import Billetera
from app.modules.vuelos.models import Ciudad, TipoVuelo, Vuelo
from app.modules.vuelos.service import crear_vuelo, tipo_entre
from tests.conftest import auth_headers, datos_registro_cliente, login

AHORA = lambda: datetime.now(timezone.utc)  # noqa: E731


# ------------------------------------------------------------------------- ayudas
def _token(client, **over) -> str:
    datos = datos_registro_cliente(**over)
    assert client.post("/auth/registro", data=datos).status_code == 201
    return login(client, datos["usuario"], datos["password"])


def _otro_cliente(client) -> dict:
    return auth_headers(_token(client, dni="2000000002", usuario="otro", correo="otro@example.com"))


def _vuelo(db, origen="BOG", destino="MDE", *, en=timedelta(days=3), costo=200_000, **extras) -> Vuelo:
    ciudades = {c.codigo: c for c in db.scalars(select(Ciudad))}
    o, d = ciudades[origen], ciudades[destino]
    v = crear_vuelo(
        db, origen=o, destino=d, tipo=tipo_entre(o, d), salida_utc=AHORA() + en, duracion_min=60, costo=costo, **extras
    )
    db.commit()
    return v


def _viajero(n: int = 1, **over) -> dict:
    base = dict(
        documento=f"1000000{n:03d}", nombres=f"Viajero{n}", apellidos="Prueba", fecha_nacimiento="1990-04-12",
        genero="femenino", telefono="3001234567", correo=f"viajero{n}@example.com",
        nombre_contacto="Contacto Uno", telefono_contacto="3109876543",
    )
    base.update(over)
    return base


def _item(vuelo, viajeros=None, *, clase="economica", **extra) -> dict:
    return dict(vuelo_id=vuelo.id, clase=clase, viajeros=viajeros or [_viajero()], **extra)


def _cuerpo(*items) -> dict:
    return {"items": list(items)}


@pytest.fixture()
def cab(client):
    return auth_headers(_token(client))


@pytest.fixture()
def con_saldo(client, cab):
    client.post("/mi-billetera/agregar-saldo", json={"monto": 5_000_000}, headers=cab)
    return cab


@pytest.fixture()
def v1(client, db_session):
    """BOG -> MDE (nacional), dentro de 3 dias."""
    return _vuelo(db_session)


def _cupos(db, vuelo):
    db.expire_all()
    v = db.get(Vuelo, vuelo.id)
    return v.cupos_primera, v.cupos_economica


def _saldo(client, cab) -> int:
    return client.get("/mi-billetera", headers=cab).json()["saldo"]


# ------------------------------------------------------------------------- HU6: reservar
def test_reservar_crea_una_reserva_activa_por_24_horas(client, db_session, cab, v1, correos):
    antes = len(correos)
    resp = client.post("/reservas", json=_cuerpo(_item(v1)), headers=cab)
    assert resp.status_code == 201, resp.text
    r = resp.json()
    assert r["tipo"] == "reserva" and r["estado"] == "activa" and r["total"] == 200_000
    creada = datetime.fromisoformat(r["creada_en"].replace("Z", "+00:00"))
    expira = datetime.fromisoformat(r["expira_en"].replace("Z", "+00:00"))
    assert abs((expira - creada) - timedelta(hours=24)) < timedelta(seconds=2)

    [t] = r["tiquetes"]
    assert t["estado"] == "reservado" and t["trayecto"] == "unico" and t["clase"] == "economica"
    assert len(t["codigo_reserva"]) == 8 and 26 <= t["numero_silla"] <= 150
    assert t["vuelo"]["codigo"] == v1.codigo and t["viajero"]["documento"] == "1000000001"

    assert _cupos(db_session, v1) == (25, 124)  # un cupo de economica retenido

    [correo] = correos[antes:]
    assert correo["destinatario"] == "viajero1@example.com"
    assert t["codigo_reserva"] in correo["cuerpo"] and "se libera automaticamente" in correo["cuerpo"]


def test_cada_viajero_recibe_su_propio_codigo_y_correo(client, cab, v1, correos):
    antes = len(correos)
    viajeros = [_viajero(1), _viajero(2), _viajero(3)]
    r = client.post("/reservas", json=_cuerpo(_item(v1, viajeros)), headers=cab).json()
    codigos = [t["codigo_reserva"] for t in r["tiquetes"]]
    sillas = [t["numero_silla"] for t in r["tiquetes"]]
    assert len(set(codigos)) == 3 and len(set(sillas)) == 3
    enviados = {c["destinatario"]: c["cuerpo"] for c in correos[antes:]}
    assert set(enviados) == {"viajero1@example.com", "viajero2@example.com", "viajero3@example.com"}
    for t in r["tiquetes"]:
        assert t["codigo_reserva"] in enviados[t["viajero"]["correo"]]


@pytest.mark.parametrize(
    "origen,destino,clase,rango",
    [("BOG", "MDE", "primera", (1, 25)), ("BOG", "MDE", "economica", (26, 150)),
     ("BOG", "MIA", "primera", (1, 50)), ("BOG", "MIA", "economica", (51, 250))],
)
def test_la_silla_se_asigna_al_azar_dentro_del_rango_de_la_clase(client, db_session, cab, origen, destino, clase, rango):
    v = _vuelo(db_session, origen, destino)
    assert v.tipo == (TipoVuelo.INTERNACIONAL if destino == "MIA" else TipoVuelo.NACIONAL)
    t = client.post("/reservas", json=_cuerpo(_item(v, clase=clase)), headers=cab).json()["tiquetes"][0]
    assert rango[0] <= t["numero_silla"] <= rango[1]


def test_reservar_requiere_datos_obligatorios_del_viajero(client, cab, v1):
    viajero = _viajero()
    del viajero["telefono_contacto"]
    resp = client.post("/reservas", json=_cuerpo(_item(v1, [viajero])), headers=cab)
    assert resp.status_code == 422 and resp.json()["error"]["code"] == "validacion"
    assert any("telefono_contacto" in campo for campo in resp.json()["error"]["fields"])


@pytest.mark.parametrize(
    "cambio",
    [dict(correo="no-es-correo"), dict(fecha_nacimiento="2999-01-01"), dict(documento="12"), dict(telefono="abc")],
)
def test_datos_de_viajero_invalidos(client, cab, v1, cambio):
    resp = client.post("/reservas", json=_cuerpo(_item(v1, [_viajero(**cambio)])), headers=cab)
    assert resp.status_code == 422


def test_clase_y_trayecto_invalidos(client, cab, v1):
    assert client.post("/reservas", json=_cuerpo(_item(v1, clase="lujo")), headers=cab).status_code == 422
    sin_regreso = _item(v1, trayecto="completo")
    assert client.post("/reservas", json=_cuerpo(sin_regreso), headers=cab).status_code == 422
    con_regreso_inutil = _item(v1, trayecto="unico", vuelo_regreso_id=v1.id)
    assert client.post("/reservas", json=_cuerpo(con_regreso_inutil), headers=cab).status_code == 422


def test_vuelo_inexistente_cancelado_o_pasado(client, db_session, cab, v1):
    inexistente = {"items": [dict(_item(v1), vuelo_id=9999)]}
    resp = client.post("/reservas", json=inexistente, headers=cab)
    assert resp.status_code == 404 and resp.json()["error"]["code"] == "vuelo_no_encontrado"

    cancelado = _vuelo(db_session, "MDE", "CLO")
    cancelado.estado = "cancelado"
    db_session.commit()
    resp = client.post("/reservas", json=_cuerpo(_item(cancelado)), headers=cab)
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "vuelo_no_disponible"

    pasado = _vuelo(db_session, "CLO", "BOG", en=timedelta(hours=-2))
    assert client.post("/reservas", json=_cuerpo(_item(pasado)), headers=cab).json()["error"]["code"] == "vuelo_no_disponible"


def test_la_reserva_no_dura_mas_que_el_tiempo_que_falta_para_el_vuelo(client, db_session, cab):
    cerca = _vuelo(db_session, en=timedelta(hours=5))
    r = client.post("/reservas", json=_cuerpo(_item(cerca)), headers=cab).json()
    expira = datetime.fromisoformat(r["expira_en"].replace("Z", "+00:00"))
    assert expira <= cerca.salida_utc and expira - AHORA() < timedelta(hours=5, seconds=2)


# ------------------------------------------------------------------------- reglas de negocio
def test_un_menor_no_puede_viajar_solo(client, db_session, cab, v1):
    menor = _viajero(1, fecha_nacimiento=str(date.today().replace(year=date.today().year - 10)))
    resp = client.post("/reservas", json=_cuerpo(_item(v1, [menor])), headers=cab)
    assert resp.status_code == 422 and resp.json()["error"]["code"] == "menor_viajero_unico"
    assert _cupos(db_session, v1) == (25, 125)  # nada se retuvo


def test_un_menor_si_puede_viajar_con_un_adulto(client, cab, v1):
    menor = _viajero(2, fecha_nacimiento=str(date.today().replace(year=date.today().year - 10)))
    resp = client.post("/reservas", json=_cuerpo(_item(v1, [_viajero(1), menor])), headers=cab)
    assert resp.status_code == 201 and len(resp.json()["tiquetes"]) == 2


def test_la_mayoria_de_edad_se_cuenta_a_la_fecha_del_vuelo(client, db_session, cab):
    """Cumple 18 anios dentro de 3 dias, el vuelo sale dentro de 5: ya es mayor de edad ese dia."""
    salida = AHORA() + timedelta(days=5)
    nacimiento = (salida.date() - timedelta(days=1)).replace(year=salida.year - 18)
    v = _vuelo(db_session, en=timedelta(days=5))
    resp = client.post("/reservas", json=_cuerpo(_item(v, [_viajero(1, fecha_nacimiento=str(nacimiento))])), headers=cab)
    assert resp.status_code == 201, resp.text


def test_no_se_repite_un_viajero_dentro_de_la_misma_solicitud(client, cab, v1):
    resp = client.post("/reservas", json=_cuerpo(_item(v1, [_viajero(1), _viajero(1, nombres="Otro")])), headers=cab)
    assert resp.status_code == 422 and resp.json()["error"]["code"] == "viajero_duplicado"


def test_un_viajero_no_puede_estar_dos_veces_en_el_mismo_vuelo_ni_con_otro_comprador(client, db_session, cab, v1):
    assert client.post("/reservas", json=_cuerpo(_item(v1)), headers=cab).status_code == 201
    # mismo comprador
    resp = client.post("/reservas", json=_cuerpo(_item(v1)), headers=cab)
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "viajero_duplicado_en_vuelo"
    # otro comprador distinto, mismo viajero (R20: "sea o no el comprador")
    otro = _otro_cliente(client)
    client.post("/mi-billetera/agregar-saldo", json={"monto": 1_000_000}, headers=otro)
    resp = client.post("/compras", json=_cuerpo(_item(v1)), headers=otro)
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "viajero_duplicado_en_vuelo"


def test_el_comprador_que_tambien_viaja_no_se_duplica(client, db_session, con_saldo, v1):
    """El cliente (DNI 1000000001) se incluye a si mismo como viajero dos veces en el mismo vuelo."""
    yo = _viajero(1, documento="1000000001")
    assert client.post("/compras", json=_cuerpo(_item(v1, [yo])), headers=con_saldo).status_code == 201
    resp = client.post("/reservas", json=_cuerpo(_item(v1, [yo])), headers=con_saldo)
    assert resp.status_code == 409


def test_el_documento_se_normaliza(client, cab, v1):
    assert client.post("/reservas", json=_cuerpo(_item(v1, [_viajero(1, documento="ab-123.456")])), headers=cab).status_code == 201
    resp = client.post("/reservas", json=_cuerpo(_item(v1, [_viajero(2, documento="AB 123 456")])), headers=cab)
    assert resp.status_code == 409


def test_maximo_cinco_tiquetes_por_vuelo_y_cliente(client, cab, v1):
    assert client.post("/reservas", json=_cuerpo(_item(v1, [_viajero(n) for n in (1, 2, 3)])), headers=cab).status_code == 201
    resp = client.post("/reservas", json=_cuerpo(_item(v1, [_viajero(n) for n in (4, 5, 6)])), headers=cab)
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "limite_tiquetes_vuelo"
    # con dos mas se llega a 5 justos
    assert client.post("/reservas", json=_cuerpo(_item(v1, [_viajero(4), _viajero(5)])), headers=cab).status_code == 201


def test_mas_de_cinco_viajeros_en_un_item_es_invalido(client, cab, v1):
    resp = client.post("/reservas", json=_cuerpo(_item(v1, [_viajero(n) for n in range(1, 7)])), headers=cab)
    assert resp.status_code == 422


def test_el_limite_se_evalua_por_vuelo(client, db_session, con_saldo, v1):
    otro = _vuelo(db_session, "MDE", "BOG")
    cinco = [_viajero(n) for n in range(1, 6)]
    r = client.post("/compras", json=_cuerpo(_item(v1, cinco), _item(otro, cinco)), headers=con_saldo)
    assert r.status_code == 201 and len(r.json()["tiquetes"]) == 10


def test_no_hay_compra_y_reserva_activas_del_mismo_cliente_en_el_mismo_vuelo(client, con_saldo, v1):
    assert client.post("/compras", json=_cuerpo(_item(v1, [_viajero(1)])), headers=con_saldo).status_code == 201
    resp = client.post("/reservas", json=_cuerpo(_item(v1, [_viajero(2)])), headers=con_saldo)
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "compra_y_reserva_simultaneas"


def test_reservar_y_despues_comprar_el_mismo_vuelo_se_rechaza(client, con_saldo, v1):
    assert client.post("/reservas", json=_cuerpo(_item(v1, [_viajero(1)])), headers=con_saldo).status_code == 201
    resp = client.post("/compras", json=_cuerpo(_item(v1, [_viajero(2)])), headers=con_saldo)
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "compra_y_reserva_simultaneas"


def test_sin_cupos_no_se_crea_nada(client, db_session, cab):
    v = _vuelo(db_session, cupos_economica=1)
    resp = client.post("/reservas", json=_cuerpo(_item(v, [_viajero(1), _viajero(2)])), headers=cab)
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "sin_cupos"
    assert _cupos(db_session, v) == (25, 1)
    assert db_session.query(Tiquete).count() == 0 and db_session.query(Reserva).count() == 0
    # el ultimo cupo si se puede reservar, y el siguiente ya no
    assert client.post("/reservas", json=_cuerpo(_item(v, [_viajero(1)])), headers=cab).status_code == 201
    otro = _otro_cliente(client)
    assert client.post("/reservas", json=_cuerpo(_item(v, [_viajero(9)])), headers=otro).status_code == 409


def test_los_cupos_de_primera_y_economica_son_independientes(client, db_session, cab):
    v = _vuelo(db_session, cupos_primera=0)
    assert client.post("/reservas", json=_cuerpo(_item(v, clase="primera")), headers=cab).json()["error"]["code"] == "sin_cupos"
    assert client.post("/reservas", json=_cuerpo(_item(v, clase="economica")), headers=cab).status_code == 201


# ------------------------------------------------------------------------- trayecto completo
def test_trayecto_completo_crea_ida_y_regreso_con_un_codigo_por_viajero(client, db_session, con_saldo, v1, correos):
    vuelta = _vuelo(db_session, "MDE", "BOG", en=timedelta(days=6), costo=210_000)
    antes = len(correos)
    item = _item(v1, [_viajero(1), _viajero(2)], trayecto="completo", vuelo_regreso_id=vuelta.id)
    resp = client.post("/compras", json=_cuerpo(item), headers=con_saldo)
    assert resp.status_code == 201, resp.text
    c = resp.json()
    assert c["total"] == 2 * (200_000 + 210_000) and len(c["tiquetes"]) == 4
    por_viajero = {}
    for t in c["tiquetes"]:
        por_viajero.setdefault(t["viajero"]["documento"], []).append(t)
    for tiquetes in por_viajero.values():
        assert {t["trayecto"] for t in tiquetes} == {"ida", "regreso"}
        assert len({t["codigo_reserva"] for t in tiquetes}) == 1  # ida y regreso comparten codigo
    assert len({ts[0]["codigo_reserva"] for ts in por_viajero.values()}) == 2  # distinto por viajero
    assert len(correos[antes:]) == 2  # un correo por viajero, con ambos tramos
    assert correos[antes]["cuerpo"].count(vuelta.codigo) == 1 and correos[antes]["cuerpo"].count(v1.codigo) == 1
    assert _saldo(client, con_saldo) == 5_000_000 - c["total"]


def test_el_regreso_debe_volver_al_origen(client, db_session, cab, v1):
    otro_destino = _vuelo(db_session, "CLO", "BOG", en=timedelta(days=6))
    item = _item(v1, trayecto="completo", vuelo_regreso_id=otro_destino.id)
    resp = client.post("/reservas", json=_cuerpo(item), headers=cab)
    assert resp.status_code == 422 and resp.json()["error"]["code"] == "trayecto_invalido"


def test_el_regreso_debe_salir_despues_de_llegar_la_ida(client, db_session, cab, v1):
    antes = _vuelo(db_session, "MDE", "BOG", en=timedelta(days=1))
    item = _item(v1, trayecto="completo", vuelo_regreso_id=antes.id)
    resp = client.post("/reservas", json=_cuerpo(item), headers=cab)
    assert resp.status_code == 422 and resp.json()["error"]["code"] == "trayecto_invalido"


# ------------------------------------------------------------------------- HU7: comprar
def test_comprar_descuenta_el_saldo_y_envia_el_codigo(client, db_session, con_saldo, v1, correos):
    antes = len(correos)
    resp = client.post("/compras", json=_cuerpo(_item(v1, clase="primera")), headers=con_saldo)
    assert resp.status_code == 201, resp.text
    c = resp.json()
    assert c["tipo"] == "compra" and c["estado"] == "pagada" and c["total"] == 200_000 and c["expira_en"] is None
    [t] = c["tiquetes"]
    assert t["estado"] == "comprado" and 1 <= t["numero_silla"] <= 25
    assert _saldo(client, con_saldo) == 4_800_000
    assert _cupos(db_session, v1) == (24, 125)
    [correo] = correos[antes:]
    assert t["codigo_reserva"] in correo["cuerpo"] and "Compra confirmada" in correo["cuerpo"]


def test_con_saldo_insuficiente_no_se_compra_nada(client, db_session, cab, v1, correos):
    client.post("/mi-billetera/agregar-saldo", json={"monto": 100_000}, headers=cab)
    antes = len(correos)
    resp = client.post("/compras", json=_cuerpo(_item(v1)), headers=cab)
    assert resp.status_code == 402 and resp.json()["error"]["code"] == "saldo_insuficiente"
    assert _saldo(client, cab) == 100_000
    assert _cupos(db_session, v1) == (25, 125)
    assert db_session.query(Tiquete).count() == 0 and db_session.query(Compra).count() == 0
    assert len(correos) == antes  # y no se manda ningun correo


def test_el_carrito_puede_tener_tiquetes_de_distintos_vuelos(client, db_session, con_saldo, v1):
    v2 = _vuelo(db_session, "BOG", "MIA", costo=1_500_000)
    v3 = _vuelo(db_session, "MDE", "CLO", costo=150_000)
    carrito = _cuerpo(_item(v1), _item(v2, [_viajero(2)], clase="primera"), _item(v3, [_viajero(3), _viajero(4)]))
    resp = client.post("/compras", json=carrito, headers=con_saldo)
    assert resp.status_code == 201, resp.text
    c = resp.json()
    assert c["total"] == 200_000 + 1_500_000 + 2 * 150_000 and len(c["tiquetes"]) == 4
    assert {t["vuelo"]["codigo"] for t in c["tiquetes"]} == {v1.codigo, v2.codigo, v3.codigo}
    assert _saldo(client, con_saldo) == 5_000_000 - c["total"]


def test_si_una_linea_del_carrito_falla_no_se_cobra_ninguna(client, db_session, con_saldo, v1):
    sin_cupo = _vuelo(db_session, "MDE", "CLO", cupos_economica=0)
    resp = client.post("/compras", json=_cuerpo(_item(v1), _item(sin_cupo, [_viajero(2)])), headers=con_saldo)
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "sin_cupos"
    assert _saldo(client, con_saldo) == 5_000_000
    assert _cupos(db_session, v1) == (25, 125)
    assert db_session.query(Tiquete).count() == 0


def test_se_pueden_pagar_las_reservas_con_la_billetera(client, db_session, con_saldo, v1, correos):
    r = client.post("/reservas", json=_cuerpo(_item(v1, [_viajero(1), _viajero(2)])), headers=con_saldo).json()
    antes = len(correos)
    resp = client.post(f"/reservas/{r['id']}/comprar", json={}, headers=con_saldo)
    assert resp.status_code == 201, resp.text
    c = resp.json()
    assert c["tipo"] == "compra" and c["id_reserva"] == r["id"] and c["total"] == 400_000
    # mismos tiquetes, mismos codigos y mismas sillas
    assert {(t["codigo_reserva"], t["numero_silla"]) for t in c["tiquetes"]} == {
        (t["codigo_reserva"], t["numero_silla"]) for t in r["tiquetes"]
    }
    assert {t["estado"] for t in c["tiquetes"]} == {"comprado"}
    assert _saldo(client, con_saldo) == 4_600_000
    assert _cupos(db_session, v1) == (25, 123)  # los cupos ya estaban retenidos: no se vuelven a restar
    assert len(correos) == antes + 2  # se confirman los codigos de compra

    assert client.get(f"/reservas/{r['id']}", headers=con_saldo).json()["estado"] == "comprada"
    otra_vez = client.post(f"/reservas/{r['id']}/comprar", headers=con_saldo)
    assert otra_vez.status_code == 409 and otra_vez.json()["error"]["code"] == "reserva_ya_comprada"
    assert _saldo(client, con_saldo) == 4_600_000  # no se cobra dos veces


def test_pagar_una_reserva_sin_saldo_la_deja_intacta(client, cab, v1):
    r = client.post("/reservas", json=_cuerpo(_item(v1)), headers=cab).json()
    resp = client.post(f"/reservas/{r['id']}/comprar", headers=cab)
    assert resp.status_code == 402
    despues = client.get(f"/reservas/{r['id']}", headers=cab).json()
    assert despues["estado"] == "activa" and despues["tiquetes"][0]["estado"] == "reservado"


# ------------------------------------------------------------------------- vencimiento de reservas
def _vencer_en_la_base(db, id_reserva):
    reserva = db.get(Reserva, id_reserva)
    reserva.expira_en = AHORA() - timedelta(minutes=1)
    db.commit()


def test_una_reserva_vencida_libera_cupo_y_silla(client, db_session, cab, v1):
    r = client.post("/reservas", json=_cuerpo(_item(v1)), headers=cab).json()
    assert _cupos(db_session, v1) == (25, 124)
    _vencer_en_la_base(db_session, r["id"])

    assert service.vencer_reservas(db_session) == 1
    assert service.vencer_reservas(db_session) == 0  # idempotente: no libera dos veces
    assert _cupos(db_session, v1) == (25, 125)
    tiquete = db_session.scalars(select(Tiquete)).one()
    assert tiquete.estado == EstadoTiquete.VENCIDO and tiquete.numero_silla is None
    assert db_session.get(Reserva, r["id"]).estado == EstadoReserva.VENCIDA


def test_las_reservas_vencidas_se_liberan_al_consultar_aunque_no_corra_la_tarea(client, db_session, cab, v1):
    r = client.post("/reservas", json=_cuerpo(_item(v1)), headers=cab).json()
    _vencer_en_la_base(db_session, r["id"])
    item = client.get("/mi-historial", headers=cab).json()["items"][0]
    assert item["estado"] == "vencida" and item["tiquetes"][0]["estado"] == "vencido"
    assert _cupos(db_session, v1) == (25, 125)


def test_no_se_puede_pagar_ni_cancelar_una_reserva_vencida(client, db_session, con_saldo, v1):
    r = client.post("/reservas", json=_cuerpo(_item(v1)), headers=con_saldo).json()
    _vencer_en_la_base(db_session, r["id"])
    pagar = client.post(f"/reservas/{r['id']}/comprar", headers=con_saldo)
    assert pagar.status_code == 409 and pagar.json()["error"]["code"] == "reserva_vencida"
    cancelar = client.post(f"/reservas/{r['id']}/cancelar", headers=con_saldo)
    assert cancelar.status_code == 409 and cancelar.json()["error"]["code"] == "reserva_vencida"
    assert _saldo(client, con_saldo) == 5_000_000


def test_tras_vencer_el_viajero_puede_volver_a_reservar_y_la_silla_se_reutiliza(client, db_session, cab, v1):
    r = client.post("/reservas", json=_cuerpo(_item(v1)), headers=cab).json()
    _vencer_en_la_base(db_session, r["id"])
    assert client.post("/reservas", json=_cuerpo(_item(v1)), headers=cab).status_code == 201


# ------------------------------------------------------------------------- HU8: cancelar
def test_cancelar_una_reserva_libera_cupos(client, db_session, cab, v1):
    r = client.post("/reservas", json=_cuerpo(_item(v1, [_viajero(1), _viajero(2)])), headers=cab).json()
    resp = client.post(f"/reservas/{r['id']}/cancelar", headers=cab)
    assert resp.status_code == 200, resp.text
    cuerpo = resp.json()
    assert cuerpo["reintegro"] == 0 and cuerpo["saldo"] is None
    assert cuerpo["operacion"]["estado"] == "cancelada"
    assert {t["estado"] for t in cuerpo["operacion"]["tiquetes"]} == {"cancelado"}
    assert {t["numero_silla"] for t in cuerpo["operacion"]["tiquetes"]} == {None}
    assert _cupos(db_session, v1) == (25, 125)
    otra = client.post(f"/reservas/{r['id']}/cancelar", headers=cab)
    assert otra.status_code == 409 and otra.json()["error"]["code"] == "reserva_cancelada"
    assert _cupos(db_session, v1) == (25, 125)  # no se devuelven cupos dos veces


def test_despues_de_cancelar_la_reserva_se_puede_volver_a_reservar_lo_mismo(client, cab, v1):
    r = client.post("/reservas", json=_cuerpo(_item(v1)), headers=cab).json()
    client.post(f"/reservas/{r['id']}/cancelar", headers=cab)
    assert client.post("/reservas", json=_cuerpo(_item(v1)), headers=cab).status_code == 201


def test_cancelar_una_compra_reintegra_a_la_billetera(client, db_session, con_saldo, v1, correos):
    c = client.post("/compras", json=_cuerpo(_item(v1, [_viajero(1), _viajero(2)])), headers=con_saldo).json()
    assert _saldo(client, con_saldo) == 4_600_000
    antes = len(correos)
    resp = client.post(f"/compras/{c['id']}/cancelar", headers=con_saldo)
    assert resp.status_code == 200, resp.text
    cuerpo = resp.json()
    assert cuerpo["reintegro"] == 400_000 and cuerpo["saldo"] == 5_000_000
    assert cuerpo["operacion"]["estado"] == "cancelada"
    assert {t["estado"] for t in cuerpo["operacion"]["tiquetes"]} == {"cancelado"}
    assert _saldo(client, con_saldo) == 5_000_000  # el reintegro se refleja de inmediato
    assert _cupos(db_session, v1) == (25, 125)
    assert db_session.query(Tiquete).filter(Tiquete.numero_silla.is_not(None)).count() == 0

    [aviso] = correos[antes:]
    assert aviso["destinatario"] == "ana.gomez@example.com"
    assert "400.000" in aviso["cuerpo"] and "billetera" in aviso["cuerpo"]


def test_no_se_reintegra_dos_veces(client, con_saldo, v1):
    c = client.post("/compras", json=_cuerpo(_item(v1)), headers=con_saldo).json()
    assert client.post(f"/compras/{c['id']}/cancelar", headers=con_saldo).status_code == 200
    otra = client.post(f"/compras/{c['id']}/cancelar", headers=con_saldo)
    assert otra.status_code == 409 and otra.json()["error"]["code"] == "compra_ya_cancelada"
    assert _saldo(client, con_saldo) == 5_000_000


def test_la_compra_solo_se_cancela_hasta_una_hora_antes(client, db_session, con_saldo):
    cerca = _vuelo(db_session, en=timedelta(minutes=30))
    c = client.post("/compras", json=_cuerpo(_item(cerca)), headers=con_saldo).json()
    resp = client.post(f"/compras/{c['id']}/cancelar", headers=con_saldo)
    assert resp.status_code == 409 and resp.json()["error"]["code"] == "fuera_de_plazo_cancelacion"
    assert _saldo(client, con_saldo) == 5_000_000 - 200_000  # no hubo reintegro
    assert client.get(f"/compras/{c['id']}", headers=con_saldo).json()["estado"] == "pagada"


def test_el_limite_de_una_hora_es_exacto(client, db_session, con_saldo):
    justo_antes = _vuelo(db_session, en=timedelta(hours=1, minutes=2))
    c = client.post("/compras", json=_cuerpo(_item(justo_antes)), headers=con_saldo).json()
    assert client.post(f"/compras/{c['id']}/cancelar", headers=con_saldo).status_code == 200


def test_cancelar_solo_algunos_tiquetes_de_la_compra(client, db_session, con_saldo, v1):
    c = client.post("/compras", json=_cuerpo(_item(v1, [_viajero(1), _viajero(2), _viajero(3)])), headers=con_saldo).json()
    uno = c["tiquetes"][0]["id"]
    resp = client.post(f"/compras/{c['id']}/cancelar", json={"tiquete_ids": [uno]}, headers=con_saldo)
    assert resp.status_code == 200, resp.text
    cuerpo = resp.json()
    assert cuerpo["reintegro"] == 200_000 and cuerpo["operacion"]["estado"] == "parcialmente_cancelada"
    estados = {t["id"]: t["estado"] for t in cuerpo["operacion"]["tiquetes"]}
    assert estados[uno] == "cancelado" and list(estados.values()).count("comprado") == 2
    assert _cupos(db_session, v1) == (25, 123)
    # el viajero cancelado puede volver a comprar; ya no cuenta para los 5 maximos
    otra = client.post(f"/compras/{c['id']}/cancelar", json={"tiquete_ids": [uno]}, headers=con_saldo)
    assert otra.status_code == 404 and otra.json()["error"]["code"] == "tiquete_no_encontrado"
    final = client.post(f"/compras/{c['id']}/cancelar", headers=con_saldo).json()
    assert final["reintegro"] == 400_000 and final["operacion"]["estado"] == "cancelada"


def test_cancelar_la_ida_deja_el_regreso(client, db_session, con_saldo, v1):
    vuelta = _vuelo(db_session, "MDE", "BOG", en=timedelta(days=6))
    c = client.post("/compras", json=_cuerpo(_item(v1, trayecto="completo", vuelo_regreso_id=vuelta.id)), headers=con_saldo).json()
    ida = next(t["id"] for t in c["tiquetes"] if t["trayecto"] == "ida")
    r = client.post(f"/compras/{c['id']}/cancelar", json={"tiquete_ids": [ida]}, headers=con_saldo).json()
    assert r["operacion"]["estado"] == "parcialmente_cancelada" and r["reintegro"] == 200_000


def test_no_se_pueden_cancelar_ni_ver_operaciones_de_otro_cliente(client, con_saldo, v1):
    c = client.post("/compras", json=_cuerpo(_item(v1)), headers=con_saldo).json()
    r = client.post("/reservas", json=_cuerpo(_item(v1, [_viajero(2)])), headers=con_saldo)
    # (la reserva falla por compra+reserva simultaneas; se crea en otro vuelo)
    assert r.status_code == 409
    otro = _otro_cliente(client)
    assert client.post(f"/compras/{c['id']}/cancelar", headers=otro).status_code == 404
    assert client.get(f"/compras/{c['id']}", headers=otro).status_code == 404
    assert client.get("/compras/9999", headers=otro).json()["error"]["code"] == "compra_no_encontrada"
    assert client.post("/reservas/9999/cancelar", headers=otro).json()["error"]["code"] == "reserva_no_encontrada"
    assert client.post("/reservas/9999/comprar", headers=otro).status_code == 404


# ------------------------------------------------------------------------- HU9: historial
def test_historial_de_compras_y_reservas_activas_y_canceladas(client, db_session, con_saldo, v1):
    v2 = _vuelo(db_session, "MDE", "BOG")
    v3 = _vuelo(db_session, "CLO", "BOG")
    compra = client.post("/compras", json=_cuerpo(_item(v1)), headers=con_saldo).json()
    reserva = client.post("/reservas", json=_cuerpo(_item(v2, [_viajero(2)])), headers=con_saldo).json()
    cancelada = client.post("/reservas", json=_cuerpo(_item(v3, [_viajero(3)])), headers=con_saldo).json()
    client.post(f"/reservas/{cancelada['id']}/cancelar", headers=con_saldo)
    pagada = client.post("/reservas", json=_cuerpo(_item(_vuelo(db_session, "CTG", "BOG"), [_viajero(4)])), headers=con_saldo).json()
    client.post(f"/reservas/{pagada['id']}/comprar", headers=con_saldo)

    h = client.get("/mi-historial", headers=con_saldo).json()
    assert h["total"] == 4 and h["pagina"] == 1 and h["tamano"] == 10
    resumen = [(i["tipo"], i["estado"]) for i in h["items"]]
    # mas reciente primero; la reserva pagada no aparece sola: la representa su compra
    assert resumen == [("compra", "pagada"), ("reserva", "cancelada"), ("reserva", "activa"), ("compra", "pagada")]
    assert h["items"][0]["id_reserva"] == pagada["id"]
    assert h["items"][2]["id"] == reserva["id"] and h["items"][3]["id"] == compra["id"]
    assert all(i["tiquetes"] for i in h["items"])


def test_historial_pagina_y_filtra_por_tipo(client, db_session, con_saldo):
    for n in range(3):
        v = _vuelo(db_session, "BOG", "MDE")
        client.post("/compras", json=_cuerpo(_item(v, [_viajero(n + 1)])), headers=con_saldo)
    v = _vuelo(db_session, "MDE", "CLO")
    client.post("/reservas", json=_cuerpo(_item(v, [_viajero(9)])), headers=con_saldo)

    p1 = client.get("/mi-historial", params={"tamano": 3}, headers=con_saldo).json()
    p2 = client.get("/mi-historial", params={"tamano": 3, "pagina": 2}, headers=con_saldo).json()
    assert p1["total"] == 4 and len(p1["items"]) == 3 and len(p2["items"]) == 1
    assert {i["id"] for i in p1["items"] if i["tipo"] == "compra"} | {i["id"] for i in p2["items"] if i["tipo"] == "compra"} == {1, 2, 3}
    solo = client.get("/mi-historial", params={"tipo": "compra"}, headers=con_saldo).json()
    assert solo["total"] == 3 and {i["tipo"] for i in solo["items"]} == {"compra"}
    assert client.get("/mi-historial", params={"tipo": "otra"}, headers=con_saldo).status_code == 422
    assert client.get("/mi-historial", params={"pagina": 0}, headers=con_saldo).status_code == 422


def test_el_historial_es_solo_del_cliente(client, con_saldo, v1):
    client.post("/compras", json=_cuerpo(_item(v1)), headers=con_saldo)
    otro = _otro_cliente(client)
    assert client.get("/mi-historial", headers=otro).json() == {"total": 0, "pagina": 1, "tamano": 10, "items": []}


def test_historial_vacio(client, cab):
    assert client.get("/mi-historial", headers=cab).json()["items"] == []


# ------------------------------------------------------------------------- permisos
RUTAS = [("post", "/reservas"), ("post", "/compras"), ("get", "/mi-historial"), ("post", "/reservas/1/cancelar"),
         ("post", "/compras/1/cancelar"), ("post", "/reservas/1/comprar")]


@pytest.mark.parametrize("metodo,ruta", RUTAS)
def test_sin_sesion_da_401(client, metodo, ruta):
    assert getattr(client, metodo)(ruta).status_code == 401


@pytest.mark.parametrize("metodo,ruta", RUTAS)
def test_root_no_puede_comprar_ni_reservar(client, metodo, ruta):
    s = get_settings()
    cab_root = auth_headers(login(client, s.ROOT_ID, s.ROOT_PASSWORD))
    resp = client.request(metodo.upper(), ruta, json={"items": []}, headers=cab_root)
    assert resp.status_code == 403 and resp.json()["error"]["code"] == "permiso_denegado"


def test_un_administrador_no_puede_comprar_ni_reservar(client, db_session, v1):
    from app.modules.usuarios.models import Administrador

    s = get_settings()
    cab_root = auth_headers(login(client, s.ROOT_ID, s.ROOT_PASSWORD))
    nuevo = client.post("/root/administradores", json={"correo": "adm@example.com", "nombre": "Adm"}, headers=cab_root).json()
    token = db_session.get(Administrador, nuevo["id"]).token_invitacion
    datos = datos_registro_cliente(dni="3000000003", usuario="admin1", correo="adm@example.com")
    assert client.post("/auth/completar-registro", data={**datos, "token": token}).status_code == 201
    cab_admin = auth_headers(login(client, "admin1", datos["password"]))
    assert client.post("/reservas", json=_cuerpo(_item(v1)), headers=cab_admin).status_code == 403
    assert client.post("/compras", json=_cuerpo(_item(v1)), headers=cab_admin).status_code == 403
    assert client.get("/mi-historial", headers=cab_admin).status_code == 403


# ------------------------------------------------------------------------- garantias de la base de datos
def test_la_base_de_datos_impide_repetir_silla_y_persona_en_un_vuelo(client, db_session, cab, v1):
    """Aunque dos peticiones simultaneas pasaran las validaciones, las restricciones unicas las frenan."""
    client.post("/reservas", json=_cuerpo(_item(v1)), headers=cab)
    base = db_session.scalars(select(Tiquete)).one()

    def copia(**cambios):
        datos = dict(
            id_cliente=base.id_cliente, id_viajero=base.id_viajero, id_vuelo=base.id_vuelo, documento=base.documento,
            codigo_reserva="ZZZZ9999", clase=base.clase, trayecto=base.trayecto, numero_silla=base.numero_silla,
            precio=base.precio, estado=EstadoTiquete.RESERVADO,
        )
        datos.update(cambios)
        return Tiquete(**datos)

    for duplicado in (
        copia(documento="OTRO0001"),  # misma silla del mismo vuelo
        copia(numero_silla=None, codigo_reserva="YYYY8888"),  # misma persona activa en el mismo vuelo
    ):
        db_session.add(duplicado)
        with pytest.raises(IntegrityError):
            db_session.commit()
        db_session.rollback()

    # un tiquete cancelado de esa persona no estorba
    db_session.add(copia(numero_silla=None, codigo_reserva="XXXX7777", estado=EstadoTiquete.CANCELADO))
    db_session.commit()


def test_el_saldo_nunca_queda_negativo_en_la_base_de_datos(client, db_session, cab):
    client.get("/mi-billetera", headers=cab)
    billetera = db_session.scalars(select(Billetera)).one()
    billetera.saldo = -1
    with pytest.raises(IntegrityError):
        db_session.commit()


# ------------------------------------------------------------------------- gancho para B2 (HU13)
def test_si_el_administrador_cancela_el_vuelo_se_reintegran_las_compras(client, db_session, con_saldo, v1):
    comprado = client.post("/compras", json=_cuerpo(_item(v1, [_viajero(1), _viajero(2)])), headers=con_saldo).json()
    otro = _otro_cliente(client)
    reservado = client.post("/reservas", json=_cuerpo(_item(v1, [_viajero(7)])), headers=otro).json()
    assert _saldo(client, con_saldo) == 4_600_000

    resultado = service.reintegrar_vuelo_cancelado(db_session, v1.id)
    assert resultado == {"tiquetes": 3, "reintegrado": 400_000}
    assert _saldo(client, con_saldo) == 5_000_000
    assert client.get(f"/compras/{comprado['id']}", headers=con_saldo).json()["estado"] == "cancelada"
    assert client.get(f"/reservas/{reservado['id']}", headers=otro).json()["estado"] == "cancelada"
    assert service.reintegrar_vuelo_cancelado(db_session, v1.id) == {"tiquetes": 0, "reintegrado": 0}  # idempotente
    assert _saldo(client, con_saldo) == 5_000_000


# ------------------------------------------------------------------------- consultas de apoyo a la pantalla de compra
def test_mis_tiquetes_en_vuelo_cuenta_activos_y_descuenta_cancelados(client, con_saldo, v1):
    assert client.get(f"/vuelos/{v1.id}/mis-tiquetes", headers=con_saldo).json() == {
        "vuelo_id": v1.id, "activos": 0, "maximo": 5, "disponibles": 5,
    }
    compra = client.post("/compras", json=_cuerpo(_item(v1, [_viajero(1), _viajero(2)])), headers=con_saldo).json()
    assert client.get(f"/vuelos/{v1.id}/mis-tiquetes", headers=con_saldo).json()["activos"] == 2
    client.post(f"/compras/{compra['id']}/cancelar", headers=con_saldo)
    cuerpo = client.get(f"/vuelos/{v1.id}/mis-tiquetes", headers=con_saldo).json()
    assert cuerpo["activos"] == 0 and cuerpo["disponibles"] == 5


def test_vuelos_de_regreso_son_directos_destino_origen_y_posteriores_a_la_llegada(client, db_session, cab, v1):
    ida = _vuelo(db_session, "BOG", "MDE", en=timedelta(days=3))
    antes = _vuelo(db_session, "MDE", "BOG", en=timedelta(days=2))                 # sale antes de la ida: no sirve
    despues = _vuelo(db_session, "MDE", "BOG", en=timedelta(days=5))
    _vuelo(db_session, "MDE", "CLO", en=timedelta(days=5))                          # otro destino: no sirve
    cancelado = _vuelo(db_session, "MDE", "BOG", en=timedelta(days=6))
    cancelado.estado = cancelado.estado.CANCELADO
    db_session.commit()

    resp = client.get(f"/vuelos/{ida.id}/regreso", headers=cab)
    assert resp.status_code == 200
    ids = [v["id"] for v in resp.json()]
    assert despues.id in ids and antes.id not in ids and cancelado.id not in ids
    assert all(v["origen"]["codigo"] == "MDE" and v["destino"]["codigo"] == "BOG" for v in resp.json())
    assert all("tiquetes_cliente" in v and "costo" in v for v in resp.json())


def test_vuelos_de_regreso_de_un_vuelo_inexistente_es_404(client, cab):
    resp = client.get("/vuelos/99999/regreso", headers=cab)
    assert resp.status_code == 404 and resp.json()["error"]["code"] == "vuelo_no_encontrado"


def test_consultas_de_apoyo_exigen_cliente(client, v1):
    assert client.get(f"/vuelos/{v1.id}/regreso").status_code == 401
    s = get_settings()
    cab_root = auth_headers(login(client, s.ROOT_ID, s.ROOT_PASSWORD))
    assert client.get(f"/vuelos/{v1.id}/mis-tiquetes", headers=cab_root).status_code == 403
