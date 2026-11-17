"""
Seguridad: hashing de contrasenas (bcrypt) y JWT (B1-02).

JWT: firmado con JWT_SECRET. Hay tres tipos con claims incompatibles entre si:

* `access`: {sub, rol, tipo, exp, iat} — autentica las APIs (30 min, RNF06).
* `invitacion_admin`: enlace de primer ingreso del administrador (D6).
* `verificacion_correo`: enlace para confirmar el cambio de correo.

`decode_access_token` exige `tipo=access` y `rol`, asi un token de correo nunca
puede usarse como credencial de API aunque tenga la misma firma.
"""
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings

settings = get_settings()


# ---------- Contrasenas ----------

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        # hash corrupto o vacio: nunca debe autenticar
        return False


# ---------- JWT ----------

class TokenError(Exception):
    """Token invalido, mal formado o expirado."""


def _firmar(payload: dict[str, Any]) -> str:
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def _decodificar(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as exc:
        raise TokenError(str(exc)) from exc


def create_access_token(*, subject: str, rol: str, extra_claims: dict[str, Any] | None = None) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": subject,
        "rol": rol,
        "tipo": "access",
        "iat": now,
        "exp": expire,
    }
    if extra_claims:
        # Un claim extra nunca debe poder cambiar el tipo del token.
        payload.update({k: v for k, v in extra_claims.items() if k != "tipo"})
    return _firmar(payload)


def decode_access_token(token: str) -> dict[str, Any]:
    payload = _decodificar(token)
    if payload.get("tipo") != "access" or not payload.get("rol") or not payload.get("sub"):
        raise TokenError("Tipo de token invalido")
    return payload


# ---------- Tokens de un solo uso (enlace de primer ingreso del admin, D6) ----------

def create_invite_token(*, administrador_id: int, expire_hours: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(administrador_id),
        "tipo": "invitacion_admin",
        "iat": now,
        "exp": now + timedelta(hours=expire_hours),
    }
    return _firmar(payload)


def decode_invite_token(token: str) -> int:
    """Devuelve el id de administrador si el token es valido; lanza TokenError si no."""
    payload = _decodificar(token)
    if payload.get("tipo") != "invitacion_admin" or not payload.get("sub"):
        raise TokenError("Tipo de token invalido")
    return int(payload["sub"])


# ---------- Token de un solo uso para verificar el cambio de correo (HU5) ----------

def create_verification_token(*, usuario_id: int, expire_hours: int = 48) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(usuario_id),
        "tipo": "verificacion_correo",
        "iat": now,
        "exp": now + timedelta(hours=expire_hours),
    }
    return _firmar(payload)


def decode_verification_token(token: str) -> int:
    """Devuelve el id de usuario si el token es de verificacion; lanza TokenError si no."""
    payload = _decodificar(token)
    if payload.get("tipo") != "verificacion_correo" or not payload.get("sub"):
        raise TokenError("Tipo de token invalido")
    return int(payload["sub"])
