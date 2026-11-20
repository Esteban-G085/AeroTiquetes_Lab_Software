"""Servicios del modulo catalogos.

Fuente unica de la geografia usada por el registro: pais -> departamento ->
ciudad. `lugar_nacimiento` sigue resolviendose solo a pais.
"""
from dataclasses import dataclass
from fastapi import status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.catalogos.models import Departamento, Pais
from app.modules.vuelos.models import Ciudad


@dataclass(frozen=True)
class UbicacionFacturacion:
    """FKs resueltas a partir de los valores que envia el formulario."""

    id_pais: int
    id_departamento: int
    id_ciudad: int


def listar_paises_activos(db: Session) -> list[Pais]:
    stmt = select(Pais).where(Pais.activo.is_(True)).order_by(Pais.orden.asc(), Pais.nombre.asc())
    return list(db.scalars(stmt).all())


def obtener_pais_canonico(db: Session, valor: str) -> Pais | None:
    """Busca un pais activo por nombre (case-insensitive), ignorando espacios."""
    if not valor:
        return None
    nombre = valor.strip()
    if not nombre:
        return None
    stmt = select(Pais).where(Pais.activo.is_(True)).where(Pais.nombre.ilike(nombre))
    return db.scalars(stmt).first()


def listar_departamentos_activos(db: Session, pais: str | None = None) -> list[Departamento]:
    """Catalogo de departamentos/regiones; `pais` filtra por nombre o codigo ISO2.

    Cada pais muestra solo sus propias regiones: Colombia sus 32 departamentos,
    los paises curados sus regiones reales y el resto su "Region de X". Nunca se
    ofrece una region que pertenezca a otro pais.
    """
    stmt = select(Departamento).where(Departamento.activo.is_(True))
    if pais and pais.strip():
        valor = pais.strip()
        pais_obj = db.scalar(
            select(Pais).where(
                Pais.activo.is_(True),
                or_(Pais.nombre.ilike(valor), Pais.codigo_iso2.ilike(valor)),
            )
        )
        if pais_obj is None:
            return []
        stmt = stmt.where(Departamento.id_pais == pais_obj.id)
    return list(db.scalars(stmt.order_by(Departamento.orden.asc(), Departamento.nombre.asc())))


def obtener_departamento_canonico(
    db: Session, valor: str, id_pais: int | None = None
) -> Departamento | None:
    """Busca un departamento activo por codigo o nombre; `id_pais` valida la cadena."""
    if not valor or not valor.strip():
        return None
    valor = valor.strip()
    stmt = select(Departamento).where(
        Departamento.activo.is_(True),
        or_(Departamento.codigo.ilike(valor), Departamento.nombre.ilike(valor)),
    )
    if id_pais is not None:
        stmt = stmt.where(Departamento.id_pais == id_pais)
    return db.scalars(stmt).first()


def listar_ciudades_facturacion(db: Session, departamento: str | None = None) -> list[Ciudad]:
    """Ciudades para el select dependiente, opcionalmente filtradas por departamento."""
    stmt = select(Ciudad)
    if departamento and departamento.strip():
        dep = obtener_departamento_canonico(db, departamento)
        if dep is None:
            return []
        stmt = stmt.where(Ciudad.id_departamento == dep.id)
    return list(db.scalars(stmt.order_by(Ciudad.nombre.asc(), Ciudad.codigo.asc())))


def obtener_ciudad_facturacion(
    db: Session, valor: str, id_departamento: int
) -> Ciudad | None:
    """Busca una ciudad por codigo o nombre, exigiendo que pertenezca al departamento."""
    if not valor or not valor.strip():
        return None
    valor = valor.strip()
    stmt = select(Ciudad).where(
        Ciudad.id_departamento == id_departamento,
        or_(Ciudad.codigo.ilike(valor), Ciudad.nombre.ilike(valor)),
    )
    return db.scalars(stmt).first()


def resolver_ubicacion_facturacion(
    db: Session, pais: str | None, departamento: str | None, ciudad: str | None
) -> UbicacionFacturacion | None:
    """Valida la cadena completa y devuelve las FKs a guardar en `usuario`.

    Si no se envia ningun dato devuelve None (cuentas creadas antes de esta
    mejora, que no tienen ubicacion de facturacion). Si se envia solo parte de
    la cadena, se rechaza con `fields` por campo para que el front lo pinte.
    """
    valores = {
        "pais_facturacion": (pais or "").strip(),
        "departamento_facturacion": (departamento or "").strip(),
        "ciudad_facturacion": (ciudad or "").strip(),
    }
    if not any(valores.values()):
        return None

    faltantes = {campo: "Selecciona esta opción." for campo, valor in valores.items() if not valor}
    if faltantes:
        raise AppError(
            "Completa la ubicación de facturación: país, departamento y ciudad.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="ubicacion_facturacion_invalida",
            fields=faltantes,
        )

    pais_obj = obtener_pais_canonico(db, valores["pais_facturacion"])
    if pais_obj is None:
        raise AppError(
            "El país de facturación no es válido o no está habilitado.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="ubicacion_facturacion_invalida",
            fields={"pais_facturacion": "No es un país válido o no está habilitado."},
        )

    dep_obj = obtener_departamento_canonico(
        db, valores["departamento_facturacion"], id_pais=pais_obj.id
    )
    if dep_obj is None:
        raise AppError(
            "El departamento no pertenece al país seleccionado.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="ubicacion_facturacion_invalida",
            fields={"departamento_facturacion": "Selecciona un departamento de ese país."},
        )

    ciudad_obj = obtener_ciudad_facturacion(
        db, valores["ciudad_facturacion"], id_departamento=dep_obj.id
    )
    if ciudad_obj is None:
        raise AppError(
            "La ciudad no pertenece al departamento seleccionado.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code="ubicacion_facturacion_invalida",
            fields={"ciudad_facturacion": "Selecciona una ciudad de ese departamento."},
        )

    return UbicacionFacturacion(
        id_pais=pais_obj.id, id_departamento=dep_obj.id, id_ciudad=ciudad_obj.id
    )
