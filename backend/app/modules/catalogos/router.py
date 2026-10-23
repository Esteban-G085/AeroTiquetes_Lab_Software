"""Router del modulo catalogos."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.catalogos.schemas import PaisOut
from app.modules.catalogos.service import listar_paises_activos

router = APIRouter(prefix="/catalogos", tags=["Catalogos"])


@router.get("/paises", response_model=list[PaisOut])
def get_paises(db: Session = Depends(get_db)):
    return listar_paises_activos(db)
