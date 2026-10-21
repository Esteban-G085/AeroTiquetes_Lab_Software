"""Seeds de Ciudades y Vuelos (B2-04)."""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select

from app.modules.vuelos.models import Ciudad, EstadoVuelo, GrupoInternacional, TipoVuelo, Vuelo
from app.modules.vuelos.seeds import asegurar_ciudades, sembrar_vuelos_ejemplo

AHORA = datetime(2026, 10, 20, 15, 0, tzinfo=timezone.utc)


def _contar(db, modelo):
    return db.scalar(select(func.count()).select_from(modelo))


# ---------------------------------------------------------------- ciudades
def test_catalogo_tiene_32_capitales_y_5_del_exterior(db_session):
    assert asegurar_ciudades(db_session) == 37
    ciudades = list(db_session.scalars(select(Ciudad)))
    assert sum(c.es_capital_departamento for c in ciudades) == 32
    exterior = {c.codigo for c in ciudades if c.grupo_internacional == GrupoInternacional.EXTERIOR}
    assert exterior == {"MAD", "LON", "NYC", "BUE", "MIA"}
    colombia = {c.codigo for c in ciudades if c.grupo_internacional == GrupoInternacional.COLOMBIA}
    assert colombia == {"PEI", "BOG", "MDE", "CLO", "CTG"}
    assert all(c.es_capital_departamento is False for c in ciudades if c.codigo in exterior)


def test_cada_ciudad_tiene_codigo_valido_y_zona_horaria_real(db_session):
    asegurar_ciudades(db_session)
    ciudades = list(db_session.scalars(select(Ciudad)))
    codigos = [c.codigo for c in ciudades]
    assert len(set(codigos)) == len(codigos)
    for c in ciudades:
        assert len(c.codigo) == 3 and c.codigo.isupper() and c.codigo.isalpha(), c.codigo
        ZoneInfo(c.zona_horaria)  # lanza ZoneInfoNotFoundError si la zona no existe


def test_asegurar_ciudades_es_idempotente_y_completa_las_que_falten(db_session):
    assert asegurar_ciudades(db_session) == 37
    assert asegurar_ciudades(db_session) == 0
    db_session.delete(db_session.scalar(select(Ciudad).where(Ciudad.codigo == "MAD")))
    db_session.commit()
    assert asegurar_ciudades(db_session) == 1
    assert _contar(db_session, Ciudad) == 37


def test_la_aplicacion_siembra_el_catalogo_al_arrancar(client, db_session):
    """`client` abre la app (lifespan): el catalogo ya debe estar, junto al root y la matriz de roles."""
    assert _contar(db_session, Ciudad) == 37
    assert client.get("/health").status_code in (200, 404)  # la app esta viva


# ---------------------------------------------------------------- vuelos de ejemplo
def test_siembra_20_vuelos_con_codigos_consecutivos(db_session):
    assert sembrar_vuelos_ejemplo(db_session, ahora=AHORA) == 20
    codigos = [v.codigo for v in db_session.scalars(select(Vuelo).order_by(Vuelo.id))]
    assert codigos == [f"AT-{n:04d}" for n in range(1, 21)]


def test_sembrar_vuelos_es_idempotente(db_session):
    assert sembrar_vuelos_ejemplo(db_session, ahora=AHORA) == 20
    assert sembrar_vuelos_ejemplo(db_session, ahora=AHORA) == 0
    assert _contar(db_session, Vuelo) == 20


def test_los_vuelos_cumplen_las_reglas_de_ciudades_de_d5(db_session):
    sembrar_vuelos_ejemplo(db_session, ahora=AHORA)
    for v in db_session.scalars(select(Vuelo)):
        o, d = v.origen, v.destino
        assert o.codigo != d.codigo
        if v.tipo == TipoVuelo.NACIONAL:
            assert o.es_capital_departamento and d.es_capital_departamento, v.codigo
        else:  # una ciudad de cada grupo, en cualquier sentido
            assert {o.grupo_internacional, d.grupo_internacional} == {
                GrupoInternacional.COLOMBIA, GrupoInternacional.EXTERIOR,
            }, v.codigo


def test_llegada_cupos_y_costo_de_cada_vuelo(db_session):
    sembrar_vuelos_ejemplo(db_session, ahora=AHORA)
    for v in db_session.scalars(select(Vuelo)):
        assert v.llegada_utc - v.salida_utc == timedelta(minutes=v.duracion_min)
        assert v.costo > 0 and v.duracion_min > 0
        if v.codigo != "AT-0010":  # el unico sin cupo en economica
            esperado = (125, 25) if v.tipo == TipoVuelo.NACIONAL else (200, 50)
            assert (v.cupos_economica, v.cupos_primera) == esperado, v.codigo


def test_hay_casos_para_probar_d13_y_d16(db_session):
    sembrar_vuelos_ejemplo(db_session, ahora=AHORA)
    sin_cupo = db_session.scalar(select(Vuelo).where(Vuelo.codigo == "AT-0010"))
    assert sin_cupo.cupos_economica == 0 and sin_cupo.estado == EstadoVuelo.PROGRAMADO  # D13
    pasado = db_session.scalar(select(Vuelo).where(Vuelo.codigo == "AT-0011"))
    assert pasado.estado == EstadoVuelo.SUCEDIDO and pasado.salida_utc < AHORA  # D16
    futuros = [v for v in db_session.scalars(select(Vuelo)) if v.salida_utc > AHORA]
    assert len(futuros) == 19


def test_hay_mezcla_de_nacionales_e_internacionales(db_session):
    sembrar_vuelos_ejemplo(db_session, ahora=AHORA)
    tipos = [v.tipo for v in db_session.scalars(select(Vuelo))]
    assert tipos.count(TipoVuelo.NACIONAL) >= 8 and tipos.count(TipoVuelo.INTERNACIONAL) >= 8


def test_los_vuelos_de_ejemplo_no_tienen_administrador(db_session):
    sembrar_vuelos_ejemplo(db_session, ahora=AHORA)
    assert all(v.id_administrador is None for v in db_session.scalars(select(Vuelo)))


def test_sembrar_vuelos_crea_el_catalogo_si_falta(db_session):
    assert _contar(db_session, Ciudad) == 0
    sembrar_vuelos_ejemplo(db_session, ahora=AHORA)
    assert _contar(db_session, Ciudad) == 37


def test_sin_ahora_las_fechas_son_relativas_a_hoy(db_session):
    sembrar_vuelos_ejemplo(db_session)
    primero = db_session.scalar(select(Vuelo).where(Vuelo.codigo == "AT-0001"))
    dias = (primero.salida_utc - datetime.now(timezone.utc)).days
    assert 9 <= dias <= 10
