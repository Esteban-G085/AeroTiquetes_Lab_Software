"""
Dependencias de FastAPI compartidas: sesion de BD, usuario autenticado actual
y verificacion de rol (B1-02, B1-03).

`require_roles(...)` es la pieza que el resto del sistema (incluyendo los
modulos de Vuelos y Busqueda que construira B2) reutiliza para proteger
rutas por rol, tal como lo pide la seccion 5.3 del plan de sprint.
"""
from typing import Annotated

from fastapi import Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.errors import AppError
from app.core.security import TokenError, decode_access_token

DbSession = Annotated[Session, Depends(get_db)]


# Declara el esquema "Bearer" en OpenAPI: es lo que hace aparecer el boton
# "Authorize" en /docs. auto_error=False para que el error siga usando el
# formato unico de la API (AppError) en lugar del de FastAPI.
bearer_scheme = HTTPBearer(auto_error=False, description="Pega aqui solo el access_token (sin la palabra Bearer).")


def _extraer_token(credenciales: HTTPAuthorizationCredentials | None) -> str:
    if credenciales is None or not credenciales.credentials:
        raise AppError(
            "No se encontro un token de autenticacion valido.",
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="no_autenticado",
        )
    return credenciales.credentials.strip()


def get_current_user(
    db: DbSession,
    credenciales: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
):
    """Decodifica el JWT, carga el usuario y lo retorna. 401 si el token no es
    valido/esta vencido, o si el usuario ya no existe."""
    # Import diferido para evitar ciclo de importacion core <-> modules.usuarios
    from app.modules.usuarios.models import Usuario

    token = _extraer_token(credenciales)
    try:
        payload = decode_access_token(token)
    except TokenError as exc:
        raise AppError(
            "El token no es valido o ha expirado. Inicia sesion de nuevo.",
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="token_invalido",
        ) from exc

    usuario_id = payload.get("sub")
    usuario = db.get(Usuario, int(usuario_id)) if usuario_id else None
    if usuario is None:
        raise AppError(
            "El usuario asociado al token ya no existe.",
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="no_autenticado",
        )
    return usuario


CurrentUser = Annotated[object, Depends(get_current_user)]


def require_roles(*roles_permitidos: str, modulo: str | None = None):
    """Fabrica de dependencias: `Depends(require_roles("root", "administrador"))`.

    Si la lista esta vacia, solo exige estar autenticado (cualquier rol).
    Si se pasa `modulo`, ademas del rol se consulta la matriz rol x modulo
    (HU24) para que activar/desactivar un modulo desde `/root/roles` tenga
    efecto real sobre el acceso, no solo informativo."""

    def _dependencia(db: DbSession, usuario=Depends(get_current_user)):
        if roles_permitidos and usuario.rol not in roles_permitidos:
            raise AppError(
                "No tienes permisos para realizar esta accion.",
                status_code=status.HTTP_403_FORBIDDEN,
                code="permiso_denegado",
            )
        if modulo is not None:
            # Import diferido: evita el ciclo core <-> modules.usuarios
            from app.modules.usuarios.service import modulo_habilitado

            if not modulo_habilitado(db, usuario.rol, modulo):
                raise AppError(
                    "Este modulo esta desactivado para tu rol.",
                    status_code=status.HTTP_403_FORBIDDEN,
                    code="modulo_desactivado",
                )
        return usuario

    return _dependencia
