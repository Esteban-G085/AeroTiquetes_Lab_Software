"""
Formato de error unico para toda la API (seccion 5.3 del plan de sprint):

    { "error": { "code": "...", "message": "...", "fields": {...} } }

`fields` es opcional y se usa para errores de validacion por campo
(ej. unicidad de correo/usuario/DNI). Todos los modulos (usuarios, y despues
vuelos/busqueda) lanzan `AppError` en vez de HTTPException directamente, para
que la respuesta siempre tenga esta forma sin repetir el envoltorio.
"""
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    """Error de negocio/aplicacion con codigo HTTP y codigo logico propios."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        code: str = "error",
        fields: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.fields = fields


def _error_response(status_code: int, code: str, message: str, fields: dict[str, Any] | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "fields": fields}},
    )


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return _error_response(exc.status_code, exc.code, exc.message, exc.fields)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        fields: dict[str, Any] = {}
        for err in exc.errors():
            loc = ".".join(str(p) for p in err["loc"] if p != "body")
            fields[loc or "body"] = err["msg"]
        return _error_response(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "validacion",
            "Los datos enviados no son validos.",
            fields,
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        # Normaliza tambien los HTTPException "crudos" (ej. 404 de ruta no encontrada)
        return _error_response(exc.status_code, "http_error", str(exc.detail))

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        return _error_response(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "error_interno",
            "Ocurrio un error inesperado. Intenta de nuevo mas tarde.",
        )
