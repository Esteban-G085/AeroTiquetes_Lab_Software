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

    # --- Entorno ---
    # "desarrollo" (default) o "produccion". Solo produccion endurece CORS y secretos.
    APP_ENV: str = "desarrollo"

    # --- Base de datos ---
    DATABASE_URL: str = "postgresql+psycopg://aerotiquetes:aerotiquetes@localhost:5432/aerotiquetes"

    # --- JWT / seguridad ---
    JWT_SECRET: str = "cambia-este-secreto-en-produccion"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 30

    # --- Root por defecto (HU1, HU23 - D7 del plan) ---
    ROOT_ID: str = "root"
    ROOT_PASSWORD: str = "root1234"

    # --- Correo (Gmail por defecto) ---
    # Al arrancar la app se usa SMTP real: 587 con STARTTLS (o 465 con
    # SMTP_USE_SSL=true). Solo si se configura explicitamente un host local
    # de prueba se omite la validacion de credenciales.
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str = "no-responder@aerotiquetes.local"
    # 587 -> STARTTLS (SMTP_USE_TLS); 465 -> SSL directo (SMTP_USE_SSL).
    # SMTP_FORCE_TLS=true convierte la falla de negociacion en error (la bandeja
    # de salida conserva el correo para reintentarlo) en vez de enviar en claro.
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    SMTP_FORCE_TLS: bool = False

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

    @property
    def es_produccion(self) -> bool:
        return self.APP_ENV.strip().lower() in {"produccion", "production", "prod"}

    @property
    def es_smtp_local(self) -> bool:
        """SMTP de prueba local: no requiere credenciales ni TLS."""
        host = (self.SMTP_HOST or "").strip().lower().rstrip(".")
        return host in {"localhost", "127.0.0.1", "::1", "mailpit"} or host.startswith("mailpit.")

    def validar_correo(self) -> None:
        """Se llama al arrancar: un SMTP remoto (Gmail) necesita credenciales y TLS.

        Con un SMTP local de prueba no exige nada para no romper las pruebas ni
        el desarrollo sin internet. Nunca incluye la contraseña en el mensaje.
        """
        if self.es_smtp_local:
            return
        falta = []
        if not self.SMTP_USER:
            falta.append("SMTP_USER")
        if not self.SMTP_PASSWORD:
            falta.append("SMTP_PASSWORD")
        if not (self.SMTP_USE_TLS or self.SMTP_USE_SSL):
            falta.append("SMTP_USE_TLS o SMTP_USE_SSL")
        if falta:
            raise RuntimeError(
                f"Configuracion de correo incompleta para {self.SMTP_HOST}:{self.SMTP_PORT} "
                f"(faltan {', '.join(falta)}). Configura una contrasena de aplicacion de Gmail "
                "en backend/.env o configura explicitamente un SMTP local de prueba."
            )

    def validar_seguridad_produccion(self) -> None:
        """Se llama al arrancar: en produccion no se aceptan los secretos de ejemplo."""
        if not self.es_produccion:
            return
        inseguros = []
        if self.JWT_SECRET == "cambia-este-secreto-en-produccion":
            inseguros.append("JWT_SECRET")
        if self.ROOT_PASSWORD == "root1234":
            inseguros.append("ROOT_PASSWORD")
        if inseguros:
            raise RuntimeError(
                "Configuracion insegura en produccion: cambia " + ", ".join(inseguros) + " antes de arrancar."
            )


@lru_cache
def get_settings() -> Settings:
    """Cacheado: toda la app comparte la misma instancia de Settings."""
    return Settings()
