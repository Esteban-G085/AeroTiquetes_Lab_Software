"""
Ciudades y administracion de vuelos (HU5 catalogo, HU18 y HU19).

Lectura (B2-06, B2-07) y programacion (B2-05) sobre la base de datos.

Contrato: `frontend/docs/CONTRATO_VUELOS.md`.
"""
from fastapi import APIRouter, Depends, Query, status

from app.core.deps import DbSession, require_roles
from app.core.errors import AppError
from app.modules.vuelos import service
from app.modules.vuelos.models import EstadoVuelo
from app.modules.vuelos.schemas import (
    AsientoOut,
    CiudadOut,
    ListaCiudades,
    PaginaVuelos,
    UsoCiudad,
    VueloCancelar,
    VueloCrear,
    VueloEditar,
    VueloOut,
    vuelo_con_tiquetes_vendidos,
)

router = APIRouter()

# Solo administradores.
_SOLO_ADMIN = Depends(require_roles("administrador"))


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
    ids = [v.id for v in vuelos]
    conteo = service.contar_tiquetes_vendidos(db, ids)
    items = [vuelo_con_tiquetes_vendidos(v, conteo.get(v.id, 0)) for v in vuelos]
    return PaginaVuelos(total=total, pagina=pagina, tamano=service.TAMANO_PAGINA, items=items)


@router.get(
    "/admin/vuelos/realizados",
    response_model=PaginaVuelos,
    tags=["Administracion de vuelos"],
    dependencies=[_SOLO_ADMIN],
)
def listar_vuelos_realizados(
    db: DbSession,
    estado: EstadoVuelo | None = Query(None, description="`sucedido` o `realizado`; sin valor, ambos"),
    origen: str | None = Query(None, description="Codigo de ciudad, ej. BOG"),
    destino: str | None = Query(None, description="Codigo de ciudad, ej. MDE"),
    pagina: int = Query(1, ge=1),
):
    """Vuelos realizados (HU14): los que estan en estado `sucedido` o `realizado`, el mas reciente primero.

    Antes de listar se actualizan los estados por el paso del tiempo (`programado` -> `sucedido` ->
    `realizado`). Para marcar a mano un vuelo como `realizado` use `PUT /admin/vuelos/{id}` con `estado`.
    """
    if estado is not None and estado not in (EstadoVuelo.SUCEDIDO, EstadoVuelo.REALIZADO):
        raise AppError(
            "Los datos enviados no son validos.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="validacion",
            fields={"query.estado": "Solo se permite `sucedido` o `realizado`."},
        )
    service.sincronizar_estados(db)
    total, vuelos = service.listar_vuelos_realizados(db, estado=estado, origen=origen, destino=destino, pagina=pagina)
    ids = [v.id for v in vuelos]
    conteo = service.contar_tiquetes_vendidos(db, ids)
    items = [vuelo_con_tiquetes_vendidos(v, conteo.get(v.id, 0)) for v in vuelos]
    return PaginaVuelos(total=total, pagina=pagina, tamano=service.TAMANO_PAGINA, items=items)


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
    conteo = service.contar_tiquetes_vendidos(db, [vuelo.id])
    return vuelo_con_tiquetes_vendidos(vuelo, conteo.get(vuelo.id, 0))


@router.get(
    "/admin/vuelos/{id}/asientos",
    response_model=list[AsientoOut],
    tags=["Administracion de vuelos"],
    dependencies=[Depends(require_roles("cliente", "administrador"))],
)
def listar_asientos_vuelo(id: int, db: DbSession):
    """Lista los asientos individuales de un vuelo con su estado (disponible/ocupado)."""
    vuelo = service.consultar_vuelo(db, id)
    if vuelo is None:
        raise AppError("El vuelo no existe.", status_code=status.HTTP_404_NOT_FOUND, code="vuelo_no_encontrado")
    return service.obtener_asientos_vuelo(db, id)


@router.put(
    "/admin/vuelos/{id}",
    response_model=VueloOut,
    tags=["Administracion de vuelos"],
    dependencies=[_SOLO_ADMIN],
)
def editar_vuelo(id: int, datos: VueloEditar, db: DbSession):
    """Edita un vuelo (HU12): fecha, hora (de Colombia), origen, destino, duracion y costo.

    * Solo se editan los vuelos `programado` (409 `vuelo_no_editable`).
    * Mismas reglas que al programar (422 `validacion` con `error.fields`). El tipo se deduce de las ciudades.
    * Si `estado` viene y es distinto del actual, el vuelo SOLO cambia de estado y se ignoran los demas
      datos: `cancelado` (libera cupos), `sucedido` (si ya salio) o `realizado` (si ya llego).
      Una transicion no permitida da 409 `transicion_invalida`.
    * El codigo no cambia; la llegada se recalcula.
    """
    vuelo = service.editar_vuelo(db, id, datos)
    conteo = service.contar_tiquetes_vendidos(db, [vuelo.id])
    return vuelo_con_tiquetes_vendidos(vuelo, conteo.get(vuelo.id, 0))


@router.patch(
    "/admin/vuelos/{id}/cancelar",
    response_model=VueloOut,
    tags=["Administracion de vuelos"],
    dependencies=[_SOLO_ADMIN],
)
def cancelar_vuelo(id: int, datos: VueloCancelar, db: DbSession):
    """Cancela un vuelo `programado` (HU13): pasa a `cancelado` y libera sus cupos.

    Si el vuelo tiene tiquetes vendidos, `motivo` es obligatorio (causa de fuerza mayor, minimo 10
    caracteres). 404 si no existe; 409 si ya esta cancelado o ya salio; 422 si falta el motivo.
    """
    vuelo = service.cancelar_vuelo(db, id, datos.motivo)
    conteo = service.contar_tiquetes_vendidos(db, [vuelo.id])
    return vuelo_con_tiquetes_vendidos(vuelo, conteo.get(vuelo.id, 0))


@router.post(
    "/admin/vuelos",
    response_model=VueloOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Administracion de vuelos"],
)
def programar_vuelo(
    datos: VueloCrear,
    db: DbSession,
    administrador=Depends(require_roles("administrador")),
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
