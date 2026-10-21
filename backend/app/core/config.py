"""
Configuracion centralizada de la aplicacion, leida desde variables de entorno.

Todo el resto del codigo (DB, seguridad, correo, CORS) lee de aqui en vez de
usar os.environ directamente, para tener un solo punto de verdad y poder
sobre-escribir valores facilmente en los tests (ver tests/conftest.py).
"""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Base de datos ---
    DATABASE_URL: str = "postgresql+psycopg://aerotiquetes:aerotiquetes@localhost:5432/aerotiquetes"

    # --- JWT / seguridad ---
    JWT_SECRET: str = "cambia-este-secreto-en-produccion"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 30

    # --- Root por defecto (HU1, HU23 - D7 del plan) ---
    ROOT_ID: str = "root"
    ROOT_PASSWORD: str = "root1234"

    # --- Correo (Mailpit en desarrollo) ---
    SMTP_HOST: str = "localhost"
    SMTP_PORT: int = 1025
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str = "no-responder@aerotiquetes.local"

    # --- Integracion con el frontend ---
    FRONTEND_URL: str = "http://localhost:5173"
    # El preflight CORS compara el origen de forma exacta: si el front se abre en
    # `http://127.0.0.1:5173` (la URL de red que muestra Vite) y no esta aqui, el
    # navegador recibe un 400 y bloquea todas las llamadas a la API.
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # --- Admin: vencimiento del enlace de primer ingreso (D6) ---
    ADMIN_INVITE_EXPIRE_HOURS: int = 48

    # --- Imagen de perfil (D10) ---
    MAX_IMAGE_SIZE_BYTES: int = 2 * 1024 * 1024  # 2 MB
    PERFILES_DIR: str = "static/perfiles"

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    """Cacheado: toda la app comparte la misma instancia de Settings."""
    return Settings()
