"""
Ciudades y administracion de vuelos (HU5 catalogo, HU18 y HU19).

Lectura (B2-06, B2-07) y programacion de vuelos (B2-05) sobre la base de datos.

Contrato: `frontend/docs/CONTRATO_VUELOS.md`.
"""
from fastapi import APIRouter, Depends, Query, status

from app.core.deps import DbSession, require_roles
from app.core.errors import AppError
from app.modules.vuelos import service
from app.modules.vuelos.models import EstadoVuelo
from app.modules.vuelos.schemas import (
    CiudadOut,
    ListaCiudades,
    PaginaVuelos,
    UsoCiudad,
    VueloCrear,
    VueloOut,
)

router = APIRouter()

# Solo administradores, y ademas el modulo debe estar activo en la matriz de roles (HU24).
_SOLO_ADMIN = Depends(require_roles("administrador", modulo="administracion_vuelos"))


# ---------------------------------------------------------------------------
# Publico
# ---------------------------------------------------------------------------
@router.get("/ciudades", response_model=ListaCiudades, tags=["Ciudades"])
def listar_ciudades(db: DbSession, uso: UsoCiudad | None = None):
    """Catalogo de ciudades para poblar los selects (publico), en orden alfabetico.

    - sin `uso`: todas las ciudades.
    - `uso=nacional`: las capitales de departamento.
    - `uso=internacional`: las ciudades con `grupo_internacional` (`colombia` o `exterior`).
    """
    ciudades = service.listar_ciudades(db, uso)
    return ListaCiudades(items=[CiudadOut.model_validate(c) for c in ciudades])


# ---------------------------------------------------------------------------
# Administrador
# ---------------------------------------------------------------------------
@router.get(
    "/admin/vuelos",
    response_model=PaginaVuelos,
    tags=["Administracion de vuelos"],
    dependencies=[_SOLO_ADMIN],
)
def listar_vuelos_admin(
    db: DbSession,
    estado: EstadoVuelo | None = None,
    origen: str | None = Query(None, description="Codigo de ciudad, ej. BOG"),
    destino: str | None = Query(None, description="Codigo de ciudad, ej. MDE"),
    pagina: int = Query(1, ge=1),
):
    """Panel del administrador (HU19): todos los vuelos, el de salida mas reciente primero.

    Filtros opcionales: `estado`, `origen`, `destino`.
    """
    total, vuelos = service.listar_vuelos_admin(db, estado=estado, origen=origen, destino=destino, pagina=pagina)
    return PaginaVuelos.armar(total, vuelos, pagina, service.TAMANO_PAGINA)


@router.get(
    "/admin/vuelos/{id}",
    response_model=VueloOut,
    tags=["Administracion de vuelos"],
    dependencies=[_SOLO_ADMIN],
)
def consultar_vuelo_admin(id: int, db: DbSession):
    """Detalle de solo lectura de un vuelo (HU19). 404 si no existe."""
    vuelo = service.consultar_vuelo(db, id)
    if vuelo is None:
        raise AppError("El vuelo no existe.", status_code=status.HTTP_404_NOT_FOUND, code="vuelo_no_encontrado")
    return VueloOut.model_validate(vuelo)


@router.post(
    "/admin/vuelos",
    response_model=VueloOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Administracion de vuelos"],
)
def programar_vuelo(
    datos: VueloCrear,
    db: DbSession,
    administrador=Depends(require_roles("administrador", modulo="administracion_vuelos")),
):
    """Programa un vuelo (HU18) y lo guarda.

    El administrador solo digita tipo, origen, destino, fecha, hora (hora de Colombia), duracion y
    costo. El sistema genera el codigo `AT-####`, la llegada (salida + duracion), los cupos por
    tipo y el estado `programado`, y registra al administrador que lo programo.

    Reglas (422 `validacion`, con el mensaje en `error.fields`): origen distinto de destino; fecha
    y hora futuras; nacional = dos capitales de departamento; internacional = una ciudad del grupo
    `colombia` y una del `exterior`, en cualquier sentido.
    """
    return VueloOut.model_validate(service.programar_vuelo(db, datos, administrador.id))
