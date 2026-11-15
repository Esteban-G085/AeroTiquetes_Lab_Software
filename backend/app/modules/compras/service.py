"""
Logica de Compra y reserva (HU6, HU7, HU8, HU9; B1-12 a B1-15).

Reglas que se aplican aqui (todas probadas en `tests/test_compras.py`):

* Una reserva retiene los cupos hasta 24 h (o hasta la salida del primer vuelo, lo que ocurra antes);
  al vencer se liberan cupo y silla. Se libera de forma perezosa en cada peticion y tambien con la
  tarea periodica de `main.py`.
* Maximo 5 tiquetes por vuelo y cliente (compra o reserva); no se mezclan una compra y una reserva
  activas del mismo cliente en el mismo vuelo; una persona (por documento) no puede estar dos veces
  en un mismo vuelo, venga de quien venga la operacion (R20).
* Un menor de edad (< 18) no puede viajar solo: cada viaje debe incluir al menos un adulto.
* Trayecto unico (origen -> destino) o completo (origen -> destino -> origen, dos vuelos).
* Cada viajero recibe su propio codigo de reserva; en un trayecto completo comparte codigo en ida y regreso.
* El pago descuenta de la billetera (402 si el saldo no alcanza). Cancelar una compra hasta 1 h antes
  del vuelo devuelve el dinero a la billetera; una reserva se cancela mientras este activa.

Concurrencia: los cupos, el saldo y los cambios de estado se modifican con `UPDATE ... WHERE` atomicos
(y la base de datos tiene restricciones unicas de silla y de persona por vuelo), asi dos peticiones
simultaneas no pueden vender dos veces el mismo cupo ni reintegrar dos veces.
"""
import random
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from fastapi import status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.errors import AppError
from app.modules.compras.models import (
    ESTADOS_ACTIVOS,
    ClaseTiquete,
    Compra,
    EstadoCompra,
    EstadoReserva,
    EstadoTiquete,
    Reserva,
    Tiquete,
    TrayectoTiquete,
    Viajero,
)
from app.modules.compras.schemas import ItemSolicitud, TrayectoSolicitado
from app.modules.financiero import service as financiero
from app.modules.vuelos.models import CUPOS_POR_TIPO, EstadoVuelo, Vuelo

RESERVA_VIGENCIA = timedelta(hours=24)
CANCELACION_COMPRA_ANTICIPACION = timedelta(hours=1)
MAYORIA_EDAD = 18
MAX_TIQUETES_POR_VUELO = 5

_ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # sin 0/O ni 1/I para que no se confundan
_LARGO_CODIGO = 8
_azar = random.SystemRandom()


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


def _error(mensaje: str, codigo: str, http: int = status.HTTP_409_CONFLICT, fields: dict | None = None) -> AppError:
    return AppError(mensaje, status_code=http, code=codigo, fields=fields)


def edad_en(nacimiento: date, fecha: date) -> int:
    return fecha.year - nacimiento.year - ((fecha.month, fecha.day) < (nacimiento.month, nacimiento.day))


# =========================================================================
# Planeacion y validaciones
# =========================================================================

@dataclass
class _Linea:
    """Un tiquete por crear: un viajero en un tramo (vuelo) de un item."""

    indice_item: int
    vuelo: Vuelo
    clase: ClaseTiquete
    trayecto: TrayectoTiquete
    viajero: dict


def _cargar_vuelos(db: Session, ids: set[int], ahora: datetime) -> dict[int, Vuelo]:
    vuelos = {v.id: v for v in db.scalars(select(Vuelo).where(Vuelo.id.in_(ids)))}
    faltan = sorted(ids - set(vuelos))
    if faltan:
        raise _error(
            "Uno de los vuelos no existe.", "vuelo_no_encontrado", status.HTTP_404_NOT_FOUND,
            {"vuelo_id": f"No existe el vuelo {faltan[0]}."},
        )
    for v in vuelos.values():
        if v.estado != EstadoVuelo.PROGRAMADO or v.salida_utc <= ahora:
            raise _error(
                f"El vuelo {v.codigo} ya no esta disponible (cancelado o ya salio).", "vuelo_no_disponible",
                fields={"vuelo_id": f"{v.codigo} no esta disponible."},
            )
    return vuelos


def _planear(db: Session, id_cliente: int, items: list[ItemSolicitud], ahora: datetime, para: str) -> list[_Linea]:
    """Valida el pedido completo y devuelve los tiquetes por crear. No escribe nada."""
    ids = {i.vuelo_id for i in items} | {i.vuelo_regreso_id for i in items if i.vuelo_regreso_id}
    vuelos = _cargar_vuelos(db, ids, ahora)

    lineas: list[_Linea] = []
    for n, item in enumerate(items):
        ida = vuelos[item.vuelo_id]
        tramos = [(ida, TrayectoTiquete.UNICO)]
        if item.trayecto == TrayectoSolicitado.COMPLETO:
            regreso = vuelos[item.vuelo_regreso_id]
            if regreso.id_origen != ida.id_destino or regreso.id_destino != ida.id_origen:
                raise _error(
                    "El vuelo de regreso debe volver al origen del vuelo de ida.", "trayecto_invalido",
                    status.HTTP_422_UNPROCESSABLE_ENTITY, {"vuelo_regreso_id": "No es el regreso de este vuelo."},
                )
            if regreso.salida_utc <= ida.llegada_utc:
                raise _error(
                    "El vuelo de regreso debe salir despues de que llegue el de ida.", "trayecto_invalido",
                    status.HTTP_422_UNPROCESSABLE_ENTITY, {"vuelo_regreso_id": "Sale antes de que llegue la ida."},
                )
            tramos = [(ida, TrayectoTiquete.IDA), (regreso, TrayectoTiquete.REGRESO)]

        # Un menor de edad no puede ser viajero unico (mayoria de edad = 18 para todos los destinos).
        dia_salida = ida.salida_utc.date()
        if not any(edad_en(v.fecha_nacimiento, dia_salida) >= MAYORIA_EDAD for v in item.viajeros):
            raise _error(
                "Los menores de edad no pueden viajar solos: incluye al menos un viajero mayor de 18 anios.",
                "menor_viajero_unico", status.HTTP_422_UNPROCESSABLE_ENTITY,
                {"viajeros": "Debe haber al menos un adulto."},
            )

        for vuelo, trayecto in tramos:
            for viajero in item.viajeros:
                lineas.append(_Linea(n, vuelo, item.clase, trayecto, viajero.model_dump()))

    # El mismo documento no puede repetirse dentro del pedido para un mismo vuelo.
    vistos: set[tuple[int, str]] = set()
    for l in lineas:
        clave = (l.vuelo.id, l.viajero["documento"])
        if clave in vistos:
            raise _error(
                f"El viajero {l.viajero['documento']} aparece mas de una vez en el vuelo {l.vuelo.codigo}.",
                "viajero_duplicado", status.HTTP_422_UNPROCESSABLE_ENTITY,
                {"documento": "Repetido en el mismo vuelo."},
            )
        vistos.add(clave)

    # Reglas contra lo que ya existe en la base de datos, vuelo por vuelo.
    por_vuelo: dict[int, list[_Linea]] = defaultdict(list)
    for l in lineas:
        por_vuelo[l.vuelo.id].append(l)
    for id_vuelo, grupo in por_vuelo.items():
        codigo = grupo[0].vuelo.codigo
        docs = [l.viajero["documento"] for l in grupo]
        ya_en_vuelo = db.scalars(
            select(Tiquete.documento).where(
                Tiquete.id_vuelo == id_vuelo, Tiquete.documento.in_(docs), Tiquete.estado.in_(ESTADOS_ACTIVOS)
            )
        ).first()
        if ya_en_vuelo:
            raise _error(
                f"El viajero {ya_en_vuelo} ya tiene un tiquete en el vuelo {codigo}.",
                "viajero_duplicado_en_vuelo", fields={"documento": f"{ya_en_vuelo} ya esta en este vuelo."},
            )

        activos = Counter(
            dict(
                db.execute(
                    select(Tiquete.estado, func.count()).where(
                        Tiquete.id_cliente == id_cliente, Tiquete.id_vuelo == id_vuelo,
                        Tiquete.estado.in_(ESTADOS_ACTIVOS),
                    ).group_by(Tiquete.estado)
                ).all()
            )
        )
        if sum(activos.values()) + len(grupo) > MAX_TIQUETES_POR_VUELO:
            raise _error(
                f"Solo puedes tener {MAX_TIQUETES_POR_VUELO} tiquetes (comprados o reservados) por vuelo.",
                "limite_tiquetes_vuelo", fields={"viajeros": f"Maximo {MAX_TIQUETES_POR_VUELO} por vuelo ({codigo})."},
            )
        if para == "reserva" and activos[EstadoTiquete.COMPRADO]:
            raise _error(
                f"Ya compraste tiquetes en el vuelo {codigo}: no puedes reservar en el mismo vuelo.",
                "compra_y_reserva_simultaneas",
            )
        if para == "compra" and activos[EstadoTiquete.RESERVADO]:
            raise _error(
                f"Tienes una reserva activa en el vuelo {codigo}: paga esa reserva o cancelala antes de comprar.",
                "compra_y_reserva_simultaneas",
            )
    return lineas


# =========================================================================
# Cupos, sillas y codigos
# =========================================================================

def _tomar_cupos(db: Session, vuelo: Vuelo, clase: ClaseTiquete, n: int) -> None:
    """Resta `n` cupos de la clase de forma atomica; 409 si no alcanzan o si el vuelo se cancelo/salio justo ahora."""
    if clase == ClaseTiquete.PRIMERA:
        cond, val = Vuelo.cupos_primera >= n, {"cupos_primera": Vuelo.cupos_primera - n}
    else:
        cond, val = Vuelo.cupos_economica >= n, {"cupos_economica": Vuelo.cupos_economica - n}
    if db.execute(update(Vuelo).where(Vuelo.id == vuelo.id, Vuelo.estado == EstadoVuelo.PROGRAMADO, cond).values(**val)).rowcount == 0:
        raise _error(
            f"No hay cupos suficientes en {clase.value} para el vuelo {vuelo.codigo}.", "sin_cupos",
            fields={"vuelo_id": f"Sin cupos en {clase.value}."},
        )


def _devolver_cupos(db: Session, id_vuelo: int, clase: ClaseTiquete, n: int) -> None:
    if clase == ClaseTiquete.PRIMERA:
        val = {"cupos_primera": Vuelo.cupos_primera + n}
    else:
        val = {"cupos_economica": Vuelo.cupos_economica + n}
    db.execute(update(Vuelo).where(Vuelo.id == id_vuelo).values(**val))


def _rango_sillas(vuelo: Vuelo, clase: ClaseTiquete) -> range:
    """Nacional: primera 1-25, economica 26-150. Internacional: primera 1-50, economica 51-250."""
    economica, primera = CUPOS_POR_TIPO[vuelo.tipo]
    return range(1, primera + 1) if clase == ClaseTiquete.PRIMERA else range(primera + 1, primera + economica + 1)


def _generar_codigo(db: Session, usados: set[str]) -> str:
    while True:
        codigo = "".join(_azar.choice(_ALFABETO_CODIGO) for _ in range(_LARGO_CODIGO))
        if codigo in usados:
            continue
        if db.scalar(select(Tiquete.id).where(Tiquete.codigo_reserva == codigo).limit(1)) is None:
            usados.add(codigo)
            return codigo


def _guardar_viajero(db: Session, id_cliente: int, datos: dict) -> Viajero:
    """Reutiliza el viajero del cliente con ese documento (y actualiza sus datos) o lo crea."""
    viajero = db.scalar(select(Viajero).where(Viajero.id_cliente == id_cliente, Viajero.documento == datos["documento"]))
    if viajero is None:
        viajero = Viajero(id_cliente=id_cliente, **datos)
        db.add(viajero)
    else:
        for campo, valor in datos.items():
            setattr(viajero, campo, valor)
    return viajero


def _crear_tiquetes(
    db: Session, id_cliente: int, lineas: list[_Linea], estado: EstadoTiquete, *,
    reserva: Reserva | None = None, compra: Compra | None = None,
) -> list[Tiquete]:
    # 1) cupos (atomico, por vuelo y clase)
    pedidos = Counter((l.vuelo.id, l.clase) for l in lineas)
    vuelos = {l.vuelo.id: l.vuelo for l in lineas}
    for (id_vuelo, clase), n in pedidos.items():
        _tomar_cupos(db, vuelos[id_vuelo], clase, n)

    # 2) sillas al azar dentro del rango de la clase
    ocupadas = {
        id_vuelo: set(
            db.scalars(select(Tiquete.numero_silla).where(Tiquete.id_vuelo == id_vuelo, Tiquete.numero_silla.is_not(None)))
        )
        for id_vuelo in vuelos
    }

    # 3) un codigo por viajero de cada item (la ida y el regreso comparten codigo)
    codigos: dict[tuple[int, str], str] = {}
    usados: set[str] = set()
    viajeros: dict[str, Viajero] = {}

    tiquetes: list[Tiquete] = []
    for l in lineas:
        libres = [n for n in _rango_sillas(l.vuelo, l.clase) if n not in ocupadas[l.vuelo.id]]
        if not libres:
            raise _error(f"No quedan sillas libres en {l.clase.value} para {l.vuelo.codigo}.", "sin_cupos")
        silla = _azar.choice(libres)
        ocupadas[l.vuelo.id].add(silla)

        doc = l.viajero["documento"]
        if doc not in viajeros:
            viajeros[doc] = _guardar_viajero(db, id_cliente, l.viajero)
            db.flush()
        clave = (l.indice_item, doc)
        if clave not in codigos:
            codigos[clave] = _generar_codigo(db, usados)

        t = Tiquete(
            id_cliente=id_cliente, reserva=reserva, compra=compra, id_viajero=viajeros[doc].id, vuelo=l.vuelo,
            documento=doc, codigo_reserva=codigos[clave], clase=l.clase, trayecto=l.trayecto,
            numero_silla=silla, precio=l.vuelo.costo, estado=estado,
        )
        db.add(t)
        tiquetes.append(t)
    db.flush()
    return tiquetes


def _liberar(
    db: Session, tiquetes: list[Tiquete], desde: EstadoTiquete, hacia: EstadoTiquete, ahora: datetime,
    *, devolver_cupos: bool = True,
) -> list[Tiquete]:
    """Pasa los tiquetes de `desde` a `hacia`, libera su silla y (opcional) devuelve el cupo.

    El cambio de estado es atomico (`UPDATE ... WHERE estado = desde`): si otra peticion ya lo
    hizo, ese tiquete se omite. Devuelve solo los tiquetes que realmente cambiaron."""
    db.flush()
    cambiados: list[Tiquete] = []
    for t in tiquetes:
        res = db.execute(
            update(Tiquete)
            .where(Tiquete.id == t.id, Tiquete.estado == desde)
            .values(estado=hacia, numero_silla=None, cancelado_en=ahora)
        )
        if res.rowcount == 1:
            cambiados.append(t)
    if devolver_cupos:
        for (id_vuelo, clase), n in Counter((t.id_vuelo, t.clase) for t in cambiados).items():
            _devolver_cupos(db, id_vuelo, clase, n)
    db.expire_all()
    return cambiados


def _guardar(db: Session) -> None:
    db.commit()


_INTENTOS_POR_CHOQUE_DE_SILLA = 3


def _traducir_choque(exc: IntegrityError) -> tuple[str, AppError | None]:
    """Clasifica un choque de restricciones unicas provocado por peticiones simultaneas."""
    detalle = str(exc.orig)
    if "uq_tiquete_vuelo_documento_activo" in detalle:
        return "documento", _error(
            "Ese viajero ya tiene un tiquete en el vuelo (otra operacion lo tomo al mismo tiempo).",
            "viajero_duplicado_en_vuelo", fields={"documento": "Ya esta en este vuelo."},
        )
    if "uq_tiquete_vuelo_silla" in detalle or "uq_tiquete_codigo_vuelo" in detalle:
        return "silla", None  # se reintenta: se vuelve a elegir silla o codigo
    return "otro", _error("Otra operacion modifico los mismos datos al mismo tiempo. Intenta de nuevo.", "conflicto_concurrencia")


def _transaccion(db: Session, funcion):
    """Ejecuta `funcion()` en una transaccion: si falla por una regla de negocio se descarta todo lo escrito.

    Si dos peticiones simultaneas eligen la misma silla, la base de datos frena a la segunda
    (restriccion unica) y aqui se reintenta eligiendo otra; si chocan en la persona por vuelo se
    responde 409."""
    for intento in range(_INTENTOS_POR_CHOQUE_DE_SILLA):
        try:
            return funcion()
        except IntegrityError as exc:
            db.rollback()
            tipo, error = _traducir_choque(exc)
            if error is not None:
                raise error from exc
            if intento == _INTENTOS_POR_CHOQUE_DE_SILLA - 1:
                raise _error(
                    "Hay mucha demanda en este vuelo. Intenta de nuevo.", "conflicto_concurrencia"
                ) from exc
        except Exception:
            db.rollback()
            raise


# =========================================================================
# Vencimiento de reservas
# =========================================================================

def vencer_reservas(db: Session, ahora: datetime | None = None) -> int:
    """Libera cupos y sillas de las reservas cuyas 24 h terminaron. Devuelve cuantas vencio."""
    ahora = ahora or _ahora()
    ids = list(db.scalars(select(Reserva.id).where(Reserva.estado == EstadoReserva.ACTIVA, Reserva.expira_en <= ahora)))
    vencidas = 0
    for id_reserva in ids:
        res = db.execute(
            update(Reserva)
            .where(Reserva.id == id_reserva, Reserva.estado == EstadoReserva.ACTIVA)
            .values(estado=EstadoReserva.VENCIDA)
        )
        if res.rowcount == 1:  # solo quien gano la carrera libera los cupos
            reserva = db.get(Reserva, id_reserva)
            _liberar(db, list(reserva.tiquetes), EstadoTiquete.RESERVADO, EstadoTiquete.VENCIDO, ahora)
            vencidas += 1
    db.commit()
    return vencidas


# =========================================================================
# Reservar (HU6)
# =========================================================================

def crear_reserva(db: Session, id_cliente: int, items: list[ItemSolicitud]) -> Reserva:
    ahora = _ahora()
    vencer_reservas(db, ahora)

    def _crear() -> Reserva:
        lineas = _planear(db, id_cliente, items, ahora, "reserva")
        primera_salida = min(l.vuelo.salida_utc for l in lineas)
        reserva = Reserva(
            id_cliente=id_cliente, estado=EstadoReserva.ACTIVA, creada_en=ahora,
            expira_en=min(ahora + RESERVA_VIGENCIA, primera_salida),
        )
        db.add(reserva)
        db.flush()
        _crear_tiquetes(db, id_cliente, lineas, EstadoTiquete.RESERVADO, reserva=reserva)
        _guardar(db)
        return reserva

    reserva = _transaccion(db, _crear)
    db.refresh(reserva)
    return reserva


# =========================================================================
# Comprar (HU7)
# =========================================================================

def crear_compra(db: Session, id_cliente: int, items: list[ItemSolicitud]) -> Compra:
    ahora = _ahora()
    vencer_reservas(db, ahora)
    billetera = financiero.obtener_o_crear_billetera(db, id_cliente)

    def _crear() -> Compra:
        lineas = _planear(db, id_cliente, items, ahora, "compra")
        total = sum(l.vuelo.costo for l in lineas)
        compra = Compra(id_cliente=id_cliente, estado=EstadoCompra.PAGADA, total=total, pagada_en=ahora)
        db.add(compra)
        db.flush()
        _crear_tiquetes(db, id_cliente, lineas, EstadoTiquete.COMPRADO, compra=compra)
        financiero.debitar(db, billetera.id, total)  # 402 si el saldo no alcanza (deshace todo)
        _guardar(db)
        return compra

    compra = _transaccion(db, _crear)
    db.refresh(compra)
    return compra


def _reserva_del_cliente(db: Session, id_cliente: int, id_reserva: int) -> Reserva:
    reserva = db.get(Reserva, id_reserva)
    if reserva is None or reserva.id_cliente != id_cliente:
        raise _error("La reserva no existe.", "reserva_no_encontrada", status.HTTP_404_NOT_FOUND)
    return reserva


def _exigir_reserva_activa(reserva: Reserva) -> None:
    if reserva.estado == EstadoReserva.ACTIVA:
        return
    mensajes = {
        EstadoReserva.VENCIDA: ("La reserva vencio y sus cupos fueron liberados.", "reserva_vencida"),
        EstadoReserva.CANCELADA: ("La reserva ya fue cancelada.", "reserva_cancelada"),
        EstadoReserva.COMPRADA: ("La reserva ya fue pagada.", "reserva_ya_comprada"),
    }
    mensaje, codigo = mensajes[reserva.estado]
    raise _error(mensaje, codigo)


def _pasar_reserva(db: Session, reserva: Reserva, hacia: EstadoReserva) -> None:
    """ACTIVA -> `hacia` de forma atomica; si otra peticion se adelanto, se informa el estado real."""
    res = db.execute(
        update(Reserva).where(Reserva.id == reserva.id, Reserva.estado == EstadoReserva.ACTIVA).values(estado=hacia)
    )
    db.expire(reserva)
    if res.rowcount == 0:
        db.refresh(reserva)
        _exigir_reserva_activa(reserva)


def comprar_reserva(db: Session, id_cliente: int, id_reserva: int) -> Compra:
    """Paga con la billetera una reserva activa: pasa a compra con los mismos tiquetes y codigos."""
    ahora = _ahora()
    vencer_reservas(db, ahora)
    billetera = financiero.obtener_o_crear_billetera(db, id_cliente)

    def _pagar() -> Compra:
        reserva = _reserva_del_cliente(db, id_cliente, id_reserva)
        _exigir_reserva_activa(reserva)
        tiquetes = [t for t in reserva.tiquetes if t.estado == EstadoTiquete.RESERVADO]
        for t in tiquetes:
            if t.vuelo.estado != EstadoVuelo.PROGRAMADO or t.vuelo.salida_utc <= ahora:
                raise _error(f"El vuelo {t.vuelo.codigo} ya no esta disponible.", "vuelo_no_disponible")
        total = sum(t.precio for t in tiquetes)

        _pasar_reserva(db, reserva, EstadoReserva.COMPRADA)
        compra = Compra(id_cliente=id_cliente, id_reserva=reserva.id, estado=EstadoCompra.PAGADA, total=total, pagada_en=ahora)
        db.add(compra)
        db.flush()
        db.execute(
            update(Tiquete)
            .where(Tiquete.id.in_([t.id for t in tiquetes]), Tiquete.estado == EstadoTiquete.RESERVADO)
            .values(estado=EstadoTiquete.COMPRADO, id_compra=compra.id)
        )
        financiero.debitar(db, billetera.id, total)
        _guardar(db)
        return compra

    compra = _transaccion(db, _pagar)
    db.refresh(compra)
    return compra


# =========================================================================
# Cancelar (HU8)
# =========================================================================

def cancelar_reserva(db: Session, id_cliente: int, id_reserva: int) -> Reserva:
    """Una reserva se puede cancelar en cualquier momento mientras este activa (dentro de sus 24 h)."""
    ahora = _ahora()
    vencer_reservas(db, ahora)

    def _cancelar() -> Reserva:
        reserva = _reserva_del_cliente(db, id_cliente, id_reserva)
        _exigir_reserva_activa(reserva)
        _pasar_reserva(db, reserva, EstadoReserva.CANCELADA)
        reserva = db.get(Reserva, id_reserva)
        _liberar(db, list(reserva.tiquetes), EstadoTiquete.RESERVADO, EstadoTiquete.CANCELADO, ahora)
        _guardar(db)
        return reserva

    reserva = _transaccion(db, _cancelar)
    db.refresh(reserva)
    return reserva


def _estado_de_compra(compra: Compra) -> EstadoCompra:
    activos = [t for t in compra.tiquetes if t.estado == EstadoTiquete.COMPRADO]
    if not activos:
        return EstadoCompra.CANCELADA
    return EstadoCompra.PAGADA if len(activos) == len(compra.tiquetes) else EstadoCompra.PARCIALMENTE_CANCELADA


def cancelar_compra(
    db: Session, id_cliente: int, id_compra: int, tiquete_ids: list[int] | None = None
) -> tuple[Compra, int, set[int]]:
    """Cancela la compra (o solo los tiquetes indicados) hasta 1 h antes de cada vuelo y reintegra
    el dinero a la billetera. Devuelve (compra, reintegro, ids de los tiquetes cancelados)."""
    ahora = _ahora()
    vencer_reservas(db, ahora)
    billetera = financiero.obtener_o_crear_billetera(db, id_cliente)

    def _cancelar() -> tuple[Compra, int, set[int]]:
        compra = db.get(Compra, id_compra)
        if compra is None or compra.id_cliente != id_cliente:
            raise _error("La compra no existe.", "compra_no_encontrada", status.HTTP_404_NOT_FOUND)
        activos = {t.id: t for t in compra.tiquetes if t.estado == EstadoTiquete.COMPRADO}
        if not activos:
            raise _error("La compra ya esta cancelada.", "compra_ya_cancelada")

        if tiquete_ids is None:
            seleccion = list(activos.values())
        else:
            ajenos = [i for i in tiquete_ids if i not in activos]
            if ajenos:
                raise _error(
                    "Alguno de los tiquetes no pertenece a la compra o ya esta cancelado.", "tiquete_no_encontrado",
                    status.HTTP_404_NOT_FOUND, {"tiquete_ids": f"Tiquete {ajenos[0]} no se puede cancelar."},
                )
            seleccion = [activos[i] for i in dict.fromkeys(tiquete_ids)]

        for t in seleccion:
            if t.vuelo.salida_utc - ahora < CANCELACION_COMPRA_ANTICIPACION:
                raise _error(
                    f"Solo puedes cancelar hasta 1 hora antes del vuelo ({t.vuelo.codigo}).",
                    "fuera_de_plazo_cancelacion",
                )

        cambiados = _liberar(db, seleccion, EstadoTiquete.COMPRADO, EstadoTiquete.CANCELADO, ahora)
        ids_cancelados = {t.id for t in cambiados}
        reintegro = sum(t.precio for t in cambiados)
        if reintegro:
            financiero.acreditar(db, billetera.id, reintegro)
        compra = db.get(Compra, id_compra)
        compra.estado = _estado_de_compra(compra)
        _guardar(db)
        return compra, reintegro, ids_cancelados

    compra, reintegro, ids_cancelados = _transaccion(db, _cancelar)
    db.refresh(compra)
    return compra, reintegro, ids_cancelados


def reintegrar_vuelo_cancelado(db: Session, id_vuelo: int, *, devolver_cupos: bool = False) -> dict:
    """GANCHO PARA B2 (HU13): cuando un administrador cancela un vuelo, llamar a esta funcion.

    * Tiquetes comprados: se cancelan y se reintegra su valor a la billetera de cada cliente
      (sin el limite de 1 hora: el vuelo lo cancela la aerolinea).
    * Tiquetes reservados: se cancelan (no hay dinero que devolver).
    * Los cupos no se tocan por defecto: `cancelar vuelo` (B2-13) ya libera los de la clase.

    Hace commit. Devuelve {"tiquetes": n, "reintegrado": total_cop}."""
    ahora = _ahora()
    tiquetes = list(
        db.scalars(select(Tiquete).where(Tiquete.id_vuelo == id_vuelo, Tiquete.estado.in_(ESTADOS_ACTIVOS)))
    )
    comprados = [t for t in tiquetes if t.estado == EstadoTiquete.COMPRADO]
    reservados = [t for t in tiquetes if t.estado == EstadoTiquete.RESERVADO]
    ids_comprados = {t.id: (t.id_cliente, t.precio, t.id_compra) for t in comprados}
    ids_reservas = {t.id_reserva for t in reservados if t.id_reserva}

    cambiados = _liberar(db, comprados, EstadoTiquete.COMPRADO, EstadoTiquete.CANCELADO, ahora, devolver_cupos=devolver_cupos)
    por_cliente: Counter = Counter()
    ids_compras: set[int] = set()
    for t in cambiados:
        cliente, precio, id_compra = ids_comprados[t.id]
        por_cliente[cliente] += precio
        if id_compra:
            ids_compras.add(id_compra)
    for cliente, monto in por_cliente.items():
        financiero.acreditar(db, financiero.obtener_o_crear_billetera(db, cliente).id, monto)

    _liberar(db, reservados, EstadoTiquete.RESERVADO, EstadoTiquete.CANCELADO, ahora, devolver_cupos=devolver_cupos)

    for id_compra in ids_compras:
        compra = db.get(Compra, id_compra)
        compra.estado = _estado_de_compra(compra)
    for id_reserva in ids_reservas:
        reserva = db.get(Reserva, id_reserva)
        if reserva.estado == EstadoReserva.ACTIVA and not any(t.estado == EstadoTiquete.RESERVADO for t in reserva.tiquetes):
            reserva.estado = EstadoReserva.CANCELADA
    db.commit()
    return {"tiquetes": len(tiquetes), "reintegrado": sum(por_cliente.values())}


# =========================================================================
# Consultas (HU9)
# =========================================================================

def obtener_reserva(db: Session, id_cliente: int, id_reserva: int) -> Reserva:
    vencer_reservas(db)
    return _reserva_del_cliente(db, id_cliente, id_reserva)


def obtener_compra(db: Session, id_cliente: int, id_compra: int) -> Compra:
    compra = db.get(Compra, id_compra)
    if compra is None or compra.id_cliente != id_cliente:
        raise _error("La compra no existe.", "compra_no_encontrada", status.HTTP_404_NOT_FOUND)
    return compra


def tiquetes_activos_en_vuelo(db: Session, id_cliente: int, id_vuelo: int) -> int:
    """Tiquetes activos (comprados o reservados) que el cliente tiene en un vuelo (limite de 5)."""
    return db.scalar(
        select(func.count()).select_from(Tiquete).where(
            Tiquete.id_cliente == id_cliente, Tiquete.id_vuelo == id_vuelo, Tiquete.estado.in_(ESTADOS_ACTIVOS),
        )
    ) or 0


def vuelos_de_regreso(db: Session, id_cliente: int, id_vuelo: int, ahora: datetime | None = None) -> list[tuple[Vuelo, int]]:
    """Vuelos programados destino -> origen que salen despues de que llega `id_vuelo` (trayecto completo).

    Todos son directos (un vuelo = un tramo). Cada uno trae cuantos tiquetes activos tiene ya el cliente.
    """
    ahora = ahora or _ahora()
    ida = db.get(Vuelo, id_vuelo)
    if ida is None:
        raise _error("El vuelo no existe.", "vuelo_no_encontrado", status.HTTP_404_NOT_FOUND)
    vuelos = db.scalars(
        select(Vuelo)
        .where(
            Vuelo.id_origen == ida.id_destino, Vuelo.id_destino == ida.id_origen,
            Vuelo.estado == EstadoVuelo.PROGRAMADO,
            Vuelo.salida_utc > max(ida.llegada_utc, ahora),
        )
        .order_by(Vuelo.salida_utc)
        .limit(50)
    ).all()
    return [(v, tiquetes_activos_en_vuelo(db, id_cliente, v.id)) for v in vuelos]


def historial(
    db: Session, id_cliente: int, pagina: int = 1, tamano: int = 10, tipo: str | None = None
) -> tuple[int, list[Reserva | Compra]]:
    """Reservas y compras del cliente (activas, canceladas y vencidas), lo mas reciente primero.

    Una reserva que ya se pago no aparece sola: la representa la compra que nacio de ella."""
    vencer_reservas(db)
    operaciones: list[tuple[datetime, Reserva | Compra]] = []
    if tipo in (None, "reserva"):
        reservas = db.scalars(
            select(Reserva)
            .where(Reserva.id_cliente == id_cliente, Reserva.estado != EstadoReserva.COMPRADA)
            .options(selectinload(Reserva.tiquetes))
        )
        operaciones += [(r.creada_en, r) for r in reservas]
    if tipo in (None, "compra"):
        compras = db.scalars(select(Compra).where(Compra.id_cliente == id_cliente).options(selectinload(Compra.tiquetes)))
        operaciones += [(c.pagada_en, c) for c in compras]
    operaciones.sort(key=lambda par: (par[0], par[1].id), reverse=True)
    inicio = (pagina - 1) * tamano
    return len(operaciones), [op for _, op in operaciones[inicio : inicio + tamano]]
