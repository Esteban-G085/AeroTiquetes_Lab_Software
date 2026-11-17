"""
Rutas de Compra y reserva (HU6-HU9). Solo clientes: administrador y root no compran ni reservan.

    POST /reservas                     reservar (retiene cupos 24 h)               HU6
    GET  /reservas/{id}                consultar una reserva
    POST /reservas/{id}/comprar        pagar una reserva activa con la billetera   HU7
    POST /reservas/{id}/cancelar       cancelar una reserva activa                 HU8
    POST /compras                      comprar (carrito de uno o varios vuelos)    HU7
    GET  /compras/{id}                 consultar una compra
    POST /compras/{id}/cancelar        cancelar (hasta 1 h antes) con reintegro    HU8
    GET  /mi-historial                 compras y reservas del cliente              HU9
    GET  /vuelos/{id}/regreso          vuelos de regreso posibles (trayecto completo)
    GET  /vuelos/{id}/mis-tiquetes     cuantos tiquetes activos tiene el cliente en el vuelo

Contrato: `frontend/docs/CONTRATO_COMPRAS.md`. Los correos se envian en segundo plano.
"""
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status

from app.core.deps import DbSession, require_roles
from app.modules.compras import notificaciones, service
from app.modules.compras.models import Compra, Reserva
from app.modules.compras.schemas import (
    CancelacionOut,
    CancelarCompraRequest,
    OperacionOut,
    MisTiquetesVuelo,
    PaginaHistorial,
    SolicitudOperacion,
    TiqueteOut,
    VueloRegresoOut,
)
from app.modules.financiero import service as financiero

router = APIRouter(tags=["Compra y reserva"])

_cliente = Depends(require_roles("cliente"))


def operacion_out(op: Reserva | Compra) -> OperacionOut:
    if isinstance(op, Reserva):
        return OperacionOut(
            tipo="reserva", id=op.id, estado=op.estado.value, creada_en=op.creada_en, expira_en=op.expira_en,
            total=sum(t.precio for t in op.tiquetes), id_reserva=None,
            tiquetes=[TiqueteOut.model_validate(t) for t in op.tiquetes],
        )
    return OperacionOut(
        tipo="compra", id=op.id, estado=op.estado.value, creada_en=op.pagada_en, expira_en=None,
        total=op.total, id_reserva=op.id_reserva,
        tiquetes=[TiqueteOut.model_validate(t) for t in op.tiquetes],
    )


# ----------------------------------------------------------------------------- reservas
@router.post("/reservas", response_model=OperacionOut, status_code=status.HTTP_201_CREATED)
def reservar(payload: SolicitudOperacion, db: DbSession, tareas: BackgroundTasks, cliente=_cliente):
    reserva = service.crear_reserva(db, cliente.id, payload.items)
    notificaciones.programar_codigos(db, tareas, reserva)
    return operacion_out(reserva)


@router.get("/reservas/{id_reserva}", response_model=OperacionOut)
def ver_reserva(id_reserva: int, db: DbSession, cliente=_cliente):
    return operacion_out(service.obtener_reserva(db, cliente.id, id_reserva))


@router.post("/reservas/{id_reserva}/comprar", response_model=OperacionOut, status_code=status.HTTP_201_CREATED)
def pagar_reserva(id_reserva: int, db: DbSession, tareas: BackgroundTasks, cliente=_cliente):
    compra = service.comprar_reserva(db, cliente.id, id_reserva)
    notificaciones.programar_codigos(db, tareas, compra)
    return operacion_out(compra)


@router.post("/reservas/{id_reserva}/cancelar", response_model=CancelacionOut)
def cancelar_reserva(id_reserva: int, db: DbSession, cliente=_cliente):
    reserva = service.cancelar_reserva(db, cliente.id, id_reserva)
    return CancelacionOut(operacion=operacion_out(reserva), reintegro=0, saldo=None)


# ----------------------------------------------------------------------------- compras
@router.post("/compras", response_model=OperacionOut, status_code=status.HTTP_201_CREATED)
def comprar(payload: SolicitudOperacion, db: DbSession, tareas: BackgroundTasks, cliente=_cliente):
    compra = service.crear_compra(db, cliente.id, payload.items)
    notificaciones.programar_codigos(db, tareas, compra)
    return operacion_out(compra)


@router.get("/compras/{id_compra}", response_model=OperacionOut)
def ver_compra(id_compra: int, db: DbSession, cliente=_cliente):
    return operacion_out(service.obtener_compra(db, cliente.id, id_compra))


@router.post("/compras/{id_compra}/cancelar", response_model=CancelacionOut)
def cancelar_compra(
    id_compra: int,
    db: DbSession,
    tareas: BackgroundTasks,
    cliente=_cliente,
    payload: CancelarCompraRequest | None = None,
):
    compra, reintegro, cancelados = service.cancelar_compra(
        db, cliente.id, id_compra, payload.tiquete_ids if payload else None
    )
    if reintegro and cliente.correo:
        nombre = " ".join(filter(None, [cliente.nombres, cliente.apellidos])) or cliente.usuario or "cliente"
        datos = notificaciones.preparar_cancelacion(compra, cancelados, reintegro, cliente.correo, nombre)
        notificaciones.programar_cancelacion(db, tareas, compra, datos)
    saldo = financiero.obtener_o_crear_billetera(db, cliente.id).saldo
    return CancelacionOut(operacion=operacion_out(compra), reintegro=reintegro, saldo=saldo)


# ----------------------------------------------------------------------------- historial
@router.get("/mi-historial", response_model=PaginaHistorial)
def mi_historial(
    db: DbSession,
    cliente=_cliente,
    pagina: Annotated[int, Query(ge=1)] = 1,
    tamano: Annotated[int, Query(ge=1, le=50)] = 10,
    tipo: Annotated[str | None, Query(pattern="^(reserva|compra)$", description="Filtra por `reserva` o `compra`.")] = None,
):
    total, operaciones = service.historial(db, cliente.id, pagina, tamano, tipo)
    return PaginaHistorial(total=total, pagina=pagina, tamano=tamano, items=[operacion_out(o) for o in operaciones])


# ----------------------------------------------------------------------------- consultas de apoyo a la pantalla de compra
@router.get("/vuelos/{id_vuelo}/regreso", response_model=list[VueloRegresoOut])
def vuelos_regreso(id_vuelo: int, db: DbSession, cliente=_cliente):
    """Vuelos directos destino -> origen posteriores a la llegada de `id_vuelo` (ida y regreso)."""
    salida = []
    for vuelo, activos in service.vuelos_de_regreso(db, cliente.id, id_vuelo):
        item = VueloRegresoOut.model_validate(vuelo)
        item.tiquetes_cliente = activos
        salida.append(item)
    return salida


@router.get("/vuelos/{id_vuelo}/mis-tiquetes", response_model=MisTiquetesVuelo)
def mis_tiquetes_en_vuelo(id_vuelo: int, db: DbSession, cliente=_cliente):
    activos = service.tiquetes_activos_en_vuelo(db, cliente.id, id_vuelo)
    maximo = service.MAX_TIQUETES_POR_VUELO
    return MisTiquetesVuelo(vuelo_id=id_vuelo, activos=activos, maximo=maximo, disponibles=max(maximo - activos, 0))
