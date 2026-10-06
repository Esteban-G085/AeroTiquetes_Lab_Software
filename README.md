# AeroTiquetes – Laboratorio de Software

Sistema de gestión para compra y reserva de tiquetes aéreos en línea. Desarrollado con **FastAPI**, **React**, **PostgreSQL** y **Mailpit**.

## ¿Qué se va a hacer?

En el **Sprint 1** se construirá la base funcional del sistema para permitir el flujo completo de autenticación, gestión de usuarios y ciclo básico de vuelos.

### Funcionalidades a implementar

- **Autenticación y roles**: Soporte para cuatro roles (Root, Administrador, Cliente y Visitante). Inicio de sesión con usuario o correo, con tokens JWT y expiración por inactividad (30 min).
- **Gestión de usuarios**: Registro de clientes, gestión de perfil, cambio de contraseña, invitación y registro de administradores (vía enlace único al correo con Mailpit), y matriz de roles editable por el Root.
- **Administración de vuelos**: El administrador podrá programar vuelos (generando código consecutivo, hora de llegada con zona horaria y cupos por clase) y consultarlos en modo solo lectura.
- **Búsqueda de vuelos**: Visitantes y clientes podrán buscar vuelos con criterios combinables (origen, destino, fecha, precio, duración y clase), ver resultados y consultar el detalle de cada vuelo.
- **Datos semilla**: Catálogo de ciudades (32 capitales de departamento + ciudades internacionales), vuelos de ejemplo y creación automática del usuario Root al iniciar la aplicación.

### Demo a mostrar

1. El sistema crea el Root por defecto. El Root inicia sesión y crea un Administrador (se envía correo a Mailpit).
2. El Administrador completa su registro desde el enlace recibido e inicia sesión.
3. El Administrador programa un vuelo nacional y uno internacional.
4. Un Visitante busca vuelos, combina filtros y abre el detalle de uno.
5. El Visitante se registra como Cliente, inicia sesión, edita su perfil y cambia su contraseña.
6. El Root revisa la matriz de roles y accesos.

## Tecnologías

- **Backend**: Python, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2, JWT, bcrypt
- **Frontend**: React + Vite, Bootstrap, Axios, MSW (para mocks de API)
- **Base de datos**: PostgreSQL
- **Correo (desarrollo)**: Mailpit (SMTP 1025, UI 8025)
- **Pruebas**: Pytest (backend), Vitest (frontend)

## Estructura del proyecto

```text
Proyecto/
├── backend/
│   ├── app/
│   │   ├── core/              # Config, seguridad, BD, errores y correo
│   │   ├── modules/           # usuarios/, vuelos/, busqueda/
│   │   └── main.py
│   ├── alembic/               # Migraciones
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── features/          # usuarios/, vuelos/, busqueda/
│       ├── components/        # Componentes reutilizables
│       ├── services/          # Axios
│       ├── context/           # Autenticación/Sesión
│       ├── routes/            # Rutas protegidas por rol
│       └── mocks/             # MSW
├── Plan_Sprint_1.md           # Plan completo del Sprint 1
├── parte3.txt                 # Requerimientos para iteraciones 2–4
└── README.md
```

## Documentación

- Ver [Plan_Sprint_1.md](./Plan_Sprint_1.md) para el plan detallado: reparto por equipo, tareas, hitos, modelo de datos, reglas de negocio y criterios de aceptación.
- Ver [parte3.txt](../parte3.txt) para los módulos de Check-in, Recomendación y Chatbot (Iteraciones 2–4).