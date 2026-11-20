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

from sqlalchemy import func, select, update as sa_update
from sqlalchemy.orm import Session

from app.modules.vuelos.models import (
    Asiento,
    CUPOS_POR_TIPO,
    Busqueda,
    Ciudad,
    ClaseAsiento,
    EstadoAsiento,
    EstadoVuelo,
    GrupoInternacional,
    TipoVuelo,
    Vuelo,
    codigo_para,
)
from app.core.errors import AppError
from app.modules.vuelos.schemas import ClaseVuelo, OrdenVuelos, UsoCiudad, VueloCrear, VueloEditar

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
    costo_primera: int | None = None,
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
        costo_primera=costo_primera if costo_primera is not None else costo,
        estado=estado,
        cupos_economica=economica if cupos_economica is None else cupos_economica,
        cupos_primera=primera if cupos_primera is None else cupos_primera,
        id_administrador=id_administrador,
    )
    db.add(vuelo)
    db.flush()
    vuelo.codigo = codigo_para(vuelo.id)
    db.flush()
    generar_asientos(db, vuelo)
    return vuelo


# ---------------------------------------------------------------------------
# Programar vuelo (B2-05, HU18)
# ---------------------------------------------------------------------------
# Punto de extension (D19): funciones `f(db, vuelo)` que se ejecutan al programar un vuelo, dentro de
# la misma transaccion. Hoy esta vacio; en las Iteraciones 2 y 4 se registra aqui la publicacion de
# noticias (`ALPROGRAMAR_VUELO.append(publicar_noticia)`).
ALPROGRAMAR_VUELO: list[Callable] = []

# Segundo punto de extension: funciones `f(id_vuelo)` que corren DESPUES de guardar el vuelo y de responder
# (en segundo plano), con su propia sesion. Sirven para lo lento o que no debe tumbar la programacion,
# como enviar correos (las noticias se avisan a los suscriptores por aqui).
TRAS_PROGRAMAR_VUELO: list[Callable[[int], None]] = []


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
        costo_primera=datos.costo_primera,
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
    - sin `uso`: todas las de vuelos (excluye las ciudades solo de facturacion).
    """
    consulta = select(Ciudad).where(Ciudad.solo_facturacion.is_(False)).order_by(Ciudad.nombre, Ciudad.id)
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


def _columna_precio(clase: ClaseVuelo | None):
    """Tarifa cobrada: `costo_primera` para primera, `costo` (económica) en los demás casos."""
    return Vuelo.costo_primera if clase == ClaseVuelo.PRIMERA else Vuelo.costo


def _orden_busqueda(orden: OrdenVuelos, clase: ClaseVuelo | None) -> tuple:
    precio = _columna_precio(clase)
    return {
        OrdenVuelos.FECHA_ASC: (Vuelo.salida_utc.asc(),),
        OrdenVuelos.PRECIO_ASC: (precio.asc(), Vuelo.salida_utc.asc()),
        OrdenVuelos.PRECIO_DESC: (precio.desc(), Vuelo.salida_utc.asc()),
        OrdenVuelos.DURACION_ASC: (Vuelo.duracion_min.asc(), Vuelo.salida_utc.asc()),
        OrdenVuelos.DURACION_DESC: (Vuelo.duracion_min.desc(), Vuelo.salida_utc.asc()),
    }[orden]


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
    clase: ClaseVuelo | None = None,
    orden: OrdenVuelos = OrdenVuelos.FECHA_ASC,
    pagina: int = 1,
    ahora: datetime | None = None,
) -> tuple[int, list[Vuelo]]:
    """Busqueda publica (B2-08, HU5): criterios opcionales y combinables. Devuelve (total, pagina).

    Solo vuelos `programado` con salida futura (D16), SIN ocultar los que no tienen cupo (D13):
    `clase` NO filtra vuelos, selecciona la tarifa cobrada (`costo_primera` o `costo`) usada por
    los filtros de precio, el orden por precio y el campo `precio_efectivo` de la respuesta.
    `fecha` es el dia completo en hora de Colombia.
    """
    ahora = ahora or datetime.now(timezone.utc)
    condiciones = [Vuelo.estado == EstadoVuelo.PROGRAMADO, Vuelo.salida_utc > ahora]
    precio = _columna_precio(clase)

    if origen:
        condiciones.append(Vuelo.id_origen.in_(_ids_de_ciudad(origen)))
    if destino:
        condiciones.append(Vuelo.id_destino.in_(_ids_de_ciudad(destino)))
    if fecha is not None:
        inicio, fin = _rango_del_dia(fecha)
        condiciones += [Vuelo.salida_utc >= inicio, Vuelo.salida_utc < fin]
    if precio_min is not None:
        condiciones.append(precio >= precio_min)
    if precio_max is not None:
        condiciones.append(precio <= precio_max)
    if duracion_min is not None:
        condiciones.append(Vuelo.duracion_min >= duracion_min)
    if duracion_max is not None:
        condiciones.append(Vuelo.duracion_min <= duracion_max)

    return _pagina(db, condiciones, _orden_busqueda(orden, clase), pagina)


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
# ---------------------------------------------------------------------------
# Editar, cancelar y estados del vuelo (Sprint 2, B2-12 a B2-14; HU12, HU13, HU14)
# ---------------------------------------------------------------------------
# Punto de extension para el modulo de compra/reserva (B1): funciones `f(db, vuelo)` que se ejecutan
# al cancelar un vuelo, dentro de la misma transaccion (cancelar reservas y compras con reintegro).
ALCANCELAR_VUELO: list[Callable] = []

def _error(mensaje: str, estado_http: int, codigo: str, fields: dict | None = None) -> AppError:
    return AppError(mensaje, status_code=estado_http, code=codigo, fields=fields)


def _vuelo_o_404(db: Session, id_vuelo: int) -> Vuelo:
    vuelo = db.get(Vuelo, id_vuelo)
    if vuelo is None:
        raise _error("El vuelo no existe.", 404, "vuelo_no_encontrado")
    return vuelo


def cancelar_vuelo(db: Session, id_vuelo: int, motivo: str | None = None) -> Vuelo:
    """HU13: cancela un vuelo `programado` y libera sus cupos (vuelven a la capacidad del tipo).

    Si el vuelo tiene tiquetes vendidos, `motivo` es obligatorio (causa de fuerza mayor, minimo 10
    caracteres). Los ganchos de `ALCANCELAR_VUELO` corren en la misma transaccion: si uno falla, el
    vuelo no queda cancelado.
    """
    vuelo = _vuelo_o_404(db, id_vuelo)
    sincronizar_estados(db)
    vuelo = db.execute(select(Vuelo).where(Vuelo.id == id_vuelo)).scalar_one()  # recargar desde BD
    if vuelo.estado != EstadoVuelo.PROGRAMADO:
        if vuelo.estado == EstadoVuelo.CANCELADO:
            raise _error("El vuelo ya esta cancelado.", 409, "transicion_invalida")
        if vuelo.estado == EstadoVuelo.SUCEDIDO:
            raise _error("Solo se puede cancelar un vuelo programado.", 409, "vuelo_sucedido")
        if vuelo.estado == EstadoVuelo.REALIZADO:
            raise _error("Solo se puede cancelar un vuelo programado.", 409, "vuelo_realizado")
        raise _error("Solo se puede cancelar un vuelo programado.", 409, "transicion_invalida")

    # Si hay tiquetes vendidos, se requiere motivo de fuerza mayor
    ids = [vuelo.id]
    conteo = contar_tiquetes_vendidos(db, ids)
    if conteo.get(vuelo.id, 0) > 0:
        if not motivo or len(motivo.strip()) < 10:
            raise _error(
                "Cuando el vuelo tiene tiquetes vendidos se requiere una causa de fuerza mayor (minimo 10 caracteres).",
                422,
                "validacion",
                fields={"motivo": "Causa de fuerza mayor obligatoria (minimo 10 caracteres)."},
            )

    vuelo.estado = EstadoVuelo.CANCELADO
    vuelo.cupos_economica, vuelo.cupos_primera = CUPOS_POR_TIPO[vuelo.tipo]
    for gancho in ALCANCELAR_VUELO:
        gancho(db, vuelo.id)
    db.commit()
    db.refresh(vuelo)
    return vuelo


def editar_vuelo(db: Session, id_vuelo: int, datos: VueloEditar, *, ahora: datetime | None = None) -> Vuelo:
    """HU12: edita fecha, hora, origen, destino, duracion y costo de un vuelo `programado`.

    * El `estado` no es editable aqui: se cancela con `PATCH /admin/vuelos/{id}/cancelar` (HU13) o
      pasa a sucedido/realizado automaticamente por tiempo (HU14).
    * Solo un vuelo `programado` es editable (409 `vuelo_no_editable`) y se aplican las mismas
      reglas de HU18/D5 que al programarlo (422 con errores por campo).
    * El tipo se deduce de las ciudades. Si cambia (nacional <-> internacional) cambia la capacidad, y eso
      solo se permite si no hay cupos ocupados (409 `vuelo_con_ventas`).
    * La llegada se recalcula (salida + duracion, D15). El codigo no cambia.
    """
    ahora = ahora or datetime.now(timezone.utc)
    vuelo = _vuelo_o_404(db, id_vuelo)
    sincronizar_estados(db, ahora)
    vuelo = db.execute(select(Vuelo).where(Vuelo.id == id_vuelo)).scalar_one()  # recargar desde BD
    if vuelo.estado != EstadoVuelo.PROGRAMADO:
        if vuelo.estado == EstadoVuelo.SUCEDIDO:
            raise _error("Solo se pueden editar vuelos programados.", 409, "vuelo_sucedido")
        if vuelo.estado == EstadoVuelo.REALIZADO:
            raise _error("Solo se pueden editar vuelos programados.", 409, "vuelo_realizado")
        if vuelo.estado == EstadoVuelo.CANCELADO:
            raise _error("Solo se pueden editar vuelos programados.", 409, "vuelo_cancelado")
        raise _error("Solo se pueden editar los vuelos programados.", 409, "vuelo_no_editable")

    # Si hay tiquetes vendidos, no se puede editar
    conteo = contar_tiquetes_vendidos(db, [vuelo.id])
    if conteo.get(vuelo.id, 0) > 0:
        n = conteo[vuelo.id]
        raise _error(
            f"El vuelo ya tiene {n} {'tiquete vendido' if n == 1 else 'tiquetes vendidos'}: no se puede editar.",
            409,
            "vuelo_con_tiquetes",
        )

    origen = obtener_ciudad(db, datos.origen)
    destino = obtener_ciudad(db, datos.destino)
    if datos.origen == datos.destino:
        raise AppError(
            "Los datos enviados no son validos.", status_code=422, code="validacion",
            fields={"destino": "El destino debe ser distinto del origen."},
        )
    tipo = tipo_entre(origen, destino) if origen and destino else vuelo.tipo
    errores = validar_programacion(
        VueloCrear(
            tipo=tipo, origen=datos.origen, destino=datos.destino, fecha=datos.fecha, hora=datos.hora,
            duracion=datos.duracion_min, costo=datos.precio,
        ),
        origen,
        destino,
        ahora=ahora,
    )
    if errores:
        raise AppError("Los datos enviados no son validos.", status_code=422, code="validacion", fields=errores)

    if tipo != vuelo.tipo:
        raise AppError(
            "No se puede cambiar el tipo de vuelo (nacional/internacional) una vez programado.",
            status_code=422,
            code="validacion",
            fields={"destino": "No se puede cambiar el tipo de vuelo una vez programado."},
        )

    salida_utc = datetime.combine(datos.fecha, datos.hora, tzinfo=TZ_COLOMBIA).astimezone(timezone.utc)
    vuelo.origen = origen
    vuelo.destino = destino
    vuelo.salida_utc = salida_utc
    vuelo.duracion_min = datos.duracion_min
    vuelo.llegada_utc = salida_utc + timedelta(minutes=datos.duracion_min)
    vuelo.costo = datos.precio
    vuelo.costo_primera = datos.precio_primera if datos.precio_primera is not None else datos.precio
    db.commit()
    db.refresh(vuelo)
    return vuelo


def sincronizar_estados(db: Session, ahora: datetime | None = None) -> int:
    """Pasa los vuelos al estado que les corresponde por el tiempo (HU14). Devuelve cuantos cambio.

    * `programado` -> `sucedido` cuando ya salio.
    * `sucedido`   -> `realizado` cuando ya llego.

    Corre al arrancar, cada cierto tiempo (ver `main.py`) y antes de listar los vuelos realizados.
    """
    ahora = ahora or datetime.now(timezone.utc)
    salieron = db.execute(
        sa_update(Vuelo)
        .where(Vuelo.estado == EstadoVuelo.PROGRAMADO, Vuelo.salida_utc <= ahora)
        .values(estado=EstadoVuelo.SUCEDIDO)
    ).rowcount
    llegaron = db.execute(
        sa_update(Vuelo)
        .where(Vuelo.estado == EstadoVuelo.SUCEDIDO, Vuelo.llegada_utc <= ahora)
        .values(estado=EstadoVuelo.REALIZADO)
    ).rowcount
    db.commit()
    return (salieron or 0) + (llegaron or 0)


# Alias para compatibilidad con pruebas y codigo existente.
actualizar_estados = sincronizar_estados


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


def listar_vuelos_realizados(
    db: Session,
    *,
    estado: EstadoVuelo | None = None,
    origen: str | None = None,
    destino: str | None = None,
    pagina: int = 1,
) -> tuple[int, list[Vuelo]]:
    """HU14: vuelos `sucedido` o `realizado`, el de salida mas reciente primero."""
    estados = [estado] if estado else [EstadoVuelo.SUCEDIDO, EstadoVuelo.REALIZADO]
    condiciones = [Vuelo.estado.in_(estados)]
    if origen:
        condiciones.append(Vuelo.id_origen.in_(_ids_de_ciudad(origen)))
    if destino:
        condiciones.append(Vuelo.id_destino.in_(_ids_de_ciudad(destino)))
    return _pagina(db, condiciones, (Vuelo.salida_utc.desc(),), pagina)


def contar_tiquetes_vendidos(db: Session, ids_vuelo: list[int]) -> dict[int, int]:
    """Cuenta los tiquetes activos (RESERVADO o COMPRADO) por vuelo."""
    from app.modules.compras.models import EstadoTiquete, Tiquete  # import diferido para evitar ciclo

    if not ids_vuelo:
        return {}
    filas = db.execute(
        select(Tiquete.id_vuelo, func.count())
        .where(
            Tiquete.id_vuelo.in_(ids_vuelo),
            Tiquete.estado.in_([EstadoTiquete.RESERVADO, EstadoTiquete.COMPRADO]),
        )
        .group_by(Tiquete.id_vuelo)
    ).all()
    return {id_vuelo: count for id_vuelo, count in filas}


# ---------------------------------------------------------------------------
# Asientos individuales (selección de silla)
# ---------------------------------------------------------------------------

_COLUMNAS = ["A", "B", "C", "D", "E", "F"]  # 6 columnas por fila (3-3, con pasillo entre C y D)


def _numero_asiento(fila: int, columna: str) -> str:
    """Formato del número de asiento: ej. '1A', '25E'."""
    return f"{fila}{columna}"


def generar_asientos(db: Session, vuelo: Vuelo) -> list[Asiento]:
    """Genera los asientos individuales de un vuelo recién programado.

    Distribución por clase según `CUPOS_POR_TIPO`:
    - Primera clase: filas iniciales, 6 columnas por fila (3-3).
    - Económica: filas restantes, 6 columnas por fila (3-3).
    """
    cupos_economica, cupos_primera = CUPOS_POR_TIPO[vuelo.tipo]
    asientos: list[Asiento] = []

    fila_actual = 1
    # Primera clase primero
    filas_primera = -(-cupos_primera // len(_COLUMNAS))  # techo
    for f in range(fila_actual, fila_actual + filas_primera):
        for col in _COLUMNAS:
            if len([a for a in asientos if a.clase == ClaseAsiento.PRIMERA]) >= cupos_primera:
                break
            asientos.append(
                Asiento(
                    id_vuelo=vuelo.id,
                    numero=_numero_asiento(f, col),
                    fila=f,
                    columna=col,
                    clase=ClaseAsiento.PRIMERA,
                    estado=EstadoAsiento.DISPONIBLE,
                )
            )
    fila_actual += filas_primera

    # Economica
    filas_economica = -(-cupos_economica // len(_COLUMNAS))  # techo
    for f in range(fila_actual, fila_actual + filas_economica):
        for col in _COLUMNAS:
            if len([a for a in asientos if a.clase == ClaseAsiento.ECONOMICA]) >= cupos_economica:
                break
            asientos.append(
                Asiento(
                    id_vuelo=vuelo.id,
                    numero=_numero_asiento(f, col),
                    fila=f,
                    columna=col,
                    clase=ClaseAsiento.ECONOMICA,
                    estado=EstadoAsiento.DISPONIBLE,
                )
            )

    db.add_all(asientos)
    db.flush()
    return asientos


def obtener_asientos_vuelo(db: Session, id_vuelo: int) -> list[Asiento]:
    """Devuelve todos los asientos de un vuelo ordenados por fila y columna."""
    return list(
        db.scalars(
            select(Asiento)
            .where(Asiento.id_vuelo == id_vuelo)
            .order_by(Asiento.fila, Asiento.columna)
        )
    )


def obtener_asientos_disponibles(db: Session, id_vuelo: int, clase: ClaseAsiento | None = None) -> list[Asiento]:
    """Devuelve los asientos disponibles de un vuelo, opcionalmente filtrados por clase."""
    condiciones = [Asiento.id_vuelo == id_vuelo, Asiento.estado == EstadoAsiento.DISPONIBLE]
    if clase is not None:
        condiciones.append(Asiento.clase == clase)
    return list(
        db.scalars(
            select(Asiento)
            .where(*condiciones)
            .order_by(Asiento.fila, Asiento.columna)
        )
    )


def reservar_asientos(db: Session, id_vuelo: int, ids_asientos: list[int]) -> list[Asiento]:
    """Marca los asientos dados como OCUPADO en una transacción atomica.

    Solo se reservan si siguen DISPONIBLES (evita doble venta por concurrencia).
    Lanza AppError si alguno ya no esta disponible.
    """
    if not ids_asientos:
        return []

    asientos = db.scalars(select(Asiento).where(Asiento.id.in_(ids_asientos))).all()
    if len(asientos) != len(ids_asientos):
        raise AppError(
            "Uno o más asientos no existen.",
            status_code=404,
            code="asiento_no_encontrado",
        )

    no_disponibles = [
        a.numero for a in asientos if a.estado != EstadoAsiento.DISPONIBLE
    ]
    if no_disponibles:
        raise AppError(
            f"Los asientos ya no estan disponibles: {', '.join(no_disponibles)}.",
            status_code=409,
            code="asiento_no_disponible",
            fields={a.numero: "ocupado" for a in asientos if a.estado != EstadoAsiento.DISPONIBLE},
        )

    for a in asientos:
        a.estado = EstadoAsiento.OCUPADO
    db.flush()
    return asientos


def liberar_asientos(db: Session, ids_asientos: list[int]) -> int:
    """Libera asientos (pasa de OCUPADO a DISPONIBLE). Devuelve cuantos se liberaron."""
    if not ids_asientos:
        return 0
    res = db.execute(
        sa_update(Asiento)
        .where(Asiento.id.in_(ids_asientos), Asiento.estado == EstadoAsiento.OCUPADO)
        .values(estado=EstadoAsiento.DISPONIBLE, id_tiquete=None)
    )
    db.flush()
    return res.rowcount or 0
