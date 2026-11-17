"""
Servicio de correo (B2-03 en el plan, pero B1 lo necesita desde ya para
invitacion de admin y verificacion de cambio de correo, asi que se deja
implementado aqui en core/ para que cualquier modulo lo use).

En desarrollo apunta a Mailpit (localhost:1025, sin TLS ni auth). Si falla,
lanza `CorreoError`: el llamador decide si lo registra o si deja el correo en
la bandeja de salida para reintentarlo. Nunca se tumba una compra por correo
porque el envio ocurre fuera de la transaccion (o en la bandeja).
"""
import html
import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger("aerotiquetes.email")


class CorreoError(Exception):
    """El SMTP no pudo entregar el mensaje (o no pudo negociar TLS obligatorio)."""


def _get_settings():
    # Leer configuración fresca en cada envío para recoger cambios en .env sin reiniciar.
    get_settings.cache_clear()
    return get_settings()


def _enviar(destinatario: str, asunto: str, cuerpo_html: str) -> None:
    settings = _get_settings()
    msg = EmailMessage()
    msg["Subject"] = asunto
    msg["From"] = settings.SMTP_FROM
    msg["To"] = destinatario
    msg.set_content("Este correo requiere un cliente compatible con HTML.")
    msg.add_alternative(cuerpo_html, subtype="html")

    try:
        # Puerto 465 (o SMTP_USE_SSL): SSL directo. El resto: STARTTLS si SMTP_USE_TLS.
        if settings.SMTP_USE_SSL or settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                smtp.send_message(msg)
            logger.info("Correo enviado a %s (SMTP_SSL)", destinatario)
            return

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            smtp.ehlo()
            if settings.SMTP_USE_TLS or settings.SMTP_FORCE_TLS:
                try:
                    smtp.starttls()
                    smtp.ehlo()
                except (OSError, smtplib.SMTPException) as exc:
                    if settings.SMTP_FORCE_TLS:
                        raise CorreoError(
                            f"TLS obligatorio y el servidor {settings.SMTP_HOST}:{settings.SMTP_PORT} no lo negocio"
                        ) from exc
                    # Mailpit local no negocia TLS: se sigue en claro solo en desarrollo.
                    logger.debug(
                        "starttls no aplicado en %s:%s (%s)", settings.SMTP_HOST, settings.SMTP_PORT, exc
                    )
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
        logger.info("Correo enviado a %s (SMTP %s)", destinatario, settings.SMTP_PORT)
    except (OSError, smtplib.SMTPException) as exc:
        raise CorreoError(f"No se pudo enviar el correo a {destinatario}: {exc}") from exc


def _plantilla(titulo: str, mensaje_html: str, boton_texto: str, boton_url: str) -> str:
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#0d1b4c;">{titulo}</h2>
      <p>{mensaje_html}</p>
      <p style="text-align:center; margin: 24px 0;">
        <a href="{boton_url}"
           style="background:#0d1b4c; color:#fff; padding:12px 20px;
                  text-decoration:none; border-radius:6px; display:inline-block;">
          {boton_texto}
        </a>
      </p>
      <p style="font-size:12px; color:#666;">
        Si el boton no funciona, copia y pega este enlace en tu navegador:<br>
        <span>{boton_url}</span>
      </p>
    </div>
    """


def enviar_invitacion_administrador(*, correo: str, nombre: str, token: str, horas_vencimiento: int) -> None:
    settings = _get_settings()
    url = f"{settings.FRONTEND_URL}/completar-registro?token={token}"
    cuerpo = _plantilla(
        titulo="Invitacion a AeroTiquetes",
        mensaje_html=(
            f"Hola {nombre},<br><br>"
            "Root te ha invitado a administrar AeroTiquetes. Completa tu registro "
            f"usando el boton de abajo. Este enlace vence en {horas_vencimiento} horas "
            "y solo puede usarse una vez."
        ),
        boton_texto="Completar registro",
        boton_url=url,
    )
    _enviar(correo, "Invitacion a AeroTiquetes", cuerpo)


def enviar_verificacion_cambio_correo(*, correo_nuevo: str, token: str) -> None:
    settings = _get_settings()
    url = f"{settings.FRONTEND_URL}/verificar-correo?token={token}"
    cuerpo = _plantilla(
        titulo="Confirma tu nuevo correo",
        mensaje_html=(
            "Solicitaste cambiar el correo de tu cuenta en AeroTiquetes. "
            "Confirma usando el boton de abajo. Si no solicitaste este cambio, "
            "ignora este mensaje."
        ),
        boton_texto="Confirmar nuevo correo",
        boton_url=url,
    )
    _enviar(correo_nuevo, "Confirma tu nuevo correo - AeroTiquetes", cuerpo)


# ---------------------------------------------------------------------------
# Compra y reserva (Sprint 2, B1-17)
# ---------------------------------------------------------------------------

def _esc(texto) -> str:
    return html.escape(str(texto))


def armar_codigo_reserva(
    *, correo: str, nombre: str, codigo: str, es_compra: bool, tramos: list[dict], expira_en_texto: str | None
) -> tuple[str, str]:
    """Devuelve (asunto, HTML) para enviar ahora o guardar en la bandeja de salida."""
    filas = "".join(
        f"<tr><td style='padding:4px 8px'>{_esc(t['vuelo'])}</td><td style='padding:4px 8px'>{_esc(t['ruta'])}</td>"
        f"<td style='padding:4px 8px'>{_esc(t['salida'])}</td><td style='padding:4px 8px'>{_esc(t['clase'])}</td>"
        f"<td style='padding:4px 8px'>{_esc(t['silla'])}</td></tr>"
        for t in tramos
    )
    aviso = (
        ""
        if es_compra
        else f"<p><b>Esta reserva se libera automaticamente el {_esc(expira_en_texto)}</b> si no la pagas.</p>"
    )
    cuerpo = f"""
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color:#0d1b4c;">{'Compra confirmada' if es_compra else 'Reserva registrada'}</h2>
      <p>Hola {_esc(nombre)}, este es tu codigo de reserva para el check-in:</p>
      <p style="font-size:28px; letter-spacing:4px; font-weight:bold; color:#0d1b4c; text-align:center;">{_esc(codigo)}</p>
      <table style="border-collapse:collapse; font-size:14px;">
        <tr style="background:#eef2ff"><th align="left" style="padding:4px 8px">Vuelo</th><th align="left" style="padding:4px 8px">Ruta</th>
        <th align="left" style="padding:4px 8px">Salida (hora de Colombia)</th><th align="left" style="padding:4px 8px">Clase</th>
        <th align="left" style="padding:4px 8px">Silla</th></tr>
        {filas}
      </table>
      {aviso}
      <p style="font-size:12px; color:#666;">Guarda este codigo: lo necesitas para hacer el check-in.</p>
    </div>
    """
    return f"Tu codigo de reserva {codigo} - AeroTiquetes", cuerpo


def enviar_codigo_reserva(**datos) -> None:
    """Un correo por viajero con SU codigo de reserva (R24-R25)."""
    asunto, cuerpo = armar_codigo_reserva(**datos)
    _enviar(datos["correo"], asunto, cuerpo)


def armar_aviso_cancelacion(*, correo: str, nombre: str, tiquetes: list[str], reintegro: int) -> tuple[str, str]:
    """Aviso (no es un comprobante, RF20) de que se cancelo la compra y el dinero volvio a la billetera."""
    lista = "".join(f"<li>{_esc(t)}</li>" for t in tiquetes)
    valor = f"{reintegro:,}".replace(",", ".")
    cuerpo = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#0d1b4c;">Cancelacion de compra</h2>
      <p>Hola {_esc(nombre)}, cancelamos estos tiquetes:</p>
      <ul>{lista}</ul>
      <p>El valor (<b>${valor} COP</b>) ya esta de vuelta en tu billetera de AeroTiquetes.</p>
    </div>
    """
    return "Cancelacion de compra - AeroTiquetes", cuerpo


def enviar_aviso_cancelacion(**datos) -> None:
    asunto, cuerpo = armar_aviso_cancelacion(**datos)
    _enviar(datos["correo"], asunto, cuerpo)


def enviar_crudo(destinatario: str, asunto: str, cuerpo_html: str) -> None:
    """Envia un mensaje ya armado (lo usa la bandeja de salida al reintentar)."""
    _enviar(destinatario, asunto, cuerpo_html)


def enviar_noticia_vuelo(*, correo: str, codigo: str, ruta: str, salida: str, precio: int) -> None:
    """Aviso a los suscritos de que se programo un vuelo nuevo (HU11)."""
    valor = f"{precio:,}".replace(",", ".")
    cuerpo = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color:#0d1b4c;">Nuevo vuelo en AeroTiquetes</h2>
      <p style="font-size:18px;"><b>{_esc(ruta)}</b></p>
      <p>Vuelo {_esc(codigo)} · sale el {_esc(salida)} (hora de Colombia).</p>
      <p>Desde <b>${valor} COP</b> por persona.</p>
      <p style="font-size:12px; color:#666;">Recibes este correo porque te suscribiste a las noticias. Puedes cancelar la suscripcion desde la seccion Noticias.</p>
    </div>
    """
    _enviar(correo, f"Nuevo vuelo {ruta} - AeroTiquetes", cuerpo)
