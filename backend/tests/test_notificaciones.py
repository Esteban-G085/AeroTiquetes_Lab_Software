"""Bandeja de salida: el codigo sobrevive a un fallo SMTP y se reintenta."""
import smtplib
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core import email
from app.modules.notificaciones import service as bandeja
from app.modules.notificaciones.models import NotificacionPendiente
from tests.conftest import auth_headers, datos_registro_cliente, login

# conftest sustituye `_enviar` por un stub antes de cada prueba; guardamos el real
# al importar el modulo (la coleccion ocurre antes de que corra ese fixture).
_ENVIAR_REAL = email._enviar


def _cliente(client) -> dict:
    datos = datos_registro_cliente()
    assert client.post("/auth/registro", data=datos).status_code == 201
    return auth_headers(login(client, datos["usuario"], datos["password"]))


def test_reservar_guarda_el_correo_en_la_bandeja(client, db_session, correos):
    from datetime import timedelta

    from app.modules.vuelos.models import Ciudad
    from app.modules.vuelos.service import crear_vuelo, tipo_entre

    cab = _cliente(client)
    ciudades = {c.codigo: c for c in db_session.scalars(select(Ciudad))}
    origen, destino = ciudades["BOG"], ciudades["MDE"]
    vuelo = crear_vuelo(
        db_session, origen=origen, destino=destino, tipo=tipo_entre(origen, destino),
        salida_utc=datetime.now(timezone.utc) + timedelta(days=3), duracion_min=60, costo=200_000,
    )
    db_session.commit()

    antes = len(correos)
    resp = client.post(
        "/reservas",
        json={"items": [{
            "vuelo_id": vuelo.id, "clase": "economica",
            "viajeros": [{
                "documento": "1000000001", "nombres": "Ana", "apellidos": "Gomez",
                "fecha_nacimiento": "1990-04-12", "genero": "femenino", "telefono": "3001234567",
                "correo": "ana@example.com", "nombre_contacto": "Contacto", "telefono_contacto": "3109876543",
            }],
        }]},
        headers=cab,
    )
    assert resp.status_code == 201, resp.text
    assert len(correos) == antes + 1  # primer intento (stub) tambien llega

    filas = db_session.scalars(select(NotificacionPendiente)).all()
    assert len(filas) == 1
    assert filas[0].estado == "enviado" and filas[0].intentos == 0
    assert filas[0].destinatario == "ana@example.com"
    assert resp.json()["tiquetes"][0]["codigo_reserva"] in filas[0].cuerpo_html


def test_fallo_smtp_deja_la_fila_pendiente_y_el_worker_la_reenvia(db_session, monkeypatch):
    id_fila = bandeja.encolar(
        db_session,
        tipo="codigo_reserva",
        destinatario="ana@example.com",
        asunto="Tu codigo",
        cuerpo_html="ABC12345",
    )
    db_session.commit()

    def _fallar(*_args, **_kwargs):
        raise email.CorreoError("SMTP caido")

    monkeypatch.setattr(email, "_enviar", _fallar)
    assert bandeja.enviar_pendientes(db_session) == 0
    fila = db_session.get(NotificacionPendiente, id_fila)
    assert fila.estado == "pendiente" and fila.intentos == 1
    assert "SMTP caido" in fila.ultimo_error

    # El backoff evita reintentar en el mismo ciclo.
    assert bandeja.enviar_pendientes(db_session) == 0

    enviados = []
    monkeypatch.setattr(email, "_enviar", lambda dest, asunto, cuerpo: enviados.append(dest))
    fila.proximo_intento_en = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.commit()
    assert bandeja.enviar_pendientes(db_session) == 1
    assert enviados == ["ana@example.com"]
    assert fila.estado == "enviado" and fila.ultimo_error is None


def test_agota_intentos_y_marca_fallido(db_session, monkeypatch):
    id_fila = bandeja.encolar(
        db_session, tipo="aviso_cancelacion", destinatario="x@example.com",
        asunto="Cancelacion", cuerpo_html="...",
    )
    db_session.commit()
    monkeypatch.setattr(email, "_enviar", lambda *a, **k: (_ for _ in ()).throw(email.CorreoError("caido")))

    for _ in range(bandeja.MAX_INTENTOS):
        fila = db_session.get(NotificacionPendiente, id_fila)
        fila.proximo_intento_en = datetime.now(timezone.utc) - timedelta(seconds=1)
        db_session.commit()
        bandeja.enviar_pendientes(db_session)

    fila = db_session.get(NotificacionPendiente, id_fila)
    assert fila.estado == "fallido" and fila.intentos == bandeja.MAX_INTENTOS
    assert bandeja.enviar_pendientes(db_session) == 0


def test_smtp_force_tls_falla_si_el_servidor_no_lo_negocia(monkeypatch):
    class _SMTPSinTLS:
        def __init__(self, *_args, **_kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            pass

        def ehlo(self):
            pass

        def starttls(self):
            raise smtplib.SMTPNotSupportedError("STARTTLS no soportado")

        def send_message(self, *_args):
            raise AssertionError("No debe enviarse en claro con SMTP_FORCE_TLS")

    settings = email._get_settings()
    settings.SMTP_USE_SSL = False
    settings.SMTP_PORT = 587
    settings.SMTP_FORCE_TLS = True
    monkeypatch.setattr(email, "_get_settings", lambda: settings)
    monkeypatch.setattr(smtplib, "SMTP", _SMTPSinTLS)

    with pytest.raises(email.CorreoError, match="TLS obligatorio"):
        _ENVIAR_REAL("ana@example.com", "Asunto", "<p>Hola</p>")


def test_produccion_rechaza_los_secretos_de_ejemplo():
    from app.core.config import Settings

    with pytest.raises(RuntimeError, match="JWT_SECRET|ROOT_PASSWORD"):
        Settings(
            APP_ENV="produccion",
            JWT_SECRET="cambia-este-secreto-en-produccion",
            ROOT_PASSWORD="root1234",
        ).validar_seguridad_produccion()

    seguras = Settings(APP_ENV="produccion", JWT_SECRET="otro-secreto-largo", ROOT_PASSWORD="clave-root-segura")
    assert seguras.es_produccion
    seguras.validar_seguridad_produccion()


# ============================================================================ Correo: Gmail por defecto
def test_los_defaults_de_correo_apuntan_a_gmail(monkeypatch):
    from app.core.config import Settings

    for clave in ("SMTP_HOST", "SMTP_PORT", "SMTP_USE_TLS", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"):
        monkeypatch.delenv(clave, raising=False)
    s = Settings(_env_file=None)
    assert s.SMTP_HOST == "smtp.gmail.com"
    assert s.SMTP_PORT == 587
    assert s.SMTP_USE_TLS is True and s.SMTP_USE_SSL is False


def test_validar_correo_exige_credenciales_y_tls_para_gmail():
    from app.core.config import Settings

    incompleta = Settings(
        SMTP_HOST="smtp.gmail.com", SMTP_PORT=587, SMTP_USE_TLS=True, SMTP_USER="", SMTP_PASSWORD=""
    )
    with pytest.raises(RuntimeError, match="SMTP_USER.*SMTP_PASSWORD"):
        incompleta.validar_correo()

    sin_tls = Settings(
        SMTP_HOST="smtp.gmail.com", SMTP_PORT=587, SMTP_USE_TLS=False, SMTP_USE_SSL=False,
        SMTP_USER="usuario@gmail.com", SMTP_PASSWORD="contrasena-de-aplicacion",
    )
    with pytest.raises(RuntimeError, match="SMTP_USE_TLS"):
        sin_tls.validar_correo()

    correcta = Settings(
        SMTP_HOST="smtp.gmail.com", SMTP_PORT=587, SMTP_USE_TLS=True,
        SMTP_USER="usuario@gmail.com", SMTP_PASSWORD="contrasena-de-aplicacion",
    )
    correcta.validar_correo()  # no lanza


@pytest.mark.parametrize("host", ["localhost", "127.0.0.1", "::1", "mailpit", "mailpit.aerotiquetes"])
def test_validar_correo_omite_los_hosts_de_prueba(host):
    from app.core.config import Settings

    local = Settings(SMTP_HOST=host, SMTP_PORT=1025, SMTP_USE_TLS=False, SMTP_USER="", SMTP_PASSWORD="")
    assert local.es_smtp_local
    local.validar_correo()  # no lanza: las pruebas no necesitan credenciales
