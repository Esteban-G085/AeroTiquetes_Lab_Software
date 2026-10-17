"""Expiracion del JWT (RNF06: cierre de sesion por inactividad, 30 min)."""
from app.core import security
from tests.conftest import auth_headers, datos_registro_cliente


def test_token_expirado_es_rechazado(client, monkeypatch):
    client.post("/auth/registro", data=datos_registro_cliente())

    # Genera un token ya vencido (expiracion de -1 minuto) sin esperar 30
    # minutos reales ni depender de una libreria externa de "congelar" el
    # tiempo.
    monkeypatch.setattr(security.settings, "JWT_EXPIRE_MINUTES", -1)
    resp_login = client.post(
        "/auth/login", json={"identificador": "anagomez", "password": "clavesegura123"}
    )
    token_vencido = resp_login.json()["access_token"]

    resp = client.get("/me", headers=auth_headers(token_vencido))
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "token_invalido"


def test_token_valido_dentro_de_la_ventana_funciona(client):
    client.post("/auth/registro", data=datos_registro_cliente())
    resp_login = client.post(
        "/auth/login", json={"identificador": "anagomez", "password": "clavesegura123"}
    )
    token = resp_login.json()["access_token"]
    resp = client.get("/me", headers=auth_headers(token))
    assert resp.status_code == 200
