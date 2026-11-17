"""
Noticias de vuelos y suscripcion (HU11, Sprint 2, B2-15).

* Publico: listar noticias vigentes y ver una.
* Cliente: ver, activar y cancelar su suscripcion.
* Publico (enlace del correo): cancelar la suscripcion con el token.

Contrato: `frontend/docs/CONTRATO_ADMIN_VUELOS_NOTICIAS.md`.
"""
from fastapi import APIRouter, Depends, Query, status

from app.core.deps import DbSession, require_roles
from app.core.errors import AppError
from app.modules.noticias import service
from app.modules.noticias.schemas import (
    CancelarPorToken,
    NoticiaCrear,
    NoticiaOut,
    PaginaNoticias,
    SuscripcionCrear,
    SuscripcionOut,
)
from app.modules.noticias.service import noticia_a_schema

router = APIRouter(tags=["Noticias"])

# Solo clientes (el modulo `noticias` se verifica en el frontend).
_SOLO_CLIENTE = Depends(require_roles("cliente"))


def _estado(sus, cliente_correo: str | None = None) -> SuscripcionOut:
    return SuscripcionOut(
        suscrito=sus is not None,
        correo=(sus.correo if sus is not None else cliente_correo),
    )


@router.get("/noticias", response_model=PaginaNoticias)
def listar_noticias(db: DbSession, pagina: int = Query(1, ge=1)):
    """Noticias vigentes (publico), la mas reciente primero.

    Una noticia se muestra mientras su vuelo siga `programado` con salida futura y no hayan pasado
    8 dias desde que se publico.
    """
    total, noticias = service.listar_noticias(db, pagina)
    items = []
    for n in noticias:
        datos = service.noticia_a_schema(n, n.vuelo)
        items.append(NoticiaOut(**datos))
    return PaginaNoticias(
        total=total,
        pagina=pagina,
        tamano=service.TAMANO_PAGINA,
        items=items,
    )


# Las rutas de /noticias/suscripcion van ANTES de /noticias/{id}, para que "suscripcion" no se lea como un id.
@router.get("/noticias/suscripcion", response_model=SuscripcionOut)
def mi_suscripcion(db: DbSession, cliente=_SOLO_CLIENTE):
    """Si el cliente autenticado esta suscrito a las noticias."""
    sus = service.estado_suscripcion(db, cliente.id)
    return _estado(sus, cliente.correo)


@router.put("/noticias/suscripcion", response_model=SuscripcionOut)
def suscribirme(payload: SuscripcionCrear, db: DbSession, cliente=_SOLO_CLIENTE):
    """Suscribe al cliente: recibira por correo cada noticia nueva. Si ya esta suscrito no cambia nada."""
    return _estado(service.suscribir(db, cliente.id, payload.correo), cliente.correo)


@router.delete("/noticias/suscripcion", status_code=status.HTTP_204_NO_CONTENT)
def cancelar_mi_suscripcion(db: DbSession, cliente=_SOLO_CLIENTE):
    """Cancela la suscripcion del cliente autenticado (si no estaba suscrito responde igual)."""
    service.cancelar_suscripcion(db, cliente.id)
    return None


@router.post("/noticias/suscripcion/cancelar", response_model=SuscripcionOut)
def cancelar_con_token(datos: CancelarPorToken, db: DbSession):
    """Cancela la suscripcion desde el enlace del correo, sin iniciar sesion (publico).

    El front abre `/cancelar-suscripcion?token=...` y llama a esta ruta. 404 `token_invalido` si el token no existe.
    """
    service.cancelar_por_token(db, datos.token)
    return SuscripcionOut(suscrito=False, correo=None)


@router.get("/noticias/{id}", response_model=NoticiaOut)
def consultar_noticia(id: int, db: DbSession):
    """Una noticia vigente (publico). 404 si no existe o ya no se muestra."""
    noticia = service.obtener_noticia(db, id)
    if noticia is None:
        raise AppError("La noticia no existe.", status_code=status.HTTP_404_NOT_FOUND, code="noticia_no_encontrada")
    datos = service.noticia_a_schema(noticia, noticia.vuelo)
    return NoticiaOut(**datos)


# --------------------------------------------------------------------------- administrador: crear noticia
@router.post(
    "/admin/noticias",
    response_model=NoticiaOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles("administrador"))],
)
def crear_noticia_admin(payload: NoticiaCrear, db: DbSession):
    """Crea una noticia manualmente (solo administrador)."""
    noticia = service.crear_noticia_manual(
        db,
        id_vuelo=payload.id_vuelo,
        tipo=payload.tipo,
        titulo=payload.titulo,
        contenido=payload.contenido,
        imagen_url=payload.imagen_url,
        vigente_hasta=payload.vigente_hasta,
    )
    db.commit()
    db.refresh(noticia)
    vuelo = noticia.vuelo if noticia.id_vuelo else None
    datos = service.noticia_a_schema(noticia, vuelo)
    return NoticiaOut(**datos)
