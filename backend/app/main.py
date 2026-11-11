"""
Punto de entrada de la aplicacion FastAPI.

Responsable de: CORS para el frontend (Vite), manejo de errores unico,
montar los routers de cada modulo, servir archivos estaticos (imagenes de
perfil) y, al arrancar, sembrar el root por defecto y la matriz de roles
(B1-01).

Para correr en desarrollo:  uvicorn app.main:app --reload --port 8000
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.db import session_scope
from app.core.errors import register_error_handlers
from app.modules.busqueda.router import router as busqueda_router
from app.modules.catalogos import models as _catalogos_models  # noqa: F401
from app.modules.catalogos.router import router as catalogos_router
from app.modules.catalogos.seeds import asegurar_paises
from app.modules.noticias.router import router as noticias_router
from app.modules.usuarios.router import router as usuarios_router
from app.modules.usuarios.service import asegurar_root_por_defecto, asegurar_roles_y_matriz
from app.modules.vuelos.router import router as vuelos_router
from app.modules.vuelos.seeds import asegurar_ciudades
from app.modules.vuelos.service import sincronizar_estados

settings = get_settings()

# Cada cuanto se actualizan los estados de los vuelos por el paso del tiempo (HU14).
INTERVALO_ESTADOS_SEGUNDOS = 15 * 60


def _sincronizar_estados() -> None:
    with session_scope() as db:
        cambiados = sincronizar_estados(db)
    if cambiados:
        logging.getLogger("aerotiquetes.vuelos").info("Estados de vuelos actualizados: %s", cambiados)


async def _ciclo_estados() -> None:
    while True:
        await asyncio.sleep(INTERVALO_ESTADOS_SEGUNDOS)
        try:
            await asyncio.to_thread(_sincronizar_estados)
        except Exception:  # un fallo puntual no debe detener el ciclo
            logging.getLogger("aerotiquetes.vuelos").exception("No se pudieron actualizar los estados de vuelos")

# Logs de la aplicacion visibles en la terminal (por ejemplo, si un correo no se
# pudo enviar). Sin esto, los INFO de `aerotiquetes.email` no se muestran.
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Arranque: root por defecto (R17-19) y matriz de roles (HU24), ambos
    # idempotentes para que correr la app varias veces no duplique nada.
    with session_scope() as db:
        asegurar_root_por_defecto(db)
        asegurar_roles_y_matriz(db)
        asegurar_ciudades(db)  # catalogo de ciudades (B2-04), idempotente
        asegurar_paises(db)  # catalogo de paises para lugar de nacimiento
        sincronizar_estados(db)  # programado -> sucedido -> realizado segun la hora (HU14)
    ciclo = asyncio.create_task(_ciclo_estados())
    try:
        yield
    finally:
        ciclo.cancel()


app = FastAPI(
    title="AeroTiquetes API",
    description=(
        "Sistema de gestion de compra y reserva de tiquetes aereos en linea. "
        "Sprint 1: modulo de Usuarios (cuentas, roles) y base de Vuelos/Busqueda."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

app.mount("/static", StaticFiles(directory="static"), name="static")

# Cada modulo expone su propio router; se montan todos bajo el mismo app para
# que /docs y /openapi.json reflejen el contrato completo (B1-00 / B2-00).
app.include_router(usuarios_router)
app.include_router(vuelos_router)
app.include_router(busqueda_router)
app.include_router(catalogos_router)
app.include_router(noticias_router)


@app.get("/salud", tags=["Sistema"])
def salud():
    """Chequeo simple de disponibilidad, util para el healthcheck de docker-compose."""
    return {"estado": "ok"}
