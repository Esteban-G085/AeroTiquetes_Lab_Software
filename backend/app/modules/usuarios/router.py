"""
Rutas HTTP del modulo Usuarios (/auth/*, /me, /root/*).

Cada ruta: valida/parsea la entrada, llama al servicio, y devuelve el schema
de salida. La logica de negocio vive en service.py para poder probarla sin
pasar por FastAPI y para mantener el router legible.
"""
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile, status

from app.core.deps import CurrentUser, DbSession, require_roles
from app.core.errors import AppError
from app.modules.usuarios import service
from app.modules.usuarios.models import RolNombre
from app.modules.usuarios.schemas import (
    AdministradorItem,
    CambiarCorreoRequest,
    CambiarPasswordRequest,
    CompletarRegistroAdminRequest,
    CrearAdministradorRequest,
    InvitacionResponse,
    LoginRequest,
    PerfilResponse,
    PerfilUpdate,
    RegistroClienteRequest,
    RolesMatrizResponse,
    TokenResponse,
    UsuarioPublico,
    VerificarCorreoRequest,
    url_imagen,
    validar_formulario,
)

router = APIRouter()


# =========================================================================
# /auth/*
# =========================================================================

@router.post("/auth/login", response_model=TokenResponse, tags=["Autenticacion"])
def login(payload: LoginRequest, db: DbSession):
    usuario = service.autenticar(db, payload.identificador, payload.password)
    token = service.generar_token(usuario)
    return TokenResponse(
        access_token=token,
        expira_en_minutos=30,
        usuario=UsuarioPublico.model_validate(usuario),
    )


@router.post("/auth/registro", response_model=UsuarioPublico, status_code=status.HTTP_201_CREATED, tags=["Autenticacion"])
def registro_cliente(
    db: DbSession,
    dni: Annotated[str, Form()],
    nombres: Annotated[str, Form()],
    apellidos: Annotated[str, Form()],
    fecha_nacimiento: Annotated[date, Form()],
    lugar_nacimiento: Annotated[str, Form()],
    direccion_facturacion: Annotated[str, Form()],
    genero: Annotated[str, Form()],
    correo: Annotated[str, Form()],
    usuario: Annotated[str, Form()],
    password: Annotated[str, Form(min_length=6)],
    telefono: Annotated[str | None, Form()] = None,
    imagen: Annotated[UploadFile | None, File()] = None,
):
    contenido = imagen.file.read() if imagen is not None else None
    if imagen is not None:
        imagen.file.seek(0)
    ruta_imagen = service.guardar_imagen_perfil(imagen, contenido)

    # Se revalida con el schema (no solo con la coercion de tipos de Form)
    # para que reglas como "fecha de nacimiento no futura" tambien se
    # apliquen aqui.
    validado = validar_formulario(
        RegistroClienteRequest,
        dict(
            dni=dni,
            nombres=nombres,
            apellidos=apellidos,
            fecha_nacimiento=fecha_nacimiento,
            lugar_nacimiento=lugar_nacimiento,
            direccion_facturacion=direccion_facturacion,
            genero=genero,
            correo=correo,
            usuario=usuario,
            password=password,
            telefono=telefono,
        ),
    )
    nuevo = service.registrar_cliente(db, validado.model_dump(), ruta_imagen)
    return UsuarioPublico.model_validate(nuevo)


@router.get("/auth/completar-registro", response_model=InvitacionResponse, tags=["Autenticacion"])
def validar_invitacion(token: str, db: DbSession):
    """Valida el enlace del correo (sin consumirlo) y devuelve correo y nombre
    para precargar el formulario. 404/410 si no existe, venció o ya se usó."""
    admin = service.validar_invitacion(db, token)
    return InvitacionResponse(correo=admin.usuario.correo, nombre=admin.nombre_invitacion)


@router.post(
    "/auth/completar-registro",
    response_model=UsuarioPublico,
    status_code=status.HTTP_201_CREATED,
    tags=["Autenticacion"],
)
def completar_registro_administrador(
    db: DbSession,
    token: Annotated[str, Form()],
    dni: Annotated[str, Form()],
    nombres: Annotated[str, Form()],
    apellidos: Annotated[str, Form()],
    fecha_nacimiento: Annotated[date, Form()],
    lugar_nacimiento: Annotated[str, Form()],
    direccion_facturacion: Annotated[str, Form()],
    genero: Annotated[str, Form()],
    correo: Annotated[str, Form()],
    usuario: Annotated[str, Form()],
    password: Annotated[str, Form(min_length=6)],
    telefono: Annotated[str | None, Form()] = None,
    imagen: Annotated[UploadFile | None, File()] = None,
):
    contenido = imagen.file.read() if imagen is not None else None
    if imagen is not None:
        imagen.file.seek(0)
    ruta_imagen = service.guardar_imagen_perfil(imagen, contenido)

    validado = validar_formulario(
        CompletarRegistroAdminRequest,
        dict(
            token=token,
            dni=dni,
            nombres=nombres,
            apellidos=apellidos,
            fecha_nacimiento=fecha_nacimiento,
            lugar_nacimiento=lugar_nacimiento,
            direccion_facturacion=direccion_facturacion,
            genero=genero,
            correo=correo,
            usuario=usuario,
            password=password,
            telefono=telefono,
        ),
    )
    actualizado = service.completar_registro_administrador(db, validado.model_dump(), ruta_imagen)
    return UsuarioPublico.model_validate(actualizado)


@router.post("/auth/verificar-correo", response_model=PerfilResponse, tags=["Autenticacion"])
def verificar_correo(payload: VerificarCorreoRequest, db: DbSession):
    usuario = service.verificar_cambio_correo(db, payload.token)
    return PerfilResponse.model_validate(usuario)


# =========================================================================
# /me
# =========================================================================

@router.get("/me", response_model=PerfilResponse, tags=["Perfil"])
def obtener_mi_perfil(usuario_actual: CurrentUser):
    return PerfilResponse.model_validate(usuario_actual)


@router.put("/me", response_model=PerfilResponse, tags=["Perfil"])
def actualizar_mi_perfil(
    response: Response,
    db: DbSession,
    usuario_actual: CurrentUser,
    nombres: Annotated[str | None, Form()] = None,
    apellidos: Annotated[str | None, Form()] = None,
    fecha_nacimiento: Annotated[str | None, Form()] = None,
    lugar_nacimiento: Annotated[str | None, Form()] = None,
    direccion_facturacion: Annotated[str | None, Form()] = None,
    genero: Annotated[str | None, Form()] = None,
    telefono: Annotated[str | None, Form()] = None,
    imagen: Annotated[UploadFile | None, File()] = None,
    correo_nuevo: Annotated[str | None, Form()] = None,
    password_actual: Annotated[str | None, Form()] = None,
):
    """multipart/form-data (contrato con el front). Dos usos sobre la misma ruta,
    todos los campos opcionales:
    - Editar datos: nombres, apellidos, fecha_nacimiento, lugar_nacimiento,
      direccion_facturacion, genero, telefono (+ `imagen` opcional). Devuelve 200.
    - Cambiar correo: `correo_nuevo` + `password_actual`. Envia el enlace de
      verificacion al correo nuevo y devuelve 202; el correo no cambia hasta
      confirmarlo. El documento (dni) nunca se acepta aqui.
    """
    datos = dict(
        nombres=nombres,
        apellidos=apellidos,
        fecha_nacimiento=fecha_nacimiento,
        lugar_nacimiento=lugar_nacimiento,
        direccion_facturacion=direccion_facturacion,
        genero=genero,
        telefono=telefono,
    )
    # Un campo vacio ("") significa "sin cambio" (el front envia todo el formulario).
    datos = {k: v.strip() for k, v in datos.items() if v is not None and v.strip()}
    validado = validar_formulario(PerfilUpdate, datos)
    cambios = validado.model_dump(exclude_unset=True)

    contenido = imagen.file.read() if imagen is not None else None
    if imagen is not None:
        imagen.file.seek(0)
    ruta_imagen = service.guardar_imagen_perfil(imagen, contenido)

    # Primero el cambio de correo (si la contrasena es incorrecta se rechaza todo
    # antes de guardar nada), luego los datos del perfil.
    if correo_nuevo and correo_nuevo.strip():
        if not password_actual:
            raise AppError(
                "Ingresa tu contrasena actual para cambiar el correo.",
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                code="validacion",
                fields={"password_actual": "Es obligatoria."},
            )
        solicitud = validar_formulario(
            CambiarCorreoRequest, dict(correo_nuevo=correo_nuevo.strip(), password_actual=password_actual)
        )
        service.solicitar_cambio_correo(db, usuario_actual, solicitud.correo_nuevo, solicitud.password_actual)
        response.status_code = status.HTTP_202_ACCEPTED

    actualizado = service.actualizar_perfil(db, usuario_actual, cambios, ruta_imagen)
    return PerfilResponse.model_validate(actualizado)


@router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT, tags=["Perfil"])
def cambiar_password(payload: CambiarPasswordRequest, db: DbSession, usuario_actual: CurrentUser):
    service.cambiar_password(db, usuario_actual, payload.password_actual, payload.password_nueva)


@router.post("/me/correo", status_code=status.HTTP_202_ACCEPTED, tags=["Perfil"])
def solicitar_cambio_correo(payload: CambiarCorreoRequest, db: DbSession, usuario_actual: CurrentUser):
    service.solicitar_cambio_correo(db, usuario_actual, payload.correo_nuevo, payload.password_actual)
    return {"mensaje": "Te enviamos un correo para confirmar el cambio."}


# =========================================================================
# /root/*  (requiere rol root)
# =========================================================================

@router.get(
    "/root/administradores",
    response_model=list[AdministradorItem],
    tags=["Root"],
    dependencies=[Depends(require_roles(RolNombre.ROOT.value))],
)
def listar_administradores(db: DbSession):
    administradores = service.listar_administradores(db)
    return [
        AdministradorItem(
            id=a.id,
            correo=a.usuario.correo,
            nombre=a.nombre_invitacion,
            nombre_invitacion=a.nombre_invitacion,
            estado=a.estado,
            imagen_url=url_imagen(a.usuario.imagen_perfil),
            creado_en=a.usuario.creado_en,
        )
        for a in administradores
    ]


@router.post(
    "/root/administradores",
    response_model=UsuarioPublico,
    status_code=status.HTTP_201_CREATED,
    tags=["Root"],
    dependencies=[Depends(require_roles(RolNombre.ROOT.value))],
)
def crear_administrador(payload: CrearAdministradorRequest, db: DbSession, usuario_actual: CurrentUser):
    nuevo = service.crear_administrador(db, usuario_actual, payload.correo, payload.nombre)
    return UsuarioPublico.model_validate(nuevo)


@router.delete(
    "/root/administradores/{administrador_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Root"],
    dependencies=[Depends(require_roles(RolNombre.ROOT.value))],
)
def eliminar_administrador(administrador_id: int, db: DbSession):
    service.eliminar_administrador(db, administrador_id)


@router.get(
    "/root/roles",
    response_model=RolesMatrizResponse,
    tags=["Root"],
    dependencies=[Depends(require_roles(RolNombre.ROOT.value))],
)
def obtener_matriz_roles(db: DbSession):
    return RolesMatrizResponse(**service.obtener_matriz_roles(db))
