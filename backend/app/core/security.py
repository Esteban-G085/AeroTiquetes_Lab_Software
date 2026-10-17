"""
Seguridad: hashing de contrasenas (bcrypt) y JWT (B1-02).

JWT: firmado con JWT_SECRET, payload minimo {sub, rol, exp, iat}.
Expiracion corta (30 min, RNF06) y sin refresh token: el frontend debe volver
a pedir login cuando expire o cuando detecte inactividad.
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


def create_access_token(*, subject: str, rol: str, extra_claims: dict[str, Any] | None = None) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": subject,
        "rol": rol,
        "iat": now,
        "exp": expire,
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as exc:
        raise TokenError(str(exc)) from exc


# ---------- Tokens de un solo uso (enlace de primer ingreso del admin, D6) ----------

def create_invite_token(*, administrador_id: int, expire_hours: int) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=expire_hours)
    payload = {
        "sub": str(administrador_id),
        "tipo": "invitacion_admin",
        "iat": now,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_invite_token(token: str) -> int:
    """Devuelve el id de administrador si el token es valido; lanza TokenError si no."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as exc:
        raise TokenError(str(exc)) from exc
    if payload.get("tipo") != "invitacion_admin":
        raise TokenError("Tipo de token invalido")
    return int(payload["sub"])
