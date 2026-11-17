"""Bandeja de salida: encolar, enviar y reintentar correos.

Los correos se encolan con la sesion del request, justo despues de confirmar la
reserva/compra. El primer intento ocurre en `BackgroundTasks`; si SMTP falla, la
fila sigue pendiente y el worker de `app.main` la reintenta con espera exponencial.
Asi un fallo de correo nunca tumba la compra ni pierde el codigo.
"""
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import email
from app.core.db import session_scope
from app.modules.notificaciones.models import NotificacionPendiente

logger = logging.getLogger("aerotiquetes.notificaciones")

MAX_INTENTOS = 5
RETRASO_BASE_SEGUNDOS = 30
LIMITE_POR_CICLO = 50


def encolar(
    db: Session, *, tipo: str, destinatario: str, asunto: str, cuerpo_html: str
) -> int:
    """Guarda un correo y devuelve su id. No envia nada."""
    fila = NotificacionPendiente(
        tipo=tipo,
        destinatario=destinatario,
        asunto=asunto,
        cuerpo_html=cuerpo_html,
        estado="pendiente",
        intentos=0,
        proximo_intento_en=datetime.now(timezone.utc),
    )
    db.add(fila)
    db.flush()
    return fila.id


def encolar_codigos(db: Session, envios: list[dict]) -> list[int]:
    """Encola un correo de codigo por viajero y confirma la escritura antes de responder."""
    ids = []
    for envio in envios:
        asunto, cuerpo = email.armar_codigo_reserva(**envio)
        ids.append(
            encolar(
                db,
                tipo="codigo_reserva",
                destinatario=envio["correo"],
                asunto=asunto,
                cuerpo_html=cuerpo,
            )
        )
    if ids:
        db.commit()
    return ids


def encolar_cancelacion(db: Session, datos: dict) -> int:
    asunto, cuerpo = email.armar_aviso_cancelacion(**datos)
    id_fila = encolar(
        db,
        tipo="aviso_cancelacion",
        destinatario=datos["correo"],
        asunto=asunto,
        cuerpo_html=cuerpo,
    )
    db.commit()
    return id_fila


def enviar_fila(db: Session, id_notificacion: int) -> bool:
    """Intenta entregar una fila. Devuelve True si se envio; nunca propaga el error SMTP."""
    fila = db.get(NotificacionPendiente, id_notificacion)
    if fila is None or fila.estado != "pendiente":
        return False
    try:
        email.enviar_crudo(fila.destinatario, fila.asunto, fila.cuerpo_html)
    except email.CorreoError as exc:
        fila.intentos += 1
        fila.ultimo_error = str(exc)[:2000]
        if fila.intentos >= MAX_INTENTOS:
            fila.estado = "fallido"
            logger.error("Correo %s agotó los %s intentos: %s", fila.id, MAX_INTENTOS, exc)
        else:
            espera = RETRASO_BASE_SEGUNDOS * (2 ** (fila.intentos - 1))
            fila.proximo_intento_en = datetime.now(timezone.utc) + timedelta(seconds=espera)
            logger.warning("Correo %s falló (intento %s): %s", fila.id, fila.intentos, exc)
        db.commit()
        return False

    fila.estado = "enviado"
    fila.ultimo_error = None
    db.commit()
    return True


def procesar(id_notificacion: int) -> None:
    """Primer intento desde una tarea en segundo plano (sesion propia)."""
    with session_scope() as db:
        enviar_fila(db, id_notificacion)


def enviar_pendientes(db: Session, limite: int = LIMITE_POR_CICLO) -> int:
    """Worker: reintenta las filas vencidas. Devuelve cuantas se enviaron."""
    ahora = datetime.now(timezone.utc)
    ids = list(
        db.scalars(
            select(NotificacionPendiente.id)
            .where(
                NotificacionPendiente.estado == "pendiente",
                NotificacionPendiente.proximo_intento_en <= ahora,
            )
            .order_by(NotificacionPendiente.creada_en)
            .limit(limite)
        )
    )
    return sum(enviar_fila(db, id_fila) for id_fila in ids)
