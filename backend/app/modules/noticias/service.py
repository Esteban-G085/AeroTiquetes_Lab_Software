"""
Noticias y suscripciones (Sprint 2, B2-15; HU11).

* Al programar un vuelo se crea su noticia (gancho `ALPROGRAMAR_VUELO`, dentro de la misma transaccion)
  y, ya guardado el vuelo, se avisa por correo a los suscriptores (`TRAS_PROGRAMAR_VUELO`, en segundo plano).
* Una noticia se muestra mientras el vuelo siga `programado` con salida futura y no hayan pasado
  `DIAS_PUBLICADA` dias desde que se publico: la regla se calcula al consultar, no se guarda.
* Cada correo lleva un enlace para cancelar la suscripcion sin iniciar sesion (token propio del cliente).
"""
import html
import logging
import secrets
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core import email as email_module  # se llama como atributo: la suite de pruebas reemplaza `_enviar`
from app.core.config import get_settings
from app.core.db import session_scope
from app.core.errors import AppError
from app.modules.noticias.models import Noticia, Suscripcion
from app.modules.usuarios.models import Usuario
from app.modules.vuelos import service as vuelos_service
from app.modules.vuelos.models import EstadoVuelo, Vuelo

logger = logging.getLogger("aerotiquetes.noticias")

DIAS_PUBLICADA = 8
TAMANO_PAGINA = 50


# ---------------------------------------------------------------------------
# Noticias
# ---------------------------------------------------------------------------
def _pesos(valor: int) -> str:
    return "$" + f"{valor:,}".replace(",", ".")


def _redactar(vuelo: Vuelo) -> tuple[str, str]:
    """Titulo y contenido de la noticia, con la salida en la hora local de la ciudad de origen."""
    salida = vuelo.salida_utc.astimezone(ZoneInfo(vuelo.origen.zona_horaria))
    titulo = f"Nuevo vuelo {vuelo.origen.nombre} → {vuelo.destino.nombre}"
    contenido = (
        f"Ya puedes reservar el vuelo {vuelo.codigo} de {vuelo.origen.nombre} a {vuelo.destino.nombre}. "
        f"Sale el {salida:%d/%m/%Y} a las {salida:%H:%M} (hora de {vuelo.origen.nombre}) "
        f"y dura {vuelo.duracion_min // 60} h {vuelo.duracion_min % 60:02d} min. "
        f"Precio por persona: {_pesos(vuelo.costo)}."
    )
    return titulo, contenido


def publicar_noticia(db: Session, vuelo: Vuelo, publicada_en: datetime | None = None) -> Noticia:
    """Crea la noticia del vuelo (no hace commit: lo hace quien programa el vuelo)."""
    publicada = publicada_en or datetime.now(timezone.utc)
    titulo, contenido = _redactar(vuelo)
    noticia = Noticia(
        id_vuelo=vuelo.id,
        tipo="vuelo",
        titulo=titulo,
        contenido=contenido,
        publicada_en=publicada,
        vigente_hasta=publicada + timedelta(days=DIAS_PUBLICADA),
    )
    db.add(noticia)
    db.flush()
    return noticia


def crear_noticia_manual(
    db: Session,
    *,
    id_vuelo: int | None = None,
    tipo: str = "vuelo",
    titulo: str | None = None,
    contenido: str | None = None,
    imagen_url: str | None = None,
    vigente_hasta: datetime | None = None,
) -> Noticia:
    """Crea una noticia manualmente (administrador). No hace commit: lo hace quien llama."""
    publicada = datetime.now(timezone.utc)
    noticia = Noticia(
        id_vuelo=id_vuelo,
        tipo=tipo,
        titulo=titulo,
        contenido=contenido,
        imagen_url=imagen_url,
        publicada_en=publicada,
        vigente_hasta=vigente_hasta or (publicada + timedelta(days=DIAS_PUBLICADA)),
    )
    db.add(noticia)
    db.flush()
    return noticia


def publicar_noticias_faltantes(db: Session) -> int:
    """Crea la noticia de los vuelos `programado` futuros que no la tienen (por ejemplo, los de los seeds)."""
    con_noticia = select(Noticia.id_vuelo)
    ahora = datetime.now(timezone.utc)
    vuelos = db.scalars(
        select(Vuelo)
        .where(
            Vuelo.estado == EstadoVuelo.PROGRAMADO,
            Vuelo.salida_utc > ahora,
            Vuelo.fecha_programacion > ahora - timedelta(days=DIAS_PUBLICADA),
            Vuelo.id.not_in(con_noticia),
        )
        .order_by(Vuelo.id)
    ).unique()
    creadas = [publicar_noticia(db, v) for v in vuelos]
    db.commit()
    return len(creadas)


def _visibles(ahora: datetime) -> list:
    """Condiciones de vigencia.

    Las noticias de vuelo se rigen por su vuelo (programado y con salida futura); las noticias manuales
    (`id_vuelo` nulo) se rigen solo por `vigente_hasta`. En ambos casos se retiran a los DIAS_PUBLICADA.
    """
    return [
        Noticia.publicada_en >= ahora - timedelta(days=DIAS_PUBLICADA),
        Noticia.vigente_hasta > ahora,
        or_(
            Noticia.id_vuelo.is_(None),
            and_(Vuelo.estado == EstadoVuelo.PROGRAMADO, Vuelo.salida_utc > ahora),
        ),
    ]


def listar_noticias(db: Session, pagina: int = 1, ahora: datetime | None = None) -> tuple[int, list[Noticia]]:
    """Noticias vigentes, la mas reciente primero."""
    ahora = ahora or datetime.now(timezone.utc)
    base = select(Noticia).outerjoin(Vuelo, Vuelo.id == Noticia.id_vuelo).where(*_visibles(ahora))
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    filas = db.scalars(
        base.order_by(Noticia.publicada_en.desc(), Noticia.id.desc())
        .limit(TAMANO_PAGINA)
        .offset((pagina - 1) * TAMANO_PAGINA)
    ).unique()
    return total, list(filas)


def obtener_noticia(db: Session, id_noticia: int, ahora: datetime | None = None) -> Noticia | None:
    """Una noticia vigente; None si no existe o ya no se muestra."""
    ahora = ahora or datetime.now(timezone.utc)
    consulta = (
        select(Noticia)
        .outerjoin(Vuelo, Vuelo.id == Noticia.id_vuelo)
        .where(Noticia.id == id_noticia, *_visibles(ahora))
    )
    return db.scalars(consulta).unique().first()


def listar_vigentes(db: Session, ahora: datetime | None = None) -> list[Noticia]:
    """Devuelve las noticias vigentes (con o sin vuelo, dentro de su plazo de publicacion)."""
    ahora = ahora or datetime.now(timezone.utc)
    consulta = (
        select(Noticia)
        .outerjoin(Vuelo, Vuelo.id == Noticia.id_vuelo)
        .where(*_visibles(ahora))
        .order_by(Noticia.publicada_en.desc(), Noticia.id.desc())
    )
    return list(db.scalars(consulta).unique())


# ---------------------------------------------------------------------------
# Suscripciones
# ---------------------------------------------------------------------------
def _nuevo_token() -> str:
    return secrets.token_urlsafe(32)  # 43 caracteres


def _de_cliente(db: Session, id_cliente: int) -> Suscripcion | None:
    return db.scalar(select(Suscripcion).where(Suscripcion.id_cliente == id_cliente))


def estado_suscripcion(db: Session, id_cliente: int) -> Suscripcion | None:
    """La suscripcion activa del cliente, o None."""
    sus = _de_cliente(db, id_cliente)
    return sus if sus is not None and sus.activa else None


def suscribir(db: Session, id_cliente: int, correo: str) -> Suscripcion:
    """Suscribe al cliente con un correo. Si ya lo esta no cambia nada; si se habia dado de baja, se reactiva."""
    correo = correo.strip().lower()
    sus = _de_cliente(db, id_cliente)
    if sus is None:
        sus = Suscripcion(
            id_cliente=id_cliente, correo=correo, activa=True, token_cancelacion=_nuevo_token()
        )
        db.add(sus)
    elif not sus.activa:
        sus.activa = True
        sus.cancelada_en = None
        sus.creada_en = datetime.now(timezone.utc)
        sus.token_cancelacion = _nuevo_token()
    sus.correo = correo
    db.commit()
    db.refresh(sus)
    return sus


def _dar_de_baja(db: Session, sus: Suscripcion | None) -> None:
    if sus is not None and sus.activa:
        sus.activa = False
        sus.cancelada_en = datetime.now(timezone.utc)
        db.commit()


def cancelar_suscripcion(db: Session, id_cliente: int) -> None:
    """Cancela la suscripcion del cliente autenticado. Es idempotente."""
    _dar_de_baja(db, _de_cliente(db, id_cliente))


def cancelar_por_token(db: Session, token: str) -> None:
    """Cancela desde el enlace del correo (sin sesion). Token desconocido: 404 `token_invalido`.

    Si ya estaba cancelada responde igual (el enlace se puede abrir dos veces).
    """
    sus = db.scalar(select(Suscripcion).where(Suscripcion.token_cancelacion == token))
    if sus is None:
        raise AppError("El enlace de cancelacion no es valido.", status_code=404, code="token_invalido")
    _dar_de_baja(db, sus)


# ---------------------------------------------------------------------------
# Correo a suscriptores
# ---------------------------------------------------------------------------
def notificar_suscriptores(id_vuelo: int) -> int:
    """Envia la noticia del vuelo a cada suscriptor activo. Devuelve cuantos correos intento enviar.

    Corre en segundo plano con su propia sesion y NUNCA lanza: un fallo de correo o de base de datos se
    registra y no afecta al administrador que programo el vuelo.
    """
    try:
        with session_scope() as db:
            noticia = db.scalar(select(Noticia).where(Noticia.id_vuelo == id_vuelo))
            if noticia is None:
                return 0
            destinatarios = db.execute(
                select(Suscripcion.correo, Suscripcion.token_cancelacion)
                .where(Suscripcion.activa.is_(True), Suscripcion.correo.is_not(None))
            ).all()
            titulo = noticia.titulo or "Nuevo vuelo disponible"
            contenido = noticia.contenido or ""
    except Exception:
        logger.exception("No se pudo preparar el aviso de la noticia del vuelo %s", id_vuelo)
        return 0

    frontend = get_settings().FRONTEND_URL
    enviados = 0
    for correo, token in destinatarios:
        try:
            enlace = f"{frontend}/cancelar-suscripcion?token={token}"
            cuerpo = email_module._plantilla(
                titulo=html.escape(titulo),
                mensaje_html=(
                    f"{html.escape(contenido)} <br><br>"
                    f'<span style="font-size:12px;color:#666;">Recibes este correo porque te suscribiste a las '
                    f'noticias de AeroTiquetes. <a href="{enlace}">Cancelar suscripcion</a></span>'
                ),
                boton_texto="Ver noticias",
                boton_url=f"{frontend}/noticias",
            )
            email_module._enviar(correo, f"{titulo} - AeroTiquetes", cuerpo)
            enviados += 1
        except Exception:
            logger.exception("No se pudo avisar la noticia %s a un suscriptor", id_vuelo)
    return enviados


def noticia_a_schema(noticia: Noticia, vuelo: Vuelo | None = None) -> dict:
    """Construye un diccionario con los campos de NoticiaOut a partir de un Noticia y su Vuelo relacionado."""
    datos = {
        "id": noticia.id,
        "tipo": noticia.tipo,
        "titulo": noticia.titulo,
        "contenido": noticia.contenido,
    }
    if vuelo is not None:
        datos.update({
            "vuelo_id": noticia.id_vuelo,
            "origen": {"ciudad": vuelo.origen.nombre, "codigo": vuelo.origen.codigo},
            "destino": {"ciudad": vuelo.destino.nombre, "codigo": vuelo.destino.codigo},
            "salida": vuelo.salida_utc,
            "salida_zona": vuelo.origen.zona_horaria,
            "precio": vuelo.costo,
            "moneda": "COP",
        })
    else:
        datos.update({
            "vuelo_id": noticia.id_vuelo,
            "origen": {"ciudad": "", "codigo": ""},
            "destino": {"ciudad": "", "codigo": ""},
            "salida": noticia.publicada_en,
            "salida_zona": "America/Bogota",
            "precio": 0,
            "moneda": "COP",
        })
    datos.update({
        "imagen_url": noticia.imagen_url,
        "publicada_en": noticia.publicada_en,
        "vigente_hasta": noticia.vigente_hasta,
        "descuento_pct": None,
        "precio_original": None,
    })
    return datos


# Alias para compatibilidad con el nombre usado en las pruebas.
publicar_faltantes = publicar_noticias_faltantes

# Se enganchan al programar un vuelo (ver `vuelos.service.ALPROGRAMAR_VUELO` y `TRAS_PROGRAMAR_VUELO`).
vuelos_service.ALPROGRAMAR_VUELO.append(publicar_noticia)
vuelos_service.TRAS_PROGRAMAR_VUELO.append(notificar_suscriptores)
