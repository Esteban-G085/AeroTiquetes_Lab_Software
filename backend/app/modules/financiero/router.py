"""
Rutas de Gestion financiera (HU10). Solo clientes (R16): administrador y root no compran.

    GET    /mi-billetera                  saldo (la crea con saldo 0 si es la primera vez)
    POST   /mi-billetera/agregar-saldo    suma un monto al saldo (unica forma de cambiarlo, R02)
    GET    /mi-billetera/tarjetas         lista las tarjetas
    POST   /mi-billetera/tarjetas         agrega una tarjeta (credito o debito)
    PUT    /mi-billetera/tarjetas/{id}    edita una tarjeta
    DELETE /mi-billetera/tarjetas/{id}    elimina una tarjeta
"""
from fastapi import APIRouter, Depends, status

from app.core.deps import DbSession, require_roles
from app.modules.financiero import service
from app.modules.financiero.schemas import (
    AgregarSaldoRequest,
    BilleteraOut,
    ListaTarjetas,
    TarjetaCrear,
    TarjetaEditar,
    TarjetaOut,
)

router = APIRouter(prefix="/mi-billetera", tags=["Gestion financiera"])

_cliente = Depends(require_roles("cliente"))


@router.get("", response_model=BilleteraOut)
def ver_billetera(db: DbSession, cliente=_cliente):
    return BilleteraOut.model_validate(service.obtener_o_crear_billetera(db, cliente.id))


@router.post("/agregar-saldo", response_model=BilleteraOut)
def agregar_saldo(payload: AgregarSaldoRequest, db: DbSession, cliente=_cliente):
    return BilleteraOut.model_validate(
        service.agregar_saldo(db, cliente.id, payload.monto, payload.id_tarjeta)
    )


@router.get("/tarjetas", response_model=ListaTarjetas)
def listar_tarjetas(db: DbSession, cliente=_cliente):
    return ListaTarjetas(items=[TarjetaOut.model_validate(t) for t in service.listar_tarjetas(db, cliente.id)])


@router.post("/tarjetas", response_model=TarjetaOut, status_code=status.HTTP_201_CREATED)
def agregar_tarjeta(payload: TarjetaCrear, db: DbSession, cliente=_cliente):
    return TarjetaOut.model_validate(service.agregar_tarjeta(db, cliente.id, payload.model_dump()))


@router.put("/tarjetas/{id_tarjeta}", response_model=TarjetaOut)
def editar_tarjeta(id_tarjeta: int, payload: TarjetaEditar, db: DbSession, cliente=_cliente):
    cambios = payload.model_dump(exclude_unset=True)
    return TarjetaOut.model_validate(service.editar_tarjeta(db, cliente.id, id_tarjeta, cambios))


@router.delete("/tarjetas/{id_tarjeta}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_tarjeta(id_tarjeta: int, db: DbSession, cliente=_cliente):
    service.eliminar_tarjeta(db, cliente.id, id_tarjeta)
