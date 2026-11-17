from app.core.db import engine
from sqlalchemy import text

fixes = [
    # (tabla, columna, definicion)
    ("suscripcion", "correo", "VARCHAR(255) NOT NULL DEFAULT 'no@email.com'"),
    ("suscripcion", "activa", "BOOLEAN NOT NULL DEFAULT TRUE"),
    ("suscripcion", "token_cancelacion", "VARCHAR(64) NOT NULL DEFAULT 'token'"),
    ("suscripcion", "creada_en", "TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()"),
    ("suscripcion", "cancelada_en", "TIMESTAMP WITH TIME ZONE"),
    ("asiento", "id", "SERIAL PRIMARY KEY"),
    ("asiento", "id_vuelo", "INTEGER NOT NULL"),
    ("asiento", "numero", "VARCHAR(5) NOT NULL"),
    ("asiento", "fila", "INTEGER NOT NULL"),
    ("asiento", "columna", "VARCHAR(1) NOT NULL"),
    ("asiento", "clase", "VARCHAR(20) NOT NULL DEFAULT 'economica'"),
    ("asiento", "estado", "VARCHAR(20) NOT NULL DEFAULT 'disponible'"),
    ("asiento", "id_tiquete", "INTEGER"),
]

with engine.connect() as conn:
    for tabla, columna, definicion in fixes:
        r = conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name='{tabla}' AND column_name='{columna}'"))
        if not r.fetchone():
            if columna == "id" and tabla == "asiento":
                conn.execute(text(f"ALTER TABLE {tabla} ADD COLUMN {columna} {definicion}"))
            else:
                conn.execute(text(f"ALTER TABLE {tabla} ADD COLUMN {columna} {definicion}"))
            conn.commit()
            print(f"OK: {tabla}.{columna} agregada")
        else:
            print(f"OK: {tabla}.{columna} ya existe")

print('Listo')
