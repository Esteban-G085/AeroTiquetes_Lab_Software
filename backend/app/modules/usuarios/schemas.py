"""
Schemas Pydantic v2 del modulo Usuarios.

Estos son el "contrato de API" que menciona el plan (B1-00): FastAPI genera
/docs y /openapi.json directamente a partir de ellos, asi que F1 puede
generar sus mocks de MSW en cuanto este archivo y las rutas esqueleto existan.
"""
from datetime import date, datetime
from typing import Type, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field, ValidationError, computed_field, field_validator

from app.core.errors import AppError
from app.modules.usuarios.models import EstadoAdministrador, RolNombre

_T = TypeVar("_T", bound=BaseModel)


def validar_formulario(schema_cls: Type[_T], datos: dict) -> _T:
    """Valida un dict (tipicamente construido a partir de parametros
    `Form(...)` de una ruta multipart/form-data) contra un schema Pydantic,
    para que reglas como 'fecha de nacimiento no futura' tambien se apliquen
    ahi, no solo en rutas JSON. Traduce `ValidationError` al formato de error
    unico de la API (seccion 5.3 del plan de sprint)."""
    try:
        return schema_cls(**datos)
    except ValidationError as exc:
        fields: dict[str, str] = {}
        for err in exc.errors():
            loc = ".".join(str(p) for p in err["loc"])
            fields[loc or "body"] = err["msg"]
        raise AppError(
            "Los datos enviados no son validos.",
            status_code=422,
            code="validacion",
            fields=fields,
        ) from exc


def url_imagen(ruta: str | None) -> str | None:
    """Ruta guardada en la base (ej. 'static/perfiles/x.png', o con '\\' si se
    guardo desde Windows) -> ruta publica que el front usa en <img> ('/static/...').
    El front le antepone la URL base de la API (resolveMediaUrl)."""
    if not ruta:
        return None
    limpia = ruta.replace("\\", "/").lstrip("/")
    return f"/{limpia}"


# ---------- Login ----------

class LoginRequest(BaseModel):
    identificador: str = Field(..., description="Usuario, correo, o Id de root", min_length=1)
    password: str = Field(..., min_length=1)


class UsuarioPublico(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rol: RolNombre
    usuario: str | None = None
    correo: str | None = None
    nombres: str | None = None
    apellidos: str | None = None
    imagen_perfil: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expira_en_minutos: int
    usuario: UsuarioPublico


# ---------- Perfil (/me) ----------

class PerfilResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    rol: RolNombre
    usuario: str | None = None
    correo: str | None = None
    correo_pendiente: str | None = None
    dni: str | None = None
    nombres: str | None = None
    apellidos: str | None = None
    fecha_nacimiento: date | None = None
    lugar_nacimiento: str | None = None
    direccion_facturacion: str | None = None
    genero: str | None = None
    telefono: str | None = None
    imagen_perfil: str | None = None

    @computed_field  # nombre que espera el front (CONTRATO_USUARIOS.md)
    @property
    def imagen_url(self) -> str | None:
        return url_imagen(self.imagen_perfil)


class PerfilUpdate(BaseModel):
    """Campos editables del perfil propio. El documento (dni) nunca se acepta
    aqui (es inmutable, HU2); el correo tampoco (tiene su propio flujo
    verificado, ver CambiarCorreoRequest)."""

    nombres: str | None = Field(default=None, min_length=1, max_length=100)
    apellidos: str | None = Field(default=None, min_length=1, max_length=100)
    fecha_nacimiento: date | None = None
    lugar_nacimiento: str | None = Field(default=None, min_length=1, max_length=150)
    direccion_facturacion: str | None = Field(default=None, min_length=1, max_length=255)
    genero: str | None = Field(default=None, min_length=1, max_length=30)
    telefono: str | None = Field(default=None, max_length=30)

    @field_validator("fecha_nacimiento")
    @classmethod
    def fecha_no_futura(cls, v: date | None) -> date | None:
        if v is not None and v > date.today():
            raise ValueError("La fecha de nacimiento no puede ser futura.")
        return v


class CambiarPasswordRequest(BaseModel):
    password_actual: str = Field(..., min_length=1)
    password_nueva: str = Field(..., min_length=6)


class CambiarCorreoRequest(BaseModel):
    correo_nuevo: EmailStr
    password_actual: str = Field(..., min_length=1)


class VerificarCorreoRequest(BaseModel):
    token: str


# ---------- Registro (cliente) y completar-registro (administrador) ----------
# Los campos de archivo (imagen) se reciben aparte, como UploadFile, porque la
# ruta usa multipart/form-data (B1-05); estos modelos documentan el resto.

class RegistroClienteRequest(BaseModel):
    dni: str = Field(..., min_length=3, max_length=30)
    nombres: str = Field(..., min_length=1, max_length=100)
    apellidos: str = Field(..., min_length=1, max_length=100)
    fecha_nacimiento: date
    lugar_nacimiento: str = Field(..., min_length=1, max_length=150)
    direccion_facturacion: str = Field(..., min_length=1, max_length=255)
    genero: str = Field(..., min_length=1, max_length=30)
    correo: EmailStr
    usuario: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    telefono: str | None = Field(default=None, max_length=30)

    @field_validator("fecha_nacimiento")
    @classmethod
    def fecha_no_futura(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("La fecha de nacimiento no puede ser futura.")
        return v


class CompletarRegistroAdminRequest(BaseModel):
    token: str
    dni: str = Field(..., min_length=3, max_length=30)
    nombres: str = Field(..., min_length=1, max_length=100)
    apellidos: str = Field(..., min_length=1, max_length=100)
    fecha_nacimiento: date
    lugar_nacimiento: str = Field(..., min_length=1, max_length=150)
    direccion_facturacion: str = Field(..., min_length=1, max_length=255)
    genero: str = Field(..., min_length=1, max_length=30)
    correo: EmailStr
    usuario: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    telefono: str | None = Field(default=None, max_length=30)

    @field_validator("fecha_nacimiento")
    @classmethod
    def fecha_no_futura(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("La fecha de nacimiento no puede ser futura.")
        return v


# ---------- Root: administradores (HU23) ----------

class CrearAdministradorRequest(BaseModel):
    correo: EmailStr
    nombre: str = Field(..., min_length=1, max_length=150)


class AdministradorItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    correo: str | None
    nombre: str  # nombre que escribio el root al invitar (el front lo muestra tal cual)
    nombre_invitacion: str
    estado: EstadoAdministrador
    imagen_url: str | None = None
    creado_en: datetime


class InvitacionResponse(BaseModel):
    """Respuesta de GET /auth/completar-registro?token=... (precarga el formulario)."""

    correo: str
    nombre: str


# ---------- Root: matriz de roles (HU24) ----------
# Forma acordada con el front (docs/CONTRATO_USUARIOS.md de F1): una fila por rol
# con un mapa {modulo: permitido}, y la lista de modulos con su nombre legible.

class ModuloItem(BaseModel):
    id: str
    nombre: str


class RolItem(BaseModel):
    id: RolNombre
    nombre: str
    descripcion: str
    editable: bool  # False para root: no puede quitarse su propio acceso
    modulos: dict[str, bool]


class RolesMatrizResponse(BaseModel):
    modulos: list[ModuloItem]
    roles: list[RolItem]
