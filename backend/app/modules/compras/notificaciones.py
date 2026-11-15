"""
Correos de Compra y reserva (B1-17). Se envian en segundo plano DESPUES de responder la peticion
(ver `BackgroundTasks` en el router): si el SMTP esta lento o caido, el cliente no espera ni se deshace
la operacion. `core.email._enviar` registra el error y no lo propaga.

Los datos se copian a estructuras simples en `preparar_*` (con la sesion de BD aun abierta); el envio
no vuelve a tocar la base de datos.
"""
from zoneinfo import ZoneInfo

from app.core import email as correo
from app.modules.compras.models import Compra, EstadoTiquete, Reserva

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


def enviar_codigos(envios: list[dict]) -> None:
    for e in envios:
        correo.enviar_codigo_reserva(**e)


def preparar_cancelacion(compra: Compra, ids_cancelados: set[int], reintegro: int, destinatario: str, nombre: str) -> dict:
    tiquetes = [
        f"{t.vuelo.codigo} {t.vuelo.origen.nombre} → {t.vuelo.destino.nombre} — {t.viajero.nombres} {t.viajero.apellidos}"
        for t in compra.tiquetes
        if t.id in ids_cancelados
    ]
    return dict(correo=destinatario, nombre=nombre, tiquetes=tiquetes, reintegro=reintegro)


def enviar_cancelacion(datos: dict) -> None:
    correo.enviar_aviso_cancelacion(**datos)
