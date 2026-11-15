"""
Logica de Noticias y suscripcion (HU11, B2-15).

* La noticia de un vuelo se crea SOLA al programarlo: `publicar_noticia` se registra en el punto de
  extension `ALPROGRAMAR_VUELO` de `vuelos.service` (D19), dentro de la misma transaccion.
* `publicar_faltantes` completa las de vuelos que ya existian (los de ejemplo) al arrancar la aplicacion.
* Los correos a los suscritos se arman con `preparar_envios` (con la sesion abierta) y se envian en segundo
  plano con `enviar`, igual que los de compras.
"""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core import email as correo
from app.modules.noticias.models import Noticia, Suscripcion
from app.modules.noticias.schemas import CiudadNoticia, NoticiaOut, SuscripcionOut
from app.modules.vuelos import service as vuelos
from app.modules.vuelos.models import EstadoVuelo, Vuelo

VIGENCIA = timedelta(days=8)  # RF05
LIMITE = 100
_BOGOTA = ZoneInfo("America/Bogota")


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Publicacion
# ---------------------------------------------------------------------------
def publicar_noticia(db: Session, vuelo: Vuelo, publicada_en: datetime | None = None) -> Noticia:
    """Crea la noticia del vuelo si no tiene una. No hace commit (lo hace quien programa el vuelo)."""
    existente = db.scalar(select(Noticia).where(Noticia.id_vuelo == vuelo.id))
    if existente is not None:
        return existente
    publicada = publicada_en or _ahora()
    noticia = Noticia(id_vuelo=vuelo.id, tipo="vuelo", publicada_en=publicada, vigente_hasta=publicada + VIGENCIA)
    db.add(noticia)
    db.flush()
    return noticia


# Al programar un vuelo se publica su noticia (una sola vez aunque se importe dos veces el modulo).
if publicar_noticia not in vuelos.ALPROGRAMAR_VUELO:
    vuelos.ALPROGRAMAR_VUELO.append(publicar_noticia)


def publicar_faltantes(db: Session, ahora: datetime | None = None) -> int:
    """Noticias de los vuelos programados que aun no tienen (por ejemplo, los de ejemplo).

    Solo vuelos futuros programados hace menos de 8 dias; la noticia queda con la fecha de programacion del vuelo,
    asi no se vuelven a publicar vuelos viejos cada vez que arranca la aplicacion. Devuelve cuantas creo."""
    ahora = ahora or _ahora()
    ya = select(Noticia.id_vuelo)
    vuelos_sin = db.scalars(
        select(Vuelo).where(
            Vuelo.estado == EstadoVuelo.PROGRAMADO,
            Vuelo.salida_utc > ahora,
            Vuelo.fecha_programacion > ahora - VIGENCIA,
            Vuelo.id.not_in(ya),
        )
    ).unique()
    creadas = 0
    for v in vuelos_sin:
        publicar_noticia(db, v, v.fecha_programacion)
        creadas += 1
    if creadas:
        db.commit()
    return creadas


# ---------------------------------------------------------------------------
# Consulta
# ---------------------------------------------------------------------------
def _salida_out(n: Noticia, v: Vuelo) -> NoticiaOut:
    return NoticiaOut(
        id=n.id, tipo=n.tipo, titulo=n.titulo, vuelo_id=v.id,
        origen=CiudadNoticia(ciudad=v.origen.nombre, codigo=v.origen.codigo),
        destino=CiudadNoticia(ciudad=v.destino.nombre, codigo=v.destino.codigo),
        salida=v.salida_utc, salida_zona=v.origen.zona_horaria, precio=v.costo, imagen_url=n.imagen_url,
        publicada_en=n.publicada_en, vigente_hasta=n.vigente_hasta,
    )


def listar_vigentes(db: Session, ahora: datetime | None = None) -> list[NoticiaOut]:
    """Noticias vigentes (RF05, RF06): publicadas hace menos de 8 dias y de un vuelo que sigue programado."""
    ahora = ahora or _ahora()
    filas = db.execute(
        select(Noticia, Vuelo)
        .join(Vuelo, Vuelo.id == Noticia.id_vuelo)
        .where(Noticia.vigente_hasta > ahora, Vuelo.estado == EstadoVuelo.PROGRAMADO, Vuelo.salida_utc > ahora)
        .order_by(Noticia.publicada_en.desc(), Noticia.id.desc())
        .limit(LIMITE)
    ).unique()
    return [_salida_out(n, v) for n, v in filas]


# ---------------------------------------------------------------------------
# Suscripcion (solo clientes)
# ---------------------------------------------------------------------------
def obtener_suscripcion(db: Session, cliente) -> SuscripcionOut:
    """`correo` es el de la suscripcion si existe; si no, el de la cuenta (para precargar el formulario)."""
    s = db.scalar(select(Suscripcion).where(Suscripcion.id_cliente == cliente.id))
    return SuscripcionOut(suscrito=s is not None, correo=s.correo if s else cliente.correo)


def suscribir(db: Session, cliente, direccion: str) -> SuscripcionOut:
    direccion = direccion.strip().lower()
    s = db.scalar(select(Suscripcion).where(Suscripcion.id_cliente == cliente.id))
    if s is None:
        db.add(Suscripcion(id_cliente=cliente.id, correo=direccion))
    else:
        s.correo = direccion
    db.commit()
    return SuscripcionOut(suscrito=True, correo=direccion)


def cancelar_suscripcion(db: Session, cliente) -> None:
    db.execute(delete(Suscripcion).where(Suscripcion.id_cliente == cliente.id))
    db.commit()


# ---------------------------------------------------------------------------
# Correos a los suscritos
# ---------------------------------------------------------------------------
def preparar_envios(db: Session, vuelo: Vuelo) -> list[dict]:
    """Un correo por suscripcion con los datos del vuelo nuevo (copiados: el envio ya no toca la base)."""
    direcciones = sorted(set(db.scalars(select(Suscripcion.correo))))
    if not direcciones:
        return []
    datos = dict(
        codigo=vuelo.codigo, ruta=f"{vuelo.origen.nombre} → {vuelo.destino.nombre}",
        salida=vuelo.salida_utc.astimezone(_BOGOTA).strftime("%d/%m/%Y %H:%M"), precio=vuelo.costo,
    )
    return [dict(correo=d, **datos) for d in direcciones]


def enviar(envios: list[dict]) -> None:
    for e in envios:
        correo.enviar_noticia_vuelo(**e)
