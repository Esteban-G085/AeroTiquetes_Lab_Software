"""
Noticias (HU11, B2-15).

    GET    /noticias               cliente y administrador: noticias vigentes
    GET    /noticias/suscripcion   cliente: si esta suscrito y con que correo
    PUT    /noticias/suscripcion   cliente: se suscribe (o cambia el correo)
    DELETE /noticias/suscripcion   cliente: cancela la suscripcion

La noticia de un vuelo se crea al programarlo (ver `service.publicar_noticia`).
"""
from fastapi import APIRouter, Depends, status

from app.core.deps import DbSession, require_roles
from app.modules.noticias import service
from app.modules.noticias.schemas import ListaNoticias, SuscripcionCrear, SuscripcionOut

router = APIRouter(prefix="/noticias", tags=["Noticias"])

_cliente = Depends(require_roles("cliente"))


@router.get("", response_model=ListaNoticias, dependencies=[Depends(require_roles("cliente", "administrador"))])
def listar_noticias(db: DbSession):
    """Noticias de vuelos vigentes: las mas recientes primero. Se retiran a los 8 dias o cuando el vuelo deja de estar programado."""
    return ListaNoticias(items=service.listar_vigentes(db))


@router.get("/suscripcion", response_model=SuscripcionOut)
def ver_suscripcion(db: DbSession, cliente=_cliente):
    return service.obtener_suscripcion(db, cliente)


@router.put("/suscripcion", response_model=SuscripcionOut)
def suscribirse(payload: SuscripcionCrear, db: DbSession, cliente=_cliente):
    return service.suscribir(db, cliente, payload.correo)


@router.delete("/suscripcion", status_code=status.HTTP_204_NO_CONTENT)
def cancelar_suscripcion(db: DbSession, cliente=_cliente):
    service.cancelar_suscripcion(db, cliente)
