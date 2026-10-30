"""
Logica de negocio del modulo Usuarios. El router solo valida la entrada HTTP
y delega aqui; esto hace el servicio reutilizable (por ejemplo, desde los
tests o desde una futura tarea en segundo plano) sin pasar por FastAPI.
"""
import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core import email
from app.core.errors import AppError
from app.core.security import (
    create_access_token,
    create_invite_token,
    decode_invite_token,
    hash_password,
    verify_password,
)
from app.core.security import TokenError
from app.modules.catalogos.service import obtener_pais_canonico
from app.modules.usuarios.models import (
    MODULOS_NOMBRES,
    MODULOS_SISTEMA,
    Administrador,
    Cliente,
    EstadoAdministrador,
    Rol,
    RolModulo,
    RolNombre,
    Root,
    Usuario,
)

settings = get_settings()


# =========================================================================
# Arranque: root por defecto + matriz de roles (B1-01)
# =========================================================================

def asegurar_root_por_defecto(db: Session) -> None:
    """Crea el usuario root si no existe. Idempotente: se llama en cada
    arranque de la aplicacion (ver app/main.py)."""
    existente = db.scalar(select(Usuario).where(Usuario.rol == RolNombre.ROOT))
    if existente:
        return

    usuario = Usuario(
        rol=RolNombre.ROOT,
        usuario=settings.ROOT_ID,
        password_hash=hash_password(settings.ROOT_PASSWORD),
        activo=True,
    )
    db.add(usuario)
    db.flush()  # para tener usuario.id antes de crear la fila hija
    db.add(Root(id=usuario.id))
    db.commit()


# Permisos por defecto de la matriz HU24 (editable despues por el root).
_MATRIZ_POR_DEFECTO: dict[RolNombre, set[str]] = {
    RolNombre.ROOT: {"usuarios", "busqueda"},
    RolNombre.ADMINISTRADOR: {"administracion_vuelos", "busqueda", "noticias"},
    RolNombre.CLIENTE: {
        "usuarios",
        "compra_reserva",
        "busqueda",
        "noticias",
        "gestion_financiera",
        "checkin_silla",
        "recomendacion",
        "chatbot",
    },
    RolNombre.VISITANTE: {"usuarios", "busqueda"},
}


def asegurar_roles_y_matriz(db: Session) -> None:
    """Siembra los 4 roles fijos y, por cada uno, una fila por modulo del
    SRS (9 en total) si todavia no existen. Idempotente."""
    roles_existentes = {r.nombre: r for r in db.scalars(select(Rol))}

    for rol_nombre in RolNombre:
        rol = roles_existentes.get(rol_nombre)
        if rol is None:
            rol = Rol(nombre=rol_nombre)
            db.add(rol)
            db.flush()
            roles_existentes[rol_nombre] = rol

        modulos_existentes = {rm.modulo for rm in db.scalars(select(RolModulo).where(RolModulo.rol_id == rol.id))}
        permitidos_por_defecto = _MATRIZ_POR_DEFECTO.get(rol_nombre, set())
        for modulo in MODULOS_SISTEMA:
            if modulo in modulos_existentes:
                continue
            db.add(RolModulo(rol_id=rol.id, modulo=modulo, permitido=modulo in permitidos_por_defecto))

    db.commit()


def modulo_habilitado(db: Session, rol: RolNombre, modulo: str) -> bool:
    """Usada por `require_roles(..., modulo=...)` en core/deps para aplicar
    realmente la matriz de HU24, no solo mostrarla."""
    fila = db.scalar(
        select(RolModulo).join(Rol).where(Rol.nombre == rol, RolModulo.modulo == modulo)
    )
    # Si todavia no existe la fila (no deberia pasar tras el seed), no se
    # bloquea por un dato faltante: se deja pasar y se confia en require_roles.
    return True if fila is None else fila.permitido


# =========================================================================
# Login (B1-04)
# =========================================================================

def autenticar(db: Session, identificador: str, password: str) -> Usuario:
    usuario = db.scalar(
        select(Usuario).where(
            (Usuario.usuario == identificador) | (Usuario.correo == identificador)
        )
    )
    mensaje_generico = "Usuario o contrasena incorrectos."

    if usuario is None or usuario.password_hash is None:
        raise AppError(mensaje_generico, status_code=status.HTTP_401_UNAUTHORIZED, code="credenciales_invalidas")

    if usuario.rol == RolNombre.ADMINISTRADOR and usuario.administrador and usuario.administrador.estado == EstadoAdministrador.PENDIENTE:
        raise AppError(
            "Esta cuenta de administrador aun no ha completado su registro.",
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="administrador_pendiente",
        )

    if not usuario.activo:
        raise AppError(mensaje_generico, status_code=status.HTTP_401_UNAUTHORIZED, code="credenciales_invalidas")

    if not verify_password(password, usuario.password_hash):
        raise AppError(mensaje_generico, status_code=status.HTTP_401_UNAUTHORIZED, code="credenciales_invalidas")

    return usuario


def generar_token(usuario: Usuario) -> str:
    return create_access_token(subject=str(usuario.id), rol=usuario.rol.value)


# =========================================================================
# Registro de cliente (B1-05)
# =========================================================================

def _validar_unicidad(db: Session, *, dni: str | None, correo: str, nombre_usuario: str, excluir_id: int | None = None) -> None:
    fields: dict[str, str] = {}

    query_correo = select(Usuario).where(Usuario.correo == correo)
    query_usuario = select(Usuario).where(Usuario.usuario == nombre_usuario)
    if excluir_id is not None:
        query_correo = query_correo.where(Usuario.id != excluir_id)
        query_usuario = query_usuario.where(Usuario.id != excluir_id)

    if db.scalar(query_correo):
        fields["correo"] = "Ya existe una cuenta con este correo."
    if db.scalar(query_usuario):
        fields["usuario"] = "Este nombre de usuario ya esta en uso."
    if dni:
        query_dni = select(Usuario).where(Usuario.dni == dni)
        if excluir_id is not None:
            query_dni = query_dni.where(Usuario.id != excluir_id)
        if db.scalar(query_dni):
            fields["dni"] = "Ya existe una cuenta con este documento."

    if fields:
        raise AppError(
            "Alguno de los datos ya esta registrado.",
            status_code=status.HTTP_409_CONFLICT,
            code="dato_duplicado",
            fields=fields,
        )


def guardar_imagen_perfil(imagen: UploadFile | None, contenido: bytes | None) -> str | None:
    if imagen is None or not contenido:
        return None

    tipos_permitidos = {"image/jpeg": ".jpg", "image/png": ".png"}
    extension = tipos_permitidos.get(imagen.content_type or "")
    if extension is None:
        raise AppError(
            "La imagen de perfil debe ser JPG o PNG.",
            code="imagen_invalida",
            fields={"imagen": "Formato no soportado."},
        )
    if len(contenido) > settings.MAX_IMAGE_SIZE_BYTES:
        raise AppError(
            "La imagen de perfil no puede superar 2 MB.",
            code="imagen_invalida",
            fields={"imagen": "Archivo demasiado grande."},
        )

    os.makedirs(settings.PERFILES_DIR, exist_ok=True)
    nombre_archivo = f"{uuid.uuid4().hex}{extension}"
    ruta = os.path.join(settings.PERFILES_DIR, nombre_archivo)
    with open(ruta, "wb") as f:
        f.write(contenido)
    # En Windows os.path.join usa '\\'; se guarda siempre con '/' para que la
    # URL publica (/static/perfiles/...) funcione en cualquier sistema.
    return ruta.replace("\\", "/")


def registrar_cliente(db: Session, datos: dict, ruta_imagen: str | None) -> Usuario:
    _validar_unicidad(db, dni=datos["dni"], correo=datos["correo"], nombre_usuario=datos["usuario"])

    pais = obtener_pais_canonico(db, datos.get("lugar_nacimiento") or "")
    if pais is None:
        raise AppError(
            "El lugar de nacimiento no es válido. Debes seleccionarlo de la lista de países.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="lugar_nacimiento_invalido",
            fields={"lugar_nacimiento": "No es un país válido o no está habilitado."},
        )

    usuario = Usuario(
        rol=RolNombre.CLIENTE,
        usuario=datos["usuario"],
        correo=datos["correo"],
        password_hash=hash_password(datos["password"]),
        dni=datos["dni"],
        nombres=datos["nombres"],
        apellidos=datos["apellidos"],
        fecha_nacimiento=datos["fecha_nacimiento"],
        lugar_nacimiento=pais.nombre,
        direccion_facturacion=datos["direccion_facturacion"],
        genero=datos["genero"],
        telefono=datos.get("telefono"),
        imagen_perfil=ruta_imagen,
        activo=True,
    )
    db.add(usuario)
    db.flush()
    db.add(Cliente(id=usuario.id))
    db.commit()
    db.refresh(usuario)
    return usuario


# =========================================================================
# Perfil (/me) (B1-06, B1-07)
# =========================================================================

def actualizar_perfil(db: Session, usuario: Usuario, cambios: dict, ruta_imagen: str | None = None) -> Usuario:
    # El documento nunca se toca aqui (ya lo garantiza el schema PerfilUpdate,
    # que no expone ese campo); el correo tampoco (ver solicitar_cambio_correo).
    for campo, valor in cambios.items():
        if valor is None:
            continue
        if campo == "lugar_nacimiento":
            pais = obtener_pais_canonico(db, valor)
            if pais is None:
                raise AppError(
                    "El lugar de nacimiento no es válido. Debes seleccionarlo de la lista de países.",
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    code="lugar_nacimiento_invalido",
                    fields={"lugar_nacimiento": "No es un país válido o no está habilitado."},
                )
            setattr(usuario, campo, pais.nombre)
            continue
        setattr(usuario, campo, valor)
    if ruta_imagen:
        usuario.imagen_perfil = ruta_imagen
    db.commit()
    db.refresh(usuario)
    return usuario


def cambiar_password(db: Session, usuario: Usuario, actual: str, nueva: str) -> None:
    if not usuario.password_hash or not verify_password(actual, usuario.password_hash):
        raise AppError(
            "La contrasena actual no es correcta.",
            status_code=status.HTTP_400_BAD_REQUEST,
            code="password_incorrecta",
            fields={"password_actual": "No coincide con la contrasena registrada."},
        )
    usuario.password_hash = hash_password(nueva)
    db.commit()


def solicitar_cambio_correo(db: Session, usuario: Usuario, correo_nuevo: str, password_actual: str) -> None:
    if not usuario.password_hash or not verify_password(password_actual, usuario.password_hash):
        raise AppError(
            "La contrasena actual no es correcta.",
            status_code=status.HTTP_400_BAD_REQUEST,
            code="password_incorrecta",
            fields={"password_actual": "No coincide con la contrasena registrada."},
        )
    if db.scalar(select(Usuario).where(Usuario.correo == correo_nuevo, Usuario.id != usuario.id)):
        raise AppError(
            "Ya existe una cuenta con ese correo.",
            status_code=status.HTTP_409_CONFLICT,
            code="dato_duplicado",
            fields={"correo_nuevo": "Ya esta en uso."},
        )

    usuario.correo_pendiente = correo_nuevo
    db.commit()

    token = create_invite_token(administrador_id=usuario.id, expire_hours=48)
    email.enviar_verificacion_cambio_correo(correo_nuevo=correo_nuevo, token=token)


def verificar_cambio_correo(db: Session, token: str) -> Usuario:
    try:
        usuario_id = decode_invite_token(token)
    except TokenError as exc:
        raise AppError(
            "El enlace de verificacion no es valido o ha expirado.",
            status_code=status.HTTP_400_BAD_REQUEST,
            code="token_invalido",
        ) from exc

    usuario = db.get(Usuario, usuario_id)
    if usuario is None or not usuario.correo_pendiente:
        raise AppError(
            "No hay un cambio de correo pendiente para este enlace.",
            status_code=status.HTTP_400_BAD_REQUEST,
            code="sin_cambio_pendiente",
        )

    usuario.correo = usuario.correo_pendiente
    usuario.correo_pendiente = None
    db.commit()
    db.refresh(usuario)
    return usuario


# =========================================================================
# Root: administradores (B1-08)
# =========================================================================

def crear_administrador(db: Session, root: Usuario, correo: str, nombre: str) -> Usuario:
    if db.scalar(select(Usuario).where(Usuario.correo == correo)):
        raise AppError(
            "Ya existe una cuenta con ese correo.",
            status_code=status.HTTP_409_CONFLICT,
            code="dato_duplicado",
            fields={"correo": "Ya esta en uso."},
        )

    usuario = Usuario(rol=RolNombre.ADMINISTRADOR, correo=correo, activo=True)
    db.add(usuario)
    db.flush()

    token = create_invite_token(administrador_id=usuario.id, expire_hours=settings.ADMIN_INVITE_EXPIRE_HOURS)
    expira_en = datetime.now(timezone.utc) + timedelta(hours=settings.ADMIN_INVITE_EXPIRE_HOURS)
    admin = Administrador(
        id=usuario.id,
        estado=EstadoAdministrador.PENDIENTE,
        nombre_invitacion=nombre,
        invitado_por_id=root.id,
        token_invitacion=token,
        token_expira_en=expira_en,
    )
    db.add(admin)
    db.commit()
    db.refresh(usuario)

    email.enviar_invitacion_administrador(
        correo=correo, nombre=nombre, token=token, horas_vencimiento=settings.ADMIN_INVITE_EXPIRE_HOURS
    )
    return usuario


def listar_administradores(db: Session) -> list[Administrador]:
    return list(db.scalars(select(Administrador).order_by(Administrador.id)))


def eliminar_administrador(db: Session, administrador_id: int) -> None:
    usuario = db.get(Usuario, administrador_id)
    if usuario is None or usuario.rol != RolNombre.ADMINISTRADOR:
        raise AppError(
            "El administrador indicado no existe.",
            status_code=status.HTTP_404_NOT_FOUND,
            code="no_encontrado",
        )
    db.delete(usuario)  # cascada elimina la fila hija `administrador`
    db.commit()


def validar_invitacion(db: Session, token: str) -> Administrador:
    """Comprueba el enlace de invitacion SIN consumirlo (GET /auth/completar-registro).
    410 = vencido o ya usado, 404 = no existe; el front muestra 'Enlace no valido'."""
    try:
        administrador_id = decode_invite_token(token)
    except TokenError as exc:
        raise AppError(
            "El enlace de invitacion no es valido o ha vencido.",
            status_code=status.HTTP_410_GONE,
            code="invitacion_vencida",
        ) from exc

    admin = db.get(Administrador, administrador_id)
    if admin is None:
        raise AppError("La invitacion no existe.", status_code=status.HTTP_404_NOT_FOUND, code="no_encontrado")
    if admin.estado != EstadoAdministrador.PENDIENTE or admin.token_invitacion != token:
        raise AppError(
            "Esta invitacion ya fue utilizada o fue reemplazada.",
            status_code=status.HTTP_410_GONE,
            code="invitacion_usada",
        )
    return admin


def completar_registro_administrador(db: Session, datos: dict, ruta_imagen: str | None) -> Usuario:
    try:
        administrador_id = decode_invite_token(datos["token"])
    except TokenError as exc:
        raise AppError(
            "El enlace de invitacion no es valido o ha expirado.",
            status_code=status.HTTP_400_BAD_REQUEST,
            code="token_invalido",
        ) from exc

    usuario = db.get(Usuario, administrador_id)
    if usuario is None or usuario.rol != RolNombre.ADMINISTRADOR or usuario.administrador is None:
        raise AppError("La invitacion no corresponde a un administrador valido.", code="token_invalido")
    if usuario.administrador.estado != EstadoAdministrador.PENDIENTE:
        raise AppError(
            "Esta invitacion ya fue utilizada.",
            status_code=status.HTTP_400_BAD_REQUEST,
            code="invitacion_usada",
        )
    if usuario.administrador.token_invitacion != datos["token"]:
        raise AppError("El enlace de invitacion no es valido.", code="token_invalido")

    # El correo ya viene fijado desde la invitacion; se permite confirmarlo
    # de nuevo en el formulario pero se valida que coincida con esa cuenta.
    _validar_unicidad(db, dni=datos["dni"], correo=usuario.correo, nombre_usuario=datos["usuario"], excluir_id=usuario.id)

    pais = obtener_pais_canonico(db, datos.get("lugar_nacimiento") or "")
    if pais is None:
        raise AppError(
            "El lugar de nacimiento no es válido. Debes seleccionarlo de la lista de países.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="lugar_nacimiento_invalido",
            fields={"lugar_nacimiento": "No es un país válido o no está habilitado."},
        )

    usuario.usuario = datos["usuario"]
    usuario.password_hash = hash_password(datos["password"])
    usuario.dni = datos["dni"]
    usuario.nombres = datos["nombres"]
    usuario.apellidos = datos["apellidos"]
    usuario.fecha_nacimiento = datos["fecha_nacimiento"]
    usuario.lugar_nacimiento = pais.nombre
    usuario.direccion_facturacion = datos["direccion_facturacion"]
    usuario.genero = datos["genero"]
    usuario.telefono = datos.get("telefono")
    if ruta_imagen:
        usuario.imagen_perfil = ruta_imagen

    usuario.administrador.estado = EstadoAdministrador.ACTIVO
    usuario.administrador.token_invitacion = None
    usuario.administrador.token_expira_en = None

    db.commit()
    db.refresh(usuario)
    return usuario


# =========================================================================
# Root: matriz de roles (B1-09)
# =========================================================================

_ROLES_INFO: dict[RolNombre, tuple[str, str]] = {
    RolNombre.ROOT: ("Root", "Control total del sistema"),
    RolNombre.ADMINISTRADOR: ("Administrador", "Programa y consulta vuelos"),
    RolNombre.CLIENTE: ("Cliente", "Busca, reserva y compra"),
    RolNombre.VISITANTE: ("Visitante", "Consulta sin iniciar sesion"),
}


def obtener_matriz_roles(db: Session) -> dict:
    """Matriz en la forma que consume el front: modulos (id + nombre) y una
    fila por rol con su mapa {modulo: permitido}."""
    filas = list(db.scalars(select(RolModulo).join(Rol)))
    por_rol: dict[RolNombre, dict[str, bool]] = {r: {} for r in RolNombre}
    for fila in filas:
        por_rol[fila.rol.nombre][fila.modulo] = fila.permitido

    return {
        "modulos": [{"id": m, "nombre": MODULOS_NOMBRES.get(m, m)} for m in MODULOS_SISTEMA],
        "roles": [
            {
                "id": rol,
                "nombre": _ROLES_INFO[rol][0],
                "descripcion": _ROLES_INFO[rol][1],
                # Las funciones ya están definidas: nada es editable desde aquí.
                "editable": False,
                "modulos": {m: por_rol[rol].get(m, False) for m in MODULOS_SISTEMA},
            }
            for rol in RolNombre
        ],
    }


