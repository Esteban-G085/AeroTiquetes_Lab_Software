"""
Servicio de correo (B2-03 en el plan, pero B1 lo necesita desde ya para
invitacion de admin y verificacion de cambio de correo, asi que se deja
implementado aqui en core/ para que cualquier modulo lo use).

En desarrollo apunta a Mailpit (localhost:1025, sin TLS ni auth). El envio
nunca lanza excepcion hacia arriba si falla: se registra en el logger para no
tumbar la operacion de negocio por un problema de correo.
"""
import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger("aerotiquetes.email")


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
        # Puerto 465: SSL directo. Puerto 587 (Gmail, Brevo, etc.): STARTTLS.
        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                smtp.send_message(msg)
            logger.info("Correo enviado a %s (SMTP_SSL 465)", destinatario)
            return

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            smtp.ehlo()
            # Mailpit local no negocia TLS: si el servidor no lo soporta se sigue en claro.
            try:
                smtp.starttls()
                smtp.ehlo()
            except (OSError, smtplib.SMTPException) as exc:
                logger.debug("starttls no aplicado en %s:%s (%s)", settings.SMTP_HOST, settings.SMTP_PORT, exc)
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
        logger.info("Correo enviado a %s (STARTTLS %s)", destinatario, settings.SMTP_PORT)
    except (OSError, smtplib.SMTPException) as exc:
        # No tumbamos la peticion HTTP por un fallo de correo; solo se registra.
        logger.warning("No se pudo enviar el correo a %s: %s", destinatario, exc)


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
