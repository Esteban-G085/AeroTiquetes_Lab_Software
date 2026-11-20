"""
Logica de la billetera simulada (HU10, B1-16).

`debitar` y `acreditar` las usa el modulo de compras (pago y reintegro). Son operaciones
atomicas en SQL (`UPDATE ... WHERE saldo >= monto`), asi dos compras simultaneas nunca dejan
el saldo en negativo. No hacen commit: el que llama controla la transaccion.

Cada cambio de saldo deja un `MovimientoBilletera` de auditoria interna (no se expone en la
API: R19/R20 excluyen historial y comprobantes visibles para el cliente).
"""
from datetime import date

from fastapi import status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.financiero.models import Billetera, MovimientoBilletera, Tarjeta, TipoMovimiento


def obtener_o_crear_billetera(db: Session, id_cliente: int) -> Billetera:
    """La billetera se crea con saldo 0 la primera vez que el cliente la necesita."""
    billetera = db.scalar(select(Billetera).where(Billetera.id_cliente == id_cliente))
    if billetera is not None:
        return billetera
    try:
        with db.begin_nested():
            billetera = Billetera(id_cliente=id_cliente, saldo=0)
            db.add(billetera)
            db.flush()
    except IntegrityError:  # otra peticion la creo al mismo tiempo
        billetera = db.scalar(select(Billetera).where(Billetera.id_cliente == id_cliente))
    db.commit()
    return billetera


def _tarjeta_vigente(tarjeta: Tarjeta) -> bool:
    """La tarjeta pudo vencer desde que se registro: se revisa de nuevo al recargar."""
    try:
        mes, anio = (int(parte) for parte in tarjeta.fecha_expiracion.split("/"))
        return 1 <= mes <= 12 and (anio, mes) >= (date.today().year, date.today().month)
    except (AttributeError, TypeError, ValueError):
        return False


def agregar_saldo(db: Session, id_cliente: int, monto: int, id_tarjeta: int) -> Billetera:
    """Recarga condicionada a una tarjeta propia y vigente.

    No se pide el CVV: la tarjeta ya esta registrada y se elige por su id. La
    tarjeta usada se guarda en el movimiento de auditoria, nunca se expone al
    cliente mas alla del id que el mismo selecciono.
    """
    billetera = obtener_o_crear_billetera(db, id_cliente)
    tarjeta = db.scalar(
        select(Tarjeta).where(Tarjeta.id == id_tarjeta, Tarjeta.id_billetera == billetera.id)
    )
    if tarjeta is None:
        raise AppError(
            "Selecciona una tarjeta registrada a tu nombre.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="tarjeta_recarga_invalida",
            fields={"id_tarjeta": "Selecciona una tarjeta registrada."},
        )
    if not _tarjeta_vigente(tarjeta):
        raise AppError(
            "La tarjeta seleccionada esta vencida.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="tarjeta_recarga_invalida",
            fields={"id_tarjeta": "La tarjeta esta vencida."},
        )

    acreditar(
        db, billetera.id, monto,
        tipo=TipoMovimiento.RECARGA, referencia="recarga", id_tarjeta=tarjeta.id,
    )
    db.commit()
    db.refresh(billetera)
    return billetera


def _registrar_movimiento(
    db: Session,
    id_billetera: int,
    tipo: TipoMovimiento,
    monto: int,
    referencia: str | None,
    id_tarjeta: int | None = None,
) -> None:
    """Audita el cambio ya aplicado, leyendo el saldo dentro de la misma transaccion."""
    saldo = db.scalar(select(Billetera.saldo).where(Billetera.id == id_billetera))
    db.add(
        MovimientoBilletera(
            id_billetera=id_billetera,
            tipo=tipo,
            monto=monto,
            saldo_resultante=saldo,
            referencia=referencia,
            id_tarjeta=id_tarjeta,
        )
    )


def acreditar(
    db: Session,
    id_billetera: int,
    monto: int,
    *,
    tipo: TipoMovimiento = TipoMovimiento.REINTEGRO,
    referencia: str | None = None,
    id_tarjeta: int | None = None,
) -> None:
    db.flush()
    db.execute(update(Billetera).where(Billetera.id == id_billetera).values(saldo=Billetera.saldo + monto))
    _registrar_movimiento(db, id_billetera, tipo, monto, referencia, id_tarjeta=id_tarjeta)
    db.expire_all()


def debitar(
    db: Session,
    id_billetera: int,
    monto: int,
    *,
    tipo: TipoMovimiento = TipoMovimiento.COMPRA,
    referencia: str | None = None,
) -> None:
    """Descuenta `monto`; 402 si no alcanza el saldo (R14-R16)."""
    db.flush()
    res = db.execute(
        update(Billetera).where(Billetera.id == id_billetera, Billetera.saldo >= monto).values(saldo=Billetera.saldo - monto)
    )
    if res.rowcount == 0:
        raise AppError(
            "Saldo insuficiente para realizar la compra. Agrega saldo a tu billetera.",
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            code="saldo_insuficiente",
        )
    _registrar_movimiento(db, id_billetera, tipo, -monto, referencia)
    db.expire_all()


# ----------------------------------------------------------------------------- tarjetas
def listar_tarjetas(db: Session, id_cliente: int) -> list[Tarjeta]:
    return list(obtener_o_crear_billetera(db, id_cliente).tarjetas)


def _tarjeta_del_cliente(db: Session, id_cliente: int, id_tarjeta: int) -> Tarjeta:
    billetera = obtener_o_crear_billetera(db, id_cliente)
    tarjeta = db.get(Tarjeta, id_tarjeta)
    if tarjeta is None or tarjeta.id_billetera != billetera.id:
        raise AppError("La tarjeta no existe.", status_code=status.HTTP_404_NOT_FOUND, code="tarjeta_no_encontrada")
    return tarjeta


def _exigir_numero_libre(db: Session, id_billetera: int, numero: str, excluir_id: int | None = None) -> None:
    consulta = select(Tarjeta.id).where(Tarjeta.id_billetera == id_billetera, Tarjeta.numero == numero)
    if excluir_id is not None:
        consulta = consulta.where(Tarjeta.id != excluir_id)
    if db.scalar(consulta) is not None:
        raise AppError(
            "Ya registraste una tarjeta con ese numero.",
            status_code=status.HTTP_409_CONFLICT,
            code="tarjeta_duplicada",
            fields={"numero": "Ya esta registrada."},
        )


def agregar_tarjeta(db: Session, id_cliente: int, datos: dict) -> Tarjeta:
    billetera = obtener_o_crear_billetera(db, id_cliente)
    _exigir_numero_libre(db, billetera.id, datos["numero"])
    tarjeta = Tarjeta(id_billetera=billetera.id, **datos)
    db.add(tarjeta)
    db.commit()
    db.refresh(tarjeta)
    return tarjeta


def editar_tarjeta(db: Session, id_cliente: int, id_tarjeta: int, cambios: dict) -> Tarjeta:
    tarjeta = _tarjeta_del_cliente(db, id_cliente, id_tarjeta)
    if cambios.get("numero"):
        _exigir_numero_libre(db, tarjeta.id_billetera, cambios["numero"], excluir_id=tarjeta.id)
    for campo, valor in cambios.items():
        if valor is not None:
            setattr(tarjeta, campo, valor)
    db.commit()
    db.refresh(tarjeta)
    return tarjeta


def eliminar_tarjeta(db: Session, id_cliente: int, id_tarjeta: int) -> None:
    tarjeta = _tarjeta_del_cliente(db, id_cliente, id_tarjeta)
    db.delete(tarjeta)
    db.commit()
