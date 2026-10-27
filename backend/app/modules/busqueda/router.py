"""
Busqueda publica de vuelos (HU5): visitante y cliente, sin autenticacion.

Lee de la base de datos (B2-08 busqueda, B2-09 detalle). Si quien busca es un cliente autenticado,
guarda el historial de busquedas (B2-11); el visitante busca igual, sin dejar rastro.

Contrato: `frontend/docs/CONTRATO_VUELOS.md`.
"""
from datetime import date

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BeforeValidator

from app.core.deps import DbSession, bearer_scheme
from app.core.errors import AppError
from app.core.security import TokenError, decode_access_token
from app.core.validators import clean_positive_int
from app.modules.vuelos import service
from app.modules.vuelos.schemas import ClaseVuelo, OrdenVuelos, PaginaVuelos, VueloOut

router = APIRouter(tags=["Busqueda de vuelos"])

PrecioQuery = Annotated[int | None, BeforeValidator(clean_positive_int), Query(alias="precioMin")]
DuracionQuery = Annotated[int | None, BeforeValidator(clean_positive_int), Query(alias="duracionMin")]
DuracionQueryMax = Annotated[int | None, BeforeValidator(clean_positive_int), Query(alias="duracionMax")]
PrecioQueryMax = Annotated[int | None, BeforeValidator(clean_positive_int), Query(alias="precioMax")]


def cliente_opcional(
    db: DbSession,
    credenciales: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
):
    """El cliente autenticado, o None (visitante, otro rol o token invalido).

    La busqueda es publica: aqui NUNCA se responde 401. Un token vencido se trata como visitante.
    """
    if credenciales is None or not credenciales.credentials:
        return None
    from app.modules.usuarios.models import Usuario  # import diferido: evita el ciclo core <-> usuarios

    try:
        payload = decode_access_token(credenciales.credentials.strip())
        usuario = db.get(Usuario, int(payload["sub"]))
    except (TokenError, KeyError, TypeError, ValueError):
        return None
    return usuario if usuario is not None and usuario.rol == "cliente" else None


@router.get("/vuelos", response_model=PaginaVuelos)
def buscar_vuelos(
    db: DbSession,
    origen: str | None = Query(None, description="Codigo de ciudad, ej. BOG"),
    destino: str | None = Query(None, description="Codigo de ciudad, ej. MDE"),
    fecha: date | None = Query(None, description="Dia de salida (YYYY-MM-DD) en hora de Colombia"),
    precio_min: PrecioQuery = None,
    precio_max: PrecioQueryMax = None,
    duracion_min: DuracionQuery = None,
    duracion_max: DuracionQueryMax = None,
    clase: ClaseVuelo | None = Query(
        None, description="NO oculta vuelos (D13): la pantalla destaca la disponibilidad de esa clase."
    ),
    orden: OrdenVuelos = OrdenVuelos.FECHA_ASC,
    pagina: int = Query(1, ge=1),
    cliente=Depends(cliente_opcional),
):
    """Busca vuelos con criterios opcionales y combinables.

    Solo devuelve vuelos `programado` con salida futura (D16), SIN ocultar los que no tienen
    cupo (D13). Si nada coincide responde `total: 0` e `items: []` (la pantalla muestra "no
    existen vuelos"). Orden por defecto: salida ascendente.

    Si quien busca es un cliente autenticado (`Authorization: Bearer`), se guarda en su historial el
    origen, destino y fecha de la busqueda (solo la primera pagina, para no repetirla al paginar).
    """
    # `clase` se acepta y se valida pero no filtra: ver D13.
    total, vuelos = service.buscar_vuelos(
        db,
        origen=origen,
        destino=destino,
        fecha=fecha,
        precio_min=precio_min,
        precio_max=precio_max,
        duracion_min=duracion_min,
        duracion_max=duracion_max,
        orden=orden,
        pagina=pagina,
    )
    resultado = PaginaVuelos.armar(total, vuelos, pagina, service.TAMANO_PAGINA)
    if cliente is not None and pagina == 1:
        service.registrar_busqueda(db, cliente.id, origen=origen, destino=destino, fecha=fecha)
    return resultado


@router.get("/vuelos/{id}", response_model=VueloOut)
def detalle_vuelo(id: int, db: DbSession):
    """Detalle publico de un vuelo (visitante y cliente). 404 si no existe."""
    vuelo = service.consultar_vuelo(db, id)
    if vuelo is None:
        raise AppError("El vuelo no existe.", status_code=status.HTTP_404_NOT_FOUND, code="vuelo_no_encontrado")
    return VueloOut.model_validate(vuelo)
