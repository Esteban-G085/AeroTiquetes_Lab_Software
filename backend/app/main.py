"""
Punto de entrada de la aplicacion FastAPI.

Responsable de: CORS para el frontend (Vite), manejo de errores unico,
montar los routers de cada modulo, servir archivos estaticos (imagenes de
perfil) y, al arrancar, sembrar el root por defecto y la matriz de roles
(B1-01).

Para correr en desarrollo:  uvicorn app.main:app --reload --port 8000
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.db import session_scope
from app.core.errors import register_error_handlers
from app.modules.busqueda.router import router as busqueda_router
from app.modules.usuarios.router import router as usuarios_router
from app.modules.usuarios.service import asegurar_root_por_defecto, asegurar_roles_y_matriz
from app.modules.vuelos.router import router as vuelos_router
from app.modules.vuelos.seeds import asegurar_ciudades

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Arranque: root por defecto (R17-19) y matriz de roles (HU24), ambos
    # idempotentes para que correr la app varias veces no duplique nada.
    with session_scope() as db:
        asegurar_root_por_defecto(db)
        asegurar_roles_y_matriz(db)
        asegurar_ciudades(db)  # catalogo de ciudades (B2-04), idempotente
    yield


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


@app.get("/salud", tags=["Sistema"])
def salud():
    """Chequeo simple de disponibilidad, util para el healthcheck de docker-compose."""
    return {"estado": "ok"}
