"""
Correos de Compra y reserva (B1-17). Los datos se copian a estructuras simples en
`preparar_*` (con la sesion de BD aun abierta); el cuerpo se guarda en la bandeja
de salida antes de responder y el envio ocurre en `BackgroundTasks`.

Si SMTP falla, la fila queda pendiente y el worker de `app.main` la reintenta:
el codigo de reserva no se pierde y la compra NO se deshace por un problema de correo.
"""
import logging
from zoneinfo import ZoneInfo

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.core import email as correo
from app.modules.compras.models import Compra, EstadoTiquete, Reserva
from app.modules.notificaciones import service as bandeja

logger = logging.getLogger("aerotiquetes.compras.notificaciones")

_BOGOTA = ZoneInfo("America/Bogota")


def _texto_fecha(fecha) -> str:
    return fecha.astimezone(_BOGOTA).strftime("%d/%m/%Y %H:%M")


def preparar_codigos(operacion: Reserva | Compra) -> list[dict]:
    """Un envio por viajero y codigo, con todos sus tramos."""
    es_compra = isinstance(operacion, Compra)
    expira = None if es_compra else _texto_fecha(operacion.expira_en)
    envios: dict[tuple[str, str], dict] = {}
    for t in operacion.tiquetes:
        if t.estado not in (EstadoTiquete.RESERVADO, EstadoTiquete.COMPRADO):
            continue
        clave = (t.viajero.correo, t.codigo_reserva)
        envio = envios.setdefault(
            clave,
            dict(
                correo=t.viajero.correo, nombre=f"{t.viajero.nombres} {t.viajero.apellidos}",
                codigo=t.codigo_reserva, es_compra=es_compra, tramos=[], expira_en_texto=expira,
            ),
        )
        envio["tramos"].append(
            dict(
                vuelo=t.vuelo.codigo, ruta=f"{t.vuelo.origen.nombre} → {t.vuelo.destino.nombre}",
                salida=_texto_fecha(t.vuelo.salida_utc), clase=t.clase.value, silla=t.numero_silla or "—",
            )
        )
    return list(envios.values())


def programar_codigos(db: Session, tareas: BackgroundTasks, operacion: Reserva | Compra) -> None:
    """Persiste los correos en la bandeja y programa el primer intento."""
    envios = preparar_codigos(operacion)
    try:
        ids = bandeja.encolar_codigos(db, envios)
    except Exception:
        # Un problema al registrar el correo no puede deshacer una compra ya confirmada.
        logger.exception("No se pudieron encolar los correos de la operacion %s", operacion.id)
        ids = None
    tareas.add_task(enviar_codigos, envios, ids)


def enviar_codigos(envios: list[dict], ids: list[int] | None = None) -> None:
    """Primer intento de entrega. Sin ids (bandeja no disponible) se envia directo."""
    for indice, envio in enumerate(envios):
        if not ids or indice >= len(ids):
            try:
                correo.enviar_codigo_reserva(**envio)
            except correo.CorreoError:
                logger.exception("No se pudo enviar el codigo a %s", envio["correo"])
            continue
        bandeja.procesar(ids[indice])


def preparar_cancelacion(compra: Compra, ids_cancelados: set[int], reintegro: int, destinatario: str, nombre: str) -> dict:
    tiquetes = [
        f"{t.vuelo.codigo} {t.vuelo.origen.nombre} → {t.vuelo.destino.nombre} — {t.viajero.nombres} {t.viajero.apellidos}"
        for t in compra.tiquetes
        if t.id in ids_cancelados
    ]
    return dict(correo=destinatario, nombre=nombre, tiquetes=tiquetes, reintegro=reintegro)


def programar_cancelacion(
    db: Session, tareas: BackgroundTasks, operacion: Reserva | Compra, datos: dict
) -> None:
    try:
        id_fila = bandeja.encolar_cancelacion(db, datos)
    except Exception:
        logger.exception("No se pudo encolar el aviso de cancelacion de la compra %s", operacion.id)
        id_fila = None
    tareas.add_task(enviar_cancelacion, datos, id_fila)


def enviar_cancelacion(datos: dict, id_notificacion: int | None = None) -> None:
    if id_notificacion is None:
        try:
            correo.enviar_aviso_cancelacion(**datos)
        except correo.CorreoError:
            logger.exception("No se pudo enviar el aviso de cancelacion a %s", datos["correo"])
        return
    bandeja.procesar(id_notificacion)
