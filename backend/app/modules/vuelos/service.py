"""
Logica de vuelos compartida (B2-02, B2-06 a B2-09).

* Escritura: `crear_vuelo` (lo usan los seeds y, en B2-05, la programacion de vuelos, donde se
  agregan las validaciones de HU18 con errores por campo).
* Lectura: catalogo de ciudades, busqueda publica de vuelos y panel del administrador.

Los routers solo traducen HTTP; las consultas viven aqui para poder probarlas y reutilizarlas.
"""
import logging
from collections.abc import Callable
from datetime import date, datetime, time, timedelta, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.vuelos.models import (
    CUPOS_POR_TIPO,
    Busqueda,
    Ciudad,
    EstadoVuelo,
    GrupoInternacional,
    TipoVuelo,
    Vuelo,
    codigo_para,
)
from app.core.errors import AppError
from app.modules.vuelos.schemas import OrdenVuelos, UsoCiudad, VueloCrear

logger = logging.getLogger("aerotiquetes.busqueda")

TAMANO_PAGINA = 50  # El front aun no pagina (lee solo `items`); si crece, se acuerda con F2.
TZ_COLOMBIA = ZoneInfo("America/Bogota")


# ---------------------------------------------------------------------------
# Escritura
# ---------------------------------------------------------------------------
def tipo_entre(origen: Ciudad, destino: Ciudad) -> TipoVuelo:
    """Internacional si alguno de los extremos es del grupo `exterior`; si no, nacional."""
    exterior = GrupoInternacional.EXTERIOR in (origen.grupo_internacional, destino.grupo_internacional)
    return TipoVuelo.INTERNACIONAL if exterior else TipoVuelo.NACIONAL


def crear_vuelo(
    db: Session,
    *,
    origen: Ciudad,
    destino: Ciudad,
    tipo: TipoVuelo,
    salida_utc: datetime,
    duracion_min: int,
    costo: int,
    estado: EstadoVuelo = EstadoVuelo.PROGRAMADO,
    id_administrador: int | None = None,
    cupos_economica: int | None = None,
    cupos_primera: int | None = None,
) -> Vuelo:
    """Inserta un vuelo generando lo que genera el sistema: codigo consecutivo, llegada
    (salida + duracion, D15) y cupos por tipo (D4). NO valida reglas de negocio (ver B2-05).

    El codigo sale del `id`: se inserta con un codigo temporal, se hace `flush` para obtener el
    id y luego se fija `AT-####`. Como el id lo asigna la base de datos, dos administradores que
    programen a la vez nunca obtienen el mismo codigo (un insert fallido puede dejar un hueco en
    la numeracion). No hace `commit`: lo hace quien llama.
    """
    economica, primera = CUPOS_POR_TIPO[tipo]
    vuelo = Vuelo(
        codigo=f"TMP-{uuid4().hex[:12]}",
        origen=origen,
        destino=destino,
        tipo=tipo,
        salida_utc=salida_utc,
        duracion_min=duracion_min,
        llegada_utc=salida_utc + timedelta(minutes=duracion_min),
        costo=costo,
        estado=estado,
        cupos_economica=economica if cupos_economica is None else cupos_economica,
        cupos_primera=primera if cupos_primera is None else cupos_primera,
        id_administrador=id_administrador,
    )
    db.add(vuelo)
    db.flush()
    vuelo.codigo = codigo_para(vuelo.id)
    db.flush()
    return vuelo


# ---------------------------------------------------------------------------
# Programar vuelo (B2-05, HU18)
# ---------------------------------------------------------------------------
# Punto de extension (D19): funciones `f(db, vuelo)` que se ejecutan al programar un vuelo, dentro de
# la misma transaccion. Hoy esta vacio; en las Iteraciones 2 y 4 se registra aqui la publicacion de
# noticias (`ALPROGRAMAR_VUELO.append(publicar_noticia)`).
ALPROGRAMAR_VUELO: list[Callable] = []


def validar_programacion(
    datos: VueloCrear,
    origen: Ciudad | None,
    destino: Ciudad | None,
    *,
    ahora: datetime | None = None,
) -> dict[str, str]:
    """Reglas de HU18 y D5. Devuelve {campo: mensaje} (vacio si todo es valido).

    La forma de los datos (duracion > 0, costo > 0, hora HH:MM...) ya la valida Pydantic.
    """
    ahora = ahora or datetime.now(timezone.utc)
    errores: dict[str, str] = {}

    if origen is None:
        errores["origen"] = "La ciudad de origen no existe."
    if destino is None:
        errores["destino"] = "La ciudad de destino no existe."

    salida_utc = datetime.combine(datos.fecha, datos.hora, tzinfo=TZ_COLOMBIA).astimezone(timezone.utc)
    if salida_utc <= ahora:
        errores["fecha"] = "La fecha y la hora de salida deben ser futuras."

    if origen is not None and destino is not None:
        if origen.id == destino.id:
            errores["destino"] = "El destino debe ser distinto del origen."
        elif datos.tipo == TipoVuelo.NACIONAL:
            if not origen.es_capital_departamento:
                errores["origen"] = "En un vuelo nacional el origen debe ser una capital de departamento."
            if not destino.es_capital_departamento:
                errores["destino"] = "En un vuelo nacional el destino debe ser una capital de departamento."
        else:
            grupos = {origen.grupo_internacional, destino.grupo_internacional}
            if origen.grupo_internacional is None:
                errores["origen"] = "El origen no esta habilitado para vuelos internacionales."
            if destino.grupo_internacional is None:
                errores["destino"] = "El destino no esta habilitado para vuelos internacionales."
            if not errores.keys() & {"origen", "destino"} and grupos != {
                GrupoInternacional.COLOMBIA,
                GrupoInternacional.EXTERIOR,
            }:
                errores["destino"] = (
                    "Un vuelo internacional conecta una ciudad de Colombia con una del exterior."
                )
    return errores


def programar_vuelo(
    db: Session, datos: VueloCrear, id_administrador: int, *, ahora: datetime | None = None
) -> Vuelo:
    """Valida y guarda un vuelo programado (HU18). 422 `validacion` con `fields` si algo no cumple.

    El tipo no se deduce de las ciudades: lo elige el administrador y se verifica contra ellas.
    """
    origen = obtener_ciudad(db, datos.origen)
    destino = obtener_ciudad(db, datos.destino)
    errores = validar_programacion(datos, origen, destino, ahora=ahora)
    if errores:
        raise AppError(
            "Los datos enviados no son validos.",
            status_code=422,
            code="validacion",
            fields=errores,
        )
    salida_utc = datetime.combine(datos.fecha, datos.hora, tzinfo=TZ_COLOMBIA).astimezone(timezone.utc)
    vuelo = crear_vuelo(
        db,
        origen=origen,
        destino=destino,
        tipo=datos.tipo,
        salida_utc=salida_utc,
        duracion_min=datos.duracion,
        costo=datos.costo,
        id_administrador=id_administrador,
    )
    for gancho in ALPROGRAMAR_VUELO:
        gancho(db, vuelo)
    db.commit()
    db.refresh(vuelo)
    return vuelo


# ---------------------------------------------------------------------------
# Lectura
# ---------------------------------------------------------------------------
def listar_ciudades(db: Session, uso: UsoCiudad | None = None) -> list[Ciudad]:
    """Catalogo para los selects (B2-07). Orden alfabetico.

    - `nacional`: las capitales de departamento.
    - `internacional`: las ciudades con `grupo_internacional` (colombia o exterior).
    - sin `uso`: todas.
    """
    consulta = select(Ciudad).order_by(Ciudad.nombre, Ciudad.id)
    if uso == UsoCiudad.NACIONAL:
        consulta = consulta.where(Ciudad.es_capital_departamento.is_(True))
    elif uso == UsoCiudad.INTERNACIONAL:
        consulta = consulta.where(Ciudad.grupo_internacional.is_not(None))
    return list(db.scalars(consulta))


def obtener_ciudad(db: Session, codigo: str) -> Ciudad | None:
    """Ciudad por su codigo (insensible a mayusculas). None si no existe."""
    return db.scalar(select(Ciudad).where(Ciudad.codigo == codigo.strip().upper()))


def _ids_de_ciudad(codigo: str):
    """Subconsulta con el id de la ciudad de ese codigo (si no existe, no habra resultados)."""
    return select(Ciudad.id).where(Ciudad.codigo == codigo.strip().upper())


def _rango_del_dia(dia: date) -> tuple[datetime, datetime]:
    """Instantes UTC [inicio, fin) del `dia` completo en hora de Colombia (sin horario de verano)."""
    inicio = datetime.combine(dia, time.min, tzinfo=TZ_COLOMBIA).astimezone(timezone.utc)
    return inicio, inicio + timedelta(days=1)


_ORDEN_BUSQUEDA = {
    OrdenVuelos.FECHA_ASC: (Vuelo.salida_utc.asc(),),
    OrdenVuelos.PRECIO_ASC: (Vuelo.costo.asc(), Vuelo.salida_utc.asc()),
    OrdenVuelos.PRECIO_DESC: (Vuelo.costo.desc(), Vuelo.salida_utc.asc()),
    OrdenVuelos.DURACION_ASC: (Vuelo.duracion_min.asc(), Vuelo.salida_utc.asc()),
    OrdenVuelos.DURACION_DESC: (Vuelo.duracion_min.desc(), Vuelo.salida_utc.asc()),
}


def _pagina(db: Session, condiciones: list, orden: tuple, pagina: int) -> tuple[int, list[Vuelo]]:
    total = db.scalar(select(func.count()).select_from(Vuelo).where(*condiciones)) or 0
    consulta = (
        select(Vuelo)
        .where(*condiciones)
        .order_by(*orden, Vuelo.id)  # `id` desempata: la paginacion es estable
        .limit(TAMANO_PAGINA)
        .offset((pagina - 1) * TAMANO_PAGINA)
    )
    return total, list(db.scalars(consulta).unique())


def buscar_vuelos(
    db: Session,
    *,
    origen: str | None = None,
    destino: str | None = None,
    fecha: date | None = None,
    precio_min: int | None = None,
    precio_max: int | None = None,
    duracion_min: int | None = None,
    duracion_max: int | None = None,
    orden: OrdenVuelos = OrdenVuelos.FECHA_ASC,
    pagina: int = 1,
    ahora: datetime | None = None,
) -> tuple[int, list[Vuelo]]:
    """Busqueda publica (B2-08, HU5): criterios opcionales y combinables. Devuelve (total, pagina).

    Solo vuelos `programado` con salida futura (D16), SIN ocultar los que no tienen cupo (D13); por
    eso aqui no hay filtro de clase: la clase solo sirve para que la pantalla destaque la
    disponibilidad. `fecha` es el dia completo en hora de Colombia.
    """
    ahora = ahora or datetime.now(timezone.utc)
    condiciones = [Vuelo.estado == EstadoVuelo.PROGRAMADO, Vuelo.salida_utc > ahora]

    if origen:
        condiciones.append(Vuelo.id_origen.in_(_ids_de_ciudad(origen)))
    if destino:
        condiciones.append(Vuelo.id_destino.in_(_ids_de_ciudad(destino)))
    if fecha is not None:
        inicio, fin = _rango_del_dia(fecha)
        condiciones += [Vuelo.salida_utc >= inicio, Vuelo.salida_utc < fin]
    if precio_min is not None:
        condiciones.append(Vuelo.costo >= precio_min)
    if precio_max is not None:
        condiciones.append(Vuelo.costo <= precio_max)
    if duracion_min is not None:
        condiciones.append(Vuelo.duracion_min >= duracion_min)
    if duracion_max is not None:
        condiciones.append(Vuelo.duracion_min <= duracion_max)

    return _pagina(db, condiciones, _ORDEN_BUSQUEDA[orden], pagina)


def listar_vuelos_admin(
    db: Session,
    *,
    estado: EstadoVuelo | None = None,
    origen: str | None = None,
    destino: str | None = None,
    pagina: int = 1,
) -> tuple[int, list[Vuelo]]:
    """Panel del administrador (B2-06, HU19): todos los estados, el de salida mas reciente primero."""
    condiciones = []
    if estado is not None:
        condiciones.append(Vuelo.estado == estado)
    if origen:
        condiciones.append(Vuelo.id_origen.in_(_ids_de_ciudad(origen)))
    if destino:
        condiciones.append(Vuelo.id_destino.in_(_ids_de_ciudad(destino)))
    return _pagina(db, condiciones, (Vuelo.salida_utc.desc(),), pagina)


def consultar_vuelo(db: Session, id_vuelo: int) -> Vuelo | None:
    """Un vuelo por id (B2-09 publico y HU19 del administrador), en cualquier estado. None si no existe."""
    return db.get(Vuelo, id_vuelo)


# ---------------------------------------------------------------------------
# Historial de busquedas (B2-11)
# ---------------------------------------------------------------------------
def registrar_busqueda(
    db: Session, id_cliente: int, *, origen: str | None, destino: str | None, fecha: date | None
) -> Busqueda | None:
    """Guarda lo que busco un cliente autenticado. Devuelve None si no habia nada que guardar.

    Se guarda cuando hay al menos un criterio de ruta o fecha (origen, destino o fecha); el listado
    "libre" y los filtros de precio/duracion no aportan a las recomendaciones. Un codigo de ciudad
    que no existe se guarda como NULL. Nunca debe romper la busqueda: si falla, se registra el error
    y se sigue.
    """
    ciudad_origen = obtener_ciudad(db, origen) if origen else None
    ciudad_destino = obtener_ciudad(db, destino) if destino else None
    if ciudad_origen is None and ciudad_destino is None and fecha is None:
        return None
    try:
        registro = Busqueda(
            id_cliente=id_cliente,
            id_origen=ciudad_origen.id if ciudad_origen else None,
            id_destino=ciudad_destino.id if ciudad_destino else None,
            fecha_salida=fecha,
        )
        db.add(registro)
        db.commit()
        return registro
    except Exception:  # el historial es secundario: la busqueda no debe fallar por esto
        db.rollback()
        logger.exception("No se pudo guardar el historial de busqueda del cliente %s", id_cliente)
        return None
