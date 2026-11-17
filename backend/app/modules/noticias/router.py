"""
Noticias de vuelos y suscripcion (HU11, Sprint 2, B2-15).

* Publico: listar noticias vigentes y ver una.
* Cliente: ver, activar y cancelar su suscripcion.
* Publico (enlace del correo): cancelar la suscripcion con el token.

Contrato: `frontend/docs/CONTRATO_NOTICIAS.md`.
"""
from fastapi import APIRouter, Depends, File, Form, Query, status, UploadFile

from app.core.deps import DbSession, require_roles
from app.core.config import get_settings
from app.core.errors import AppError
from app.modules.noticias import service
from app.modules.noticias.schemas import (
    CancelarPorToken,
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
    dependencies=Depends(require_roles("administrador", "root")),
)
async def crear_noticia_admin(
    db: DbSession,
    id_vuelo: str | None = Form(None, description="ID del vuelo vinculado (opcional)."),
    tipo: str = Form("vuelo", max_length=20, description="Tipo de noticia."),
    titulo: str | None = Form(None, max_length=200, description="Titulo de la noticia."),
    contenido: str | None = Form(None, description="Contenido/cuerpo de la noticia."),
    imagen: UploadFile | None = File(None, description="Imagen alusiva (archivo desde tu PC)."),
    vigente_hasta: str | None = Form(None, description="Fecha hasta la que esta vigente (ISO 8601)."),
):
    """Crea una noticia manualmente (solo administrador). Soporta subir imagen desde el PC."""
    from datetime import datetime, timedelta, timezone

    settings = get_settings()
    imagen_url = None

    # Guardar imagen subida en static/noticias/
    if imagen is not None:
        import os
        upload_dir = "static/noticias"
        os.makedirs(upload_dir, exist_ok=True)
        ext = os.path.splitext(imagen.filename or "")[1] or ".jpg"
        nombre_archivo = f"noticia_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}{ext}"
        ruta_archivo = os.path.join(upload_dir, nombre_archivo)
        contenido_archivo = await imagen.read()
        with open(ruta_archivo, "wb") as f:
            f.write(contenido_archivo)
        imagen_url = f"/static/noticias/{nombre_archivo}"

    # Convertir id_vuelo a int si viene
    id_vuelo_int: int | None = None
    if id_vuelo and id_vuelo.strip():
        try:
            id_vuelo_int = int(id_vuelo)
        except ValueError:
            raise AppError("El ID de vuelo no es valido.", status_code=422, code="id_vuelo_invalido")

    # Convertir vigente_hasta
    vigente_hasta_dt: datetime | None = None
    if vigente_hasta and vigente_hasta.strip():
        try:
            vigente_hasta_dt = datetime.fromisoformat(vigente_hasta)
        except ValueError:
            raise AppError("La fecha de vigencia no es valida.", status_code=422, code="vigente_hasta_invalida")

    noticia = service.crear_noticia_manual(
        db,
        id_vuelo=id_vuelo_int,
        tipo=tipo,
        titulo=titulo,
        contenido=contenido,
        imagen_url=imagen_url,
        vigente_hasta=vigente_hasta_dt,
    )
    db.commit()
    db.refresh(noticia)
    vuelo = noticia.vuelo if noticia.id_vuelo else None
    datos = service.noticia_a_schema(noticia, vuelo)
    return NoticiaOut(**datos)
