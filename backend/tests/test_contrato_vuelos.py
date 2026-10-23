"""
Contrato de Ciudades, Vuelos y Busqueda contra la base de datos (B2-06 a B2-09).

Verifica lo que pide `frontend/docs/CONTRATO_VUELOS.md`: forma de las respuestas, roles, filtros
combinables, orden y paginacion. Los vuelos salen de los seeds (`sembrar_vuelos_ejemplo`).
"""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from app.core.config import get_settings
from app.modules.vuelos import service
from app.modules.vuelos.models import EstadoVuelo, TipoVuelo
from app.modules.vuelos.seeds import sembrar_vuelos_ejemplo
from tests.conftest import auth_headers, datos_registro_cliente, login

CAMPOS_VUELO = {
    "id", "codigo", "tipo", "estado", "origen", "destino", "salida_utc", "llegada_utc",
    "duracion_min", "costo", "cupos_economica", "cupos_primera", "fecha_programacion",
}
CAMPOS_CIUDAD = {"codigo", "nombre", "pais", "zona_horaria", "es_capital_departamento", "grupo_internacional"}
FUTUROS = 19  # de los 20 vuelos sembrados, AT-0011 ya sucedio


# --------------------------------------------------------------------------- fixtures
@pytest.fixture()
def vuelos(client, db_session):
    """Los 20 vuelos de ejemplo (el catalogo de ciudades ya lo siembra el arranque de la app)."""
    assert sembrar_vuelos_ejemplo(db_session) == 20


@pytest.fixture()
def token_admin(client, db_session):
    """Un administrador real: lo invita el root y completa su registro."""
    from app.modules.usuarios.models import Administrador

    settings = get_settings()
    token_root = login(client, settings.ROOT_ID, settings.ROOT_PASSWORD)
    resp = client.post(
        "/root/administradores",
        json={"correo": "admin.vuelos@example.com", "nombre": "Admin Vuelos"},
        headers=auth_headers(token_root),
    )
    assert resp.status_code == 201, resp.text
    invitacion = db_session.get(Administrador, resp.json()["id"]).token_invitacion
    resp = client.post(
        "/auth/completar-registro",
        data={
            "token": invitacion, "dni": "2000000009", "nombres": "Admin", "apellidos": "Vuelos",
            "fecha_nacimiento": "1988-03-15", "lugar_nacimiento": "Colombia",
            "direccion_facturacion": "Carrera 7 # 1-20", "genero": "masculino",
            "correo": "admin.vuelos@example.com", "usuario": "adminvuelos", "password": "claveAdmin123",
        },
    )
    assert resp.status_code == 201, resp.text
    return login(client, "adminvuelos", "claveAdmin123")


@pytest.fixture()
def token_cliente(client):
    client.post("/auth/registro", data=datos_registro_cliente())
    return login(client, "anagomez", "clavesegura123")


def _agregar_vuelo(db, origen: str, destino: str, *, dias: int, estado=EstadoVuelo.PROGRAMADO, costo=100_000):
    o, d = service.obtener_ciudad(db, origen), service.obtener_ciudad(db, destino)
    vuelo = service.crear_vuelo(
        db, origen=o, destino=d, tipo=service.tipo_entre(o, d), estado=estado,
        salida_utc=datetime.now(timezone.utc) + timedelta(days=dias), duracion_min=60, costo=costo,
    )
    db.commit()
    return vuelo


def _codigos(respuesta) -> list[str]:
    return [v["codigo"] for v in respuesta.json()["items"]]


def _datos_programar(**cambios) -> dict:
    fecha = (datetime.now(timezone.utc) + timedelta(days=30)).date().isoformat()
    base = {
        "tipo": "nacional", "origen": "BOG", "destino": "MDE",
        "fecha": fecha, "hora": "08:00", "duracion": 65, "costo": 300000,
    }
    base.update(cambios)
    return base


# --------------------------------------------------------------------------- /ciudades
def test_ciudades_es_publico_y_trae_el_catalogo_completo(client):
    resp = client.get("/ciudades")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 37  # 32 capitales + 5 del exterior
    assert all(set(c) == CAMPOS_CIUDAD for c in items)
    assert {"BOG", "PEI", "MAD", "LON", "NYC", "BUE", "MIA"} <= {c["codigo"] for c in items}


def test_ciudades_vienen_en_orden_alfabetico(client):
    nombres = [c["nombre"] for c in client.get("/ciudades").json()["items"]]
    assert nombres == sorted(nombres)


def test_ciudades_uso_nacional_son_las_32_capitales(client):
    items = client.get("/ciudades", params={"uso": "nacional"}).json()["items"]
    assert len(items) == 32
    assert all(c["es_capital_departamento"] for c in items)


def test_ciudades_uso_internacional_trae_los_dos_grupos(client):
    items = client.get("/ciudades", params={"uso": "internacional"}).json()["items"]
    por_grupo = {g: {c["codigo"] for c in items if c["grupo_internacional"] == g} for g in ("colombia", "exterior")}
    assert por_grupo["colombia"] == {"PEI", "BOG", "MDE", "CLO", "CTG"}
    assert por_grupo["exterior"] == {"MAD", "LON", "NYC", "BUE", "MIA"}
    assert len(items) == 10


def test_ciudades_zona_horaria_del_exterior(client):
    por_codigo = {c["codigo"]: c for c in client.get("/ciudades").json()["items"]}
    assert por_codigo["BOG"]["zona_horaria"] == "America/Bogota"
    assert por_codigo["MAD"]["zona_horaria"] == "Europe/Madrid"
    assert por_codigo["NYC"]["zona_horaria"] == "America/New_York"


def test_ciudades_uso_invalido_usa_el_formato_de_error_unico(client):
    resp = client.get("/ciudades", params={"uso": "marte"})
    assert resp.status_code == 422
    error = resp.json()["error"]
    assert error["code"] == "validacion"
    assert any(campo.endswith("uso") for campo in error["fields"])


# --------------------------------------------------------------------------- GET /vuelos
def test_busqueda_es_publica_y_tiene_la_forma_del_contrato(client, vuelos):
    resp = client.get("/vuelos")
    assert resp.status_code == 200
    cuerpo = resp.json()
    assert {"total", "pagina", "tamano", "items"} == set(cuerpo)
    assert cuerpo["total"] == len(cuerpo["items"]) == FUTUROS
    vuelo = cuerpo["items"][0]
    assert set(vuelo) == CAMPOS_VUELO
    assert set(vuelo["origen"]) == {"codigo", "nombre", "pais", "zona_horaria"}
    assert vuelo["salida_utc"].endswith("Z") and vuelo["llegada_utc"].endswith("Z")
    assert vuelo["codigo"].startswith("AT-")


def test_busqueda_sin_vuelos_responde_vacio(client):
    resp = client.get("/vuelos")
    assert resp.status_code == 200
    assert resp.json()["total"] == 0 and resp.json()["items"] == []


def test_busqueda_solo_trae_programados_con_salida_futura(client, db_session, vuelos):
    _agregar_vuelo(db_session, "BOG", "CLO", dias=15, estado=EstadoVuelo.CANCELADO)
    _agregar_vuelo(db_session, "BOG", "CLO", dias=-2)  # programado, pero su salida ya paso
    resp = client.get("/vuelos")
    assert resp.json()["total"] == FUTUROS
    assert "AT-0011" not in _codigos(resp)  # sucedido
    assert "AT-0021" not in _codigos(resp) and "AT-0022" not in _codigos(resp)
    assert all(v["estado"] == "programado" for v in resp.json()["items"])
    ahora = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    assert all(v["salida_utc"] > ahora for v in resp.json()["items"])


def test_busqueda_orden_por_defecto_es_salida_ascendente(client, vuelos):
    salidas = [v["salida_utc"] for v in client.get("/vuelos").json()["items"]]
    assert salidas == sorted(salidas)


@pytest.mark.parametrize(
    "orden, campo, descendente",
    [
        ("precio_asc", "costo", False),
        ("precio_desc", "costo", True),
        ("duracion_asc", "duracion_min", False),
        ("duracion_desc", "duracion_min", True),
    ],
)
def test_busqueda_ordena_por_precio_y_duracion(client, vuelos, orden, campo, descendente):
    valores = [v[campo] for v in client.get("/vuelos", params={"orden": orden}).json()["items"]]
    assert valores == sorted(valores, reverse=descendente)


def test_busqueda_combina_criterios(client, vuelos):
    ruta = client.get("/vuelos", params={"origen": "BOG", "destino": "MDE"})
    assert set(_codigos(ruta)) == {"AT-0001", "AT-0009"}

    ruta_y_precio = client.get("/vuelos", params={"origen": "BOG", "destino": "MDE", "precioMax": 200000})
    assert _codigos(ruta_y_precio) == ["AT-0001"]

    largos = client.get("/vuelos", params={"duracionMin": 500})
    assert set(_codigos(largos)) == {"AT-0003", "AT-0004", "AT-0017"}  # Madrid x2 y Londres

    rango_precio = client.get("/vuelos", params={"precioMin": 1_000_000, "precioMax": 1_500_000})
    assert set(_codigos(rango_precio)) == {"AT-0006", "AT-0019", "AT-0020"}


def test_busqueda_con_tres_criterios_a_la_vez(client, vuelos):
    resp = client.get(
        "/vuelos",
        params={"origen": "BOG", "precioMin": 150_000, "duracionMax": 70, "orden": "precio_desc"},
    )
    # Desde BOG, de 150 mil pesos en adelante y de 70 min o menos: AT-0009, AT-0001 y AT-0007.
    assert _codigos(resp) == ["AT-0009", "AT-0001", "AT-0007"]
    costos = [v["costo"] for v in resp.json()["items"]]
    assert costos == sorted(costos, reverse=True)


def test_busqueda_acepta_codigos_en_minuscula(client, vuelos):
    assert set(_codigos(client.get("/vuelos", params={"origen": "bog", "destino": "mde"}))) == {"AT-0001", "AT-0009"}


def test_busqueda_con_ciudad_inexistente_no_es_error(client, vuelos):
    resp = client.get("/vuelos", params={"origen": "XXX"})
    assert resp.status_code == 200 and resp.json()["total"] == 0


def test_busqueda_filtra_por_dia_en_hora_de_colombia(client, vuelos):
    # AT-0003 (Bogota -> Madrid) sale de madrugada en UTC: en Colombia cae el dia anterior.
    salida = datetime.fromisoformat(client.get("/vuelos/3").json()["salida_utc"].replace("Z", "+00:00"))
    dia_colombia = salida.astimezone(ZoneInfo("America/Bogota")).date()
    dia_utc = salida.date()
    assert dia_colombia != dia_utc

    assert "AT-0003" in _codigos(client.get("/vuelos", params={"fecha": dia_colombia.isoformat()}))
    assert "AT-0003" not in _codigos(client.get("/vuelos", params={"fecha": dia_utc.isoformat()}))


def test_busqueda_por_fecha_sin_vuelos(client, vuelos):
    resp = client.get("/vuelos", params={"fecha": "2031-01-01"})
    assert resp.status_code == 200 and resp.json()["total"] == 0


def test_busqueda_sin_resultados_no_es_un_error(client, vuelos):
    resp = client.get("/vuelos", params={"precioMax": 1})
    assert resp.status_code == 200
    assert resp.json()["total"] == 0 and resp.json()["items"] == []


def test_filtro_de_clase_no_oculta_vuelos_sin_cupo(client, vuelos):
    """D13: el filtro de clase solo destaca la disponibilidad; no excluye vuelos."""
    sin_filtro = client.get("/vuelos").json()
    con_clase = client.get("/vuelos", params={"clase": "economica"}).json()
    assert con_clase["total"] == sin_filtro["total"]
    sin_cupo = next(v for v in con_clase["items"] if v["codigo"] == "AT-0010")
    assert sin_cupo["cupos_economica"] == 0


def test_busqueda_cupos_por_tipo(client, vuelos):
    por_codigo = {v["codigo"]: v for v in client.get("/vuelos").json()["items"]}
    nacional, internacional = por_codigo["AT-0001"], por_codigo["AT-0003"]
    assert (nacional["tipo"], nacional["cupos_economica"], nacional["cupos_primera"]) == ("nacional", 125, 25)
    assert (internacional["tipo"], internacional["cupos_economica"], internacional["cupos_primera"]) == (
        "internacional", 200, 50)


def test_busqueda_llegada_es_salida_mas_duracion(client, vuelos):
    for v in client.get("/vuelos").json()["items"]:
        salida = datetime.fromisoformat(v["salida_utc"].replace("Z", "+00:00"))
        llegada = datetime.fromisoformat(v["llegada_utc"].replace("Z", "+00:00"))
        assert llegada - salida == timedelta(minutes=v["duracion_min"])


def test_busqueda_pagina_sin_repetir_ni_perder_vuelos(client, vuelos, monkeypatch):
    monkeypatch.setattr(service, "TAMANO_PAGINA", 5)
    paginas = [client.get("/vuelos", params={"pagina": n}).json() for n in (1, 2, 3, 4, 5)]
    assert [len(p["items"]) for p in paginas] == [5, 5, 5, 4, 0]
    assert all(p["total"] == FUTUROS and p["tamano"] == 5 for p in paginas)
    assert [p["pagina"] for p in paginas] == [1, 2, 3, 4, 5]
    codigos = [v["codigo"] for p in paginas for v in p["items"]]
    assert len(codigos) == len(set(codigos)) == FUTUROS

    # Con orden por precio la paginacion tambien es estable (los empates se desempatan).
    por_precio = [
        v["codigo"]
        for n in (1, 2, 3, 4)
        for v in client.get("/vuelos", params={"pagina": n, "orden": "precio_asc"}).json()["items"]
    ]
    assert len(por_precio) == len(set(por_precio)) == FUTUROS


@pytest.mark.parametrize(
    "params",
    [{"pagina": 0}, {"precioMin": -1}, {"orden": "al_azar"}, {"clase": "business"}, {"fecha": "2026-13-45"}],
)
def test_busqueda_con_parametros_invalidos_da_422(client, params):
    resp = client.get("/vuelos", params=params)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validacion"


# --------------------------------------------------------------------------- GET /vuelos/{id}
def test_detalle_publico_del_vuelo(client, vuelos):
    resp = client.get("/vuelos/3")
    assert resp.status_code == 200
    assert set(resp.json()) == CAMPOS_VUELO
    assert resp.json()["codigo"] == "AT-0003"
    assert resp.json()["origen"]["codigo"] == "BOG" and resp.json()["destino"]["codigo"] == "MAD"


def test_detalle_de_un_vuelo_que_ya_sucedio_se_puede_consultar(client, vuelos):
    resp = client.get("/vuelos/11")
    assert resp.status_code == 200 and resp.json()["estado"] == "sucedido"


@pytest.mark.parametrize("id_vuelo", [9999, 99999999999])
def test_detalle_de_un_vuelo_inexistente_da_404_con_formato_unico(client, vuelos, id_vuelo):
    resp = client.get(f"/vuelos/{id_vuelo}")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "vuelo_no_encontrado"


def test_detalle_con_id_no_numerico_da_422(client):
    assert client.get("/vuelos/abc").status_code == 422


# --------------------------------------------------------------------------- /admin/vuelos: roles
@pytest.mark.parametrize(
    "metodo, ruta",
    [("get", "/admin/vuelos"), ("get", "/admin/vuelos/1"), ("post", "/admin/vuelos")],
)
def test_admin_vuelos_sin_token_da_401(client, metodo, ruta):
    assert getattr(client, metodo)(ruta).status_code == 401


@pytest.mark.parametrize(
    "metodo, ruta",
    [("get", "/admin/vuelos"), ("get", "/admin/vuelos/1"), ("post", "/admin/vuelos")],
)
def test_admin_vuelos_con_cliente_da_403(client, token_cliente, metodo, ruta):
    resp = getattr(client, metodo)(ruta, headers=auth_headers(token_cliente))
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "permiso_denegado"


def test_admin_vuelos_con_root_da_403(client):
    settings = get_settings()
    token_root = login(client, settings.ROOT_ID, settings.ROOT_PASSWORD)
    assert client.get("/admin/vuelos", headers=auth_headers(token_root)).status_code == 403


def test_si_root_desactiva_el_modulo_el_administrador_pierde_el_acceso(client, token_admin):
    assert client.get("/admin/vuelos", headers=auth_headers(token_admin)).status_code == 200

    settings = get_settings()
    token_root = login(client, settings.ROOT_ID, settings.ROOT_PASSWORD)
    resp = client.put(
        "/root/roles",
        json={"roles": [{"id": "administrador", "modulos": {"administracion_vuelos": False}}]},
        headers=auth_headers(token_root),
    )
    assert resp.status_code == 200, resp.text

    bloqueada = client.get("/admin/vuelos", headers=auth_headers(token_admin))
    assert bloqueada.status_code == 403
    assert bloqueada.json()["error"]["code"] == "modulo_desactivado"


# --------------------------------------------------------------------------- /admin/vuelos: lectura
def test_admin_lista_todos_los_estados_el_mas_reciente_primero(client, token_admin, vuelos):
    resp = client.get("/admin/vuelos", headers=auth_headers(token_admin))
    assert resp.status_code == 200
    cuerpo = resp.json()
    assert cuerpo["total"] == 20 and len(cuerpo["items"]) == 20
    assert "sucedido" in {v["estado"] for v in cuerpo["items"]}
    salidas = [v["salida_utc"] for v in cuerpo["items"]]
    assert salidas == sorted(salidas, reverse=True)


def test_admin_filtra_por_estado_y_por_ciudad(client, db_session, token_admin, vuelos):
    cab = auth_headers(token_admin)
    _agregar_vuelo(db_session, "CLO", "BOG", dias=9, estado=EstadoVuelo.CANCELADO)

    sucedidos = client.get("/admin/vuelos", params={"estado": "sucedido"}, headers=cab)
    assert _codigos(sucedidos) == ["AT-0011"]
    cancelados = client.get("/admin/vuelos", params={"estado": "cancelado"}, headers=cab)
    assert _codigos(cancelados) == ["AT-0021"]

    desde_bogota = client.get("/admin/vuelos", params={"origen": "BOG"}, headers=cab).json()
    assert desde_bogota["total"] > 0
    assert all(v["origen"]["codigo"] == "BOG" for v in desde_bogota["items"])

    ruta = client.get("/admin/vuelos", params={"origen": "BOG", "destino": "MDE"}, headers=cab)
    assert set(_codigos(ruta)) == {"AT-0001", "AT-0009"}


def test_admin_pagina_la_lista(client, token_admin, vuelos, monkeypatch):
    monkeypatch.setattr(service, "TAMANO_PAGINA", 8)
    cab = auth_headers(token_admin)
    paginas = [client.get("/admin/vuelos", params={"pagina": n}, headers=cab).json() for n in (1, 2, 3)]
    assert [len(p["items"]) for p in paginas] == [8, 8, 4]
    assert len({v["codigo"] for p in paginas for v in p["items"]}) == 20


def test_admin_consulta_el_detalle_y_el_404(client, token_admin, vuelos):
    cab = auth_headers(token_admin)
    ok = client.get("/admin/vuelos/3", headers=cab)
    assert ok.status_code == 200 and set(ok.json()) == CAMPOS_VUELO
    no = client.get("/admin/vuelos/9999", headers=cab)
    assert no.status_code == 404 and no.json()["error"]["code"] == "vuelo_no_encontrado"


# --------------------------------------------------------------------------- POST /admin/vuelos (B2-05)
def _post(client, token, **cambios):
    return client.post("/admin/vuelos", json=_datos_programar(**cambios), headers=auth_headers(token))


def test_programar_vuelo_nacional_lo_guarda_con_lo_que_genera_el_sistema(client, token_admin):
    resp = _post(client, token_admin, hora="08:00", duracion=90)
    assert resp.status_code == 201, resp.text
    v = resp.json()
    assert set(v) == CAMPOS_VUELO
    assert v["id"] > 0 and v["codigo"] == f"AT-{v['id']:04d}"
    assert v["estado"] == "programado" and v["tipo"] == "nacional"
    assert (v["cupos_economica"], v["cupos_primera"]) == (125, 25)
    assert v["salida_utc"].endswith("T13:00:00Z")  # 08:00 en Colombia = 13:00 UTC
    salida = datetime.fromisoformat(v["salida_utc"].replace("Z", "+00:00"))
    llegada = datetime.fromisoformat(v["llegada_utc"].replace("Z", "+00:00"))
    assert llegada - salida == timedelta(minutes=90)
    assert v["origen"]["codigo"] == "BOG" and v["destino"]["codigo"] == "MDE"


def test_el_vuelo_programado_queda_guardado_y_se_puede_buscar(client, token_admin):
    creado = _post(client, token_admin).json()
    cab = auth_headers(token_admin)
    assert client.get(f"/admin/vuelos/{creado['id']}", headers=cab).json() == creado
    assert client.get(f"/vuelos/{creado['id']}").json() == creado
    assert creado["codigo"] in _codigos(client.get("/vuelos", params={"origen": "BOG", "destino": "MDE"}))
    assert creado["codigo"] in _codigos(client.get("/admin/vuelos", headers=cab))


def test_los_codigos_son_consecutivos_y_no_se_repiten(client, token_admin):
    primero = _post(client, token_admin).json()
    segundo = _post(client, token_admin, hora="09:30").json()
    assert segundo["id"] == primero["id"] + 1
    assert segundo["codigo"] != primero["codigo"]


def test_programar_registra_al_administrador_que_lo_programo(client, db_session, token_admin):
    from app.modules.usuarios.models import Usuario
    from app.modules.vuelos.models import Vuelo

    creado = _post(client, token_admin).json()
    admin = db_session.query(Usuario).filter_by(usuario="adminvuelos").one()
    assert db_session.get(Vuelo, creado["id"]).id_administrador == admin.id


@pytest.mark.parametrize(
    "origen, destino",
    [("BOG", "MAD"), ("MAD", "BOG"), ("PEI", "MIA"), ("NYC", "CTG"), ("clo", "bue"), ("MDE", "LON")],
)
def test_programar_internacional_acepta_ambos_sentidos(client, token_admin, origen, destino):
    resp = _post(client, token_admin, tipo="internacional", origen=origen, destino=destino, duracion=600)
    assert resp.status_code == 201, resp.text
    v = resp.json()
    assert v["tipo"] == "internacional"
    assert (v["cupos_economica"], v["cupos_primera"]) == (200, 50)
    assert v["destino"]["codigo"] == destino.upper()


def test_la_llegada_se_muestra_en_la_zona_horaria_del_destino(client, token_admin):
    v = _post(client, token_admin, tipo="internacional", destino="MAD", duracion=600).json()
    assert v["destino"]["zona_horaria"] == "Europe/Madrid"
    llegada = datetime.fromisoformat(v["llegada_utc"].replace("Z", "+00:00"))
    assert llegada.tzinfo is not None and llegada.utcoffset() == timedelta(0)


@pytest.mark.parametrize(
    "cambios, campos",
    [
        ({"destino": "BOG"}, {"destino"}),  # origen == destino
        ({"tipo": "nacional", "destino": "MAD"}, {"destino"}),  # nacional con exterior
        ({"tipo": "nacional", "origen": "MIA"}, {"origen"}),
        ({"tipo": "nacional", "origen": "NYC", "destino": "MAD"}, {"origen", "destino"}),
        ({"tipo": "internacional", "destino": "CLO"}, {"destino"}),  # dos del grupo colombia
        ({"tipo": "internacional", "origen": "MAD", "destino": "LON"}, {"destino"}),  # dos del exterior
        ({"tipo": "internacional", "origen": "BOG", "destino": "BAQ"}, {"destino"}),  # capital fuera del grupo
        ({"tipo": "internacional", "origen": "BAQ", "destino": "MAD"}, {"origen"}),
        ({"fecha": "2020-01-01"}, {"fecha"}),  # pasado
        ({"origen": "XXX", "destino": "YYY"}, {"origen", "destino"}),
        ({"duracion": 0, "costo": -5}, {"duracion", "costo"}),
        ({"hora": "25:99"}, {"hora"}),
    ],
)
def test_programar_con_datos_invalidos_da_422_con_el_campo_marcado(client, db_session, token_admin, cambios, campos):
    from app.modules.vuelos.models import Vuelo

    resp = _post(client, token_admin, **cambios)
    assert resp.status_code == 422, resp.text
    error = resp.json()["error"]
    assert error["code"] == "validacion"
    assert campos <= set(error["fields"])
    assert db_session.query(Vuelo).count() == 0  # no se guarda nada


def test_programar_para_hoy_con_hora_ya_pasada_es_invalido(client, token_admin):
    ahora_colombia = datetime.now(ZoneInfo("America/Bogota"))
    hace_un_rato = ahora_colombia - timedelta(hours=1)
    resp = _post(client, token_admin, fecha=hace_un_rato.date().isoformat(), hora=hace_un_rato.strftime("%H:%M"))
    assert resp.status_code == 422
    assert "fecha" in resp.json()["error"]["fields"]


def test_validar_programacion_reune_todos_los_errores_a_la_vez(client, db_session):
    from app.modules.vuelos.schemas import VueloCrear

    datos = VueloCrear(
        tipo="nacional", origen="BOG", destino="BOG", fecha="2020-01-01", hora="08:00", duracion=60, costo=1000
    )
    bogota = service.obtener_ciudad(db_session, "BOG")
    errores = service.validar_programacion(datos, bogota, bogota)
    assert set(errores) == {"fecha", "destino"}


def test_el_punto_de_extension_de_noticias_se_ejecuta_al_programar(client, token_admin, monkeypatch):
    llamados = []
    monkeypatch.setattr(service, "ALPROGRAMAR_VUELO", [lambda db, vuelo: llamados.append(vuelo.codigo)])
    creado = _post(client, token_admin).json()
    assert llamados == [creado["codigo"]]


# --------------------------------------------------------------------------- OpenAPI
def test_openapi_publica_las_rutas_del_contrato(client):
    rutas = client.get("/openapi.json").json()["paths"]
    for ruta in ("/ciudades", "/vuelos", "/vuelos/{id}", "/admin/vuelos", "/admin/vuelos/{id}"):
        assert ruta in rutas, ruta
    assert {"get", "post"} == set(rutas["/admin/vuelos"])
    # Las rutas de administrador muestran el candado "Authorize" en /docs.
    assert rutas["/admin/vuelos"]["get"]["security"]
