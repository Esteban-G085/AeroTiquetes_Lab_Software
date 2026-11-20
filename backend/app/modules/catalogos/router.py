"""Router del modulo catalogos."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.catalogos.schemas import CiudadFacturacionOut, DepartamentoOut, PaisOut
from app.modules.catalogos.service import (
    listar_ciudades_facturacion,
    listar_departamentos_activos,
    listar_paises_activos,
)

router = APIRouter(prefix="/catalogos", tags=["Catalogos"])


@router.get("/paises", response_model=list[PaisOut])
def get_paises(db: Session = Depends(get_db)):
    return listar_paises_activos(db)


@router.get("/departamentos", response_model=list[DepartamentoOut])
def get_departamentos(pais: str | None = None, db: Session = Depends(get_db)):
    """Departamentos/regiones disponibles para un pais (nombre o codigo ISO2)."""
    return listar_departamentos_activos(db, pais)


@router.get("/ciudades", response_model=list[CiudadFacturacionOut])
def get_ciudades(departamento: str | None = None, db: Session = Depends(get_db)):
    """Ciudades del catalogo; `departamento` acepta su codigo (ej. CO-BDC) o nombre."""
    return listar_ciudades_facturacion(db, departamento)
