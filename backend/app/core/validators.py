"""
Validadores reutilizables para normalizar/limpiar parámetros de query.
"""

import re
from typing import Any

_INT_POS_RE = re.compile(r"^\d+$")


def clean_positive_int(v: Any) -> int | None:
    """Limpia y valida enteros >= 0 desde query params.

    - None se ignora
    - Solo dígitos puros (incluye ceros a la izquierda) -> int >= 0
    - Valores numéricos negativos -> lanza ValueError para que Pydantic devuelva 422
    - Cualquier otro valor con símbolos, letras (e/E), notación científica, espacios raros, +, -, ., etc. -> None (se ignora el filtro)
    """
    if v is None:
        return None
    if isinstance(v, int):
        if v < 0:
            raise ValueError("El valor debe ser mayor o igual a 0")
        return v
    if isinstance(v, str):
        s = v.strip()
        if s == "":
            return None
        # Si explícitamente empieza con '-' tratamos como negativo -> 422 para mantener contrato
        if s.lstrip().startswith("-"):
            raise ValueError("El valor debe ser mayor o igual a 0")
        # Solo aceptamos dígitos puros
        if not _INT_POS_RE.match(s):
            return None
        try:
            iv = int(s)
        except (ValueError, TypeError):
            return None
        if iv < 0:
            raise ValueError("El valor debe ser mayor o igual a 0")
        return iv
    # otros tipos inesperados -> ignorar filtro
    return None
