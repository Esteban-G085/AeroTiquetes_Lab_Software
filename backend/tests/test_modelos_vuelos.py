"""Modelos de Ciudad y Vuelo (B2-02): restricciones, codigo consecutivo y fechas en UTC."""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.tipos import FechaUTC
from app.modules.vuelos.models import (
    Ciudad,
    EstadoVuelo,
    GrupoInternacional,
    TipoVuelo,
    Vuelo,
    codigo_para,
)
from app.modules.vuelos.service import crear_vuelo, tipo_entre

SALIDA = datetime(2030, 1, 15, 13, 0, tzinfo=timezone.utc)


@pytest.fixture()
def ciudades(db_session):
    datos = [
        ("BOG", "Bogotá", "Colombia", "America/Bogota", True, GrupoInternacional.COLOMBIA),
        ("MDE", "Medellín", "Colombia", "America/Bogota", True, GrupoInternacional.COLOMBIA),
        ("MZL", "Manizales", "Colombia", "America/Bogota", True, None),
        ("MAD", "Madrid", "España", "Europe/Madrid", False, GrupoInternacional.EXTERIOR),
    ]
    filas = [
        Ciudad(codigo=c, nombre=n, pais=p, zona_horaria=z, es_capital_departamento=cap, grupo_internacional=g)
        for c, n, p, z, cap, g in datos
    ]
    db_session.add_all(filas)
    db_session.commit()
    return {c.codigo: c for c in filas}


def _nacional(db, ciudades, **cambios):
    datos = dict(
        origen=ciudades["BOG"], destino=ciudades["MDE"], tipo=TipoVuelo.NACIONAL,
        salida_utc=SALIDA, duracion_min=65, costo=300_000,
    )
    datos.update(cambios)
    return crear_vuelo(db, **datos)


# ---------------------------------------------------------------- crear_vuelo
def test_codigo_consecutivo_con_prefijo_at(db_session, ciudades):
    primero = _nacional(db_session, ciudades)
    segundo = _nacional(db_session, ciudades)
    db_session.commit()
    assert (primero.codigo, segundo.codigo) == ("AT-0001", "AT-0002")
    assert codigo_para(12) == "AT-0012" and codigo_para(12345) == "AT-12345"


def test_llegada_estado_y_cupos_los_genera_el_sistema(db_session, ciudades):
    v = _nacional(db_session, ciudades, duracion_min=90)
    db_session.commit()
    db_session.refresh(v)
    assert v.llegada_utc - v.salida_utc == timedelta(minutes=90)
    assert v.estado == EstadoVuelo.PROGRAMADO
    assert (v.cupos_economica, v.cupos_primera) == (125, 25)  # nacional: 150 (D4)
    assert v.fecha_programacion is not None and v.id_administrador is None


def test_cupos_internacional_son_250(db_session, ciudades):
    v = crear_vuelo(
        db_session, origen=ciudades["BOG"], destino=ciudades["MAD"], tipo=TipoVuelo.INTERNACIONAL,
        salida_utc=SALIDA, duracion_min=600, costo=2_450_000,
    )
    assert (v.cupos_economica, v.cupos_primera) == (200, 50)


def test_cupos_se_pueden_fijar_a_mano_incluido_cero(db_session, ciudades):
    v = _nacional(db_session, ciudades, cupos_economica=0)
    assert (v.cupos_economica, v.cupos_primera) == (0, 25)


def test_tipo_entre_sigue_los_grupos_de_d5(ciudades):
    assert tipo_entre(ciudades["BOG"], ciudades["MDE"]) == TipoVuelo.NACIONAL
    assert tipo_entre(ciudades["BOG"], ciudades["MZL"]) == TipoVuelo.NACIONAL
    assert tipo_entre(ciudades["BOG"], ciudades["MAD"]) == TipoVuelo.INTERNACIONAL
    assert tipo_entre(ciudades["MAD"], ciudades["BOG"]) == TipoVuelo.INTERNACIONAL  # ambos sentidos


def test_relaciones_origen_y_destino(db_session, ciudades):
    v = _nacional(db_session, ciudades)
    db_session.commit()
    leido = db_session.scalar(select(Vuelo).where(Vuelo.codigo == v.codigo))
    assert (leido.origen.codigo, leido.destino.codigo) == ("BOG", "MDE")
    assert leido.origen.zona_horaria == "America/Bogota"


# ---------------------------------------------------------------- fechas en UTC
def test_las_fechas_se_leen_siempre_con_zona_utc(db_session, ciudades):
    v = _nacional(db_session, ciudades)
    db_session.commit()
    db_session.expire_all()
    leido = db_session.get(Vuelo, v.id)
    assert leido.salida_utc.tzinfo is not None
    assert leido.salida_utc == SALIDA
    assert leido.fecha_programacion.tzinfo is not None
    # Se puede comparar con "ahora" sin TypeError (en SQLite las fechas suelen volver sin zona).
    assert leido.salida_utc > datetime.now(timezone.utc)


def test_una_hora_con_otra_zona_se_guarda_convertida_a_utc(db_session, ciudades):
    colombia = timezone(timedelta(hours=-5))
    v = _nacional(db_session, ciudades, salida_utc=datetime(2030, 1, 15, 8, 0, tzinfo=colombia))
    db_session.commit()
    db_session.expire_all()
    assert db_session.get(Vuelo, v.id).salida_utc == datetime(2030, 1, 15, 13, 0, tzinfo=timezone.utc)


def test_fecha_sin_zona_horaria_se_rechaza():
    with pytest.raises(ValueError, match="zona horaria"):
        FechaUTC().process_bind_param(datetime(2030, 1, 15, 8, 0), dialect=None)
    assert FechaUTC().process_bind_param(None, dialect=None) is None
    assert FechaUTC().process_result_value(None, dialect=None) is None


# ---------------------------------------------------------------- restricciones de la base de datos
def test_origen_y_destino_deben_ser_distintos(db_session, ciudades):
    with pytest.raises(IntegrityError):
        _nacional(db_session, ciudades, destino=ciudades["BOG"])
    db_session.rollback()


@pytest.mark.parametrize(
    "cambios",
    [{"duracion_min": 0}, {"duracion_min": -10}, {"costo": 0}, {"costo": -1}, {"cupos_primera": -1}, {"cupos_economica": -1}],
)
def test_duracion_costo_y_cupos_invalidos_se_rechazan(db_session, ciudades, cambios):
    with pytest.raises(IntegrityError):
        _nacional(db_session, ciudades, **cambios)
    db_session.rollback()


def test_el_codigo_de_vuelo_es_unico(db_session, ciudades):
    v = _nacional(db_session, ciudades)
    db_session.commit()
    otro = Vuelo(
        codigo=v.codigo, id_origen=ciudades["BOG"].id, id_destino=ciudades["MDE"].id, tipo=TipoVuelo.NACIONAL,
        salida_utc=SALIDA, duracion_min=60, llegada_utc=SALIDA + timedelta(minutes=60), costo=1,
        estado=EstadoVuelo.PROGRAMADO, cupos_primera=1, cupos_economica=1,
    )
    db_session.add(otro)
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()


def test_el_codigo_de_ciudad_es_unico(db_session, ciudades):
    db_session.add(Ciudad(codigo="BOG", nombre="Otra", pais="X", zona_horaria="UTC"))
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()


def test_ciudad_por_defecto_no_es_capital_ni_tiene_grupo(db_session):
    c = Ciudad(codigo="ZZZ", nombre="Prueba", pais="X", zona_horaria="UTC")
    db_session.add(c)
    db_session.commit()
    assert c.es_capital_departamento is False and c.grupo_internacional is None


def test_eliminar_un_administrador_no_borra_sus_vuelos():
    """La FK es ON DELETE SET NULL (HU23 permite eliminar administradores)."""
    (fk,) = Vuelo.__table__.c.id_administrador.foreign_keys
    assert fk.ondelete == "SET NULL"
    assert fk.column.table.name == "administrador"
    assert Vuelo.__table__.c.id_administrador.nullable is True


def test_hay_indices_para_la_busqueda():
    """RNF01: indices en origen, destino y fecha de salida."""
    indexadas = {c.name for i in Vuelo.__table__.indexes for c in i.columns}
    assert {"id_origen", "id_destino", "salida_utc"} <= indexadas
