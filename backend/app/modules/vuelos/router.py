"""
Ciudades y administracion de vuelos (HU5 catalogo, HU18 y HU19).

Lectura (B2-06, B2-07) y programacion de vuelos (B2-05) sobre la base de datos.

Contrato: `frontend/docs/CONTRATO_VUELOS.md`.
"""
from fastapi import APIRouter, BackgroundTasks, Depends, Query, status

from app.core.deps import DbSession, require_roles
from app.core.errors import AppError
from app.modules.noticias import service as noticias
from app.modules.vuelos import service
from app.modules.vuelos.models import EstadoVuelo
from app.modules.vuelos.schemas import (
    CiudadOut,
    ListaCiudades,
    ListaVuelosAdmin,
    PaginaVuelosAdmin,
    UsoCiudad,
    VueloAdminOut,
    VueloCancelar,
    VueloCrear,
    VueloEditar,
    VueloOut,
    vuelo_admin,
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
    response_model=PaginaVuelosAdmin,
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
    vendidos = service.tiquetes_vendidos(db, [v.id for v in vuelos])
    return PaginaVuelosAdmin(
        total=total, pagina=pagina, tamano=service.TAMANO_PAGINA,
        items=[vuelo_admin(v, vendidos[v.id]) for v in vuelos],
    )


@router.get(
    "/admin/vuelos/realizados",
    response_model=ListaVuelosAdmin,
    tags=["Administracion de vuelos"],
    dependencies=[_SOLO_ADMIN],
)
def listar_vuelos_realizados(db: DbSession):
    """Historico (HU14): vuelos `sucedido` y `realizado`, el mas reciente primero, con `tiquetes_vendidos`.

    El paso a `sucedido` (llego la hora de salida) y a `realizado` (aterrizo) es automatico (HU22)."""
    vuelos = service.listar_realizados(db)
    vendidos = service.tiquetes_vendidos(db, [v.id for v in vuelos])
    return ListaVuelosAdmin(total=len(vuelos), items=[vuelo_admin(v, vendidos[v.id]) for v in vuelos])


@router.get(
    "/admin/vuelos/{id}",
    response_model=VueloAdminOut,
    tags=["Administracion de vuelos"],
    dependencies=[_SOLO_ADMIN],
)
def consultar_vuelo_admin(id: int, db: DbSession):
    """Detalle de solo lectura de un vuelo (HU19), con `tiquetes_vendidos`. 404 si no existe."""
    vuelo = service.consultar_vuelo(db, id)
    if vuelo is None:
        raise AppError("El vuelo no existe.", status_code=status.HTTP_404_NOT_FOUND, code="vuelo_no_encontrado")
    return vuelo_admin(vuelo, service.tiquetes_vendidos(db, [vuelo.id])[vuelo.id])


@router.post(
    "/admin/vuelos",
    response_model=VueloOut,
    status_code=status.HTTP_201_CREATED,
    tags=["Administracion de vuelos"],
)
def programar_vuelo(
    datos: VueloCrear,
    db: DbSession,
    tareas: BackgroundTasks,
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
    vuelo = service.programar_vuelo(db, datos, administrador.id)
    # Su noticia ya se creo (gancho de `service.programar_vuelo`); a los suscritos se les avisa por correo en segundo plano.
    tareas.add_task(noticias.enviar, noticias.preparar_envios(db, vuelo))
    return VueloOut.model_validate(vuelo)


@router.put(
    "/admin/vuelos/{id}",
    response_model=VueloAdminOut,
    tags=["Administracion de vuelos"],
    dependencies=[_SOLO_ADMIN],
)
def editar_vuelo(id: int, datos: VueloEditar, db: DbSession):
    """Edita un vuelo (HU12): fecha, hora (hora de Colombia), origen, destino, duracion y costo.

    Solo si sigue `programado`, no ha salido y no tiene tiquetes vendidos ni reservados: si no, 409 con el motivo
    (`vuelo_con_tiquetes`, `vuelo_sucedido`, `vuelo_realizado`, `vuelo_cancelado`). 422 con `fields` si algun dato no es valido.
    """
    vuelo, vendidos = service.editar_vuelo(db, id, datos)
    return vuelo_admin(vuelo, vendidos)


@router.patch(
    "/admin/vuelos/{id}/cancelar",
    response_model=VueloAdminOut,
    tags=["Administracion de vuelos"],
    dependencies=[_SOLO_ADMIN],
)
def cancelar_vuelo(id: int, db: DbSession, datos: VueloCancelar | None = None):
    """Cancela un vuelo programado (HU13) y libera sus cupos.

    Con tiquetes vendidos solo se permite por fuerza mayor: `motivo` obligatorio (10 a 300 caracteres, 422 `fields.motivo`).
    Los tiquetes comprados se reintegran a la billetera de cada cliente y las reservas se cancelan.
    No se cancela un vuelo que ya salio, se realizo o ya esta cancelado (409).
    """
    vuelo, _ = service.cancelar_vuelo(db, id, datos or VueloCancelar())
    return vuelo_admin(vuelo, 0)
