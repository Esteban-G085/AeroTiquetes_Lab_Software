#!/usr/bin/env python3
"""
Auditoría de UI del módulo Usuarios en un navegador real (F1-09). Complementa a Vitest, que usa jsdom
y por eso NO puede ver estilos: desbordes horizontales, elementos tapados, contraste, etc.

Qué revisa, en cada pantalla y en 6 anchos (320 → 1280 px):
  1. Desborde horizontal (la página no debe tener scroll lateral).
  2. Accesibilidad con axe-core (WCAG 2.x A/AA, incluido contraste de color).
  3. Controles interactivos más pequeños que 24×24 px (mínimo WCAG 2.2).

Requisitos:  pip install playwright && playwright install chromium   ·   npm install (trae axe-core)
Uso:         npm run dev   (en otra terminal)   y luego   python3 scripts/audit-ui.py [--base http://localhost:5173]
El backend se SIMULA con respuestas de ejemplo: no hace falta tenerlo levantado.
"""
import argparse, base64, json, pathlib, sys, time
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
AXE = (ROOT / 'node_modules/axe-core/axe.min.js').read_text()
API = 'http://localhost:8000'
WIDTHS = [320, 375, 414, 768, 1024, 1280]
CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*'}

PERFIL = {'id': 7, 'rol': 'cliente', 'dni': '11111', 'nombres': 'María José', 'apellidos': 'Gómez Ríos',
          'fecha_nacimiento': '1998-05-10', 'lugar_nacimiento': 'Pereira', 'direccion_facturacion': 'Cra 8 # 20-15',
          'genero': 'femenino', 'correo': 'usuario@123.com', 'usuario': 'maria.j', 'imagen_url': None, 'correo_pendiente': None}
ADMINS = [{'id': 1, 'nombre': 'Jose Luis', 'correo': 'jose1@123.com', 'estado': 'activo', 'imagen_url': None},
          {'id': 3, 'nombre': 'Camila Torres', 'correo': 'camila@123.com', 'estado': 'pendiente', 'imagen_url': None}]
ROLES = {'modulos': [{'id': 'usuarios', 'nombre': 'Usuarios'}, {'id': 'vuelos', 'nombre': 'Vuelos'}, {'id': 'reservas', 'nombre': 'Reservas y compras'}],
         'roles': [{'id': r, 'nombre': r.capitalize(), 'descripcion': 'Descripción del rol', 'editable': r != 'root',
                    'modulos': {'usuarios': r == 'root', 'vuelos': r != 'visitante', 'reservas': r == 'cliente'}}
                   for r in ['root', 'administrador', 'cliente', 'visitante']]}

def jwt(rol):
    b = lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
    return f"{b({'alg': 'x'})}.{b({'sub': '1', 'rol': rol, 'exp': int(time.time()) + 3600})}.s"

# (nombre, ruta, rol de sesión o None, acción previa opcional)
def edit_profile(pg): pg.get_by_role('button', name='Editar mis datos').click()
def open_drawer(pg):
    # En escritorio la navegación está a la vista y el botón de menú se oculta: no hay panel que abrir
    burger = pg.get_by_role('button', name='Abrir menú')
    if burger.is_visible(): burger.click(); pg.wait_for_timeout(400)
def open_user_menu(pg):
    btn = pg.get_by_role('button', name='Ana')
    if btn.is_visible(): btn.click(); pg.wait_for_timeout(250)
def open_modal(pg): pg.get_by_role('button', name='Cambiar correo').click(); pg.wait_for_timeout(300)

SCREENS = [
    ('login', '/login', None, None),
    ('registro', '/registro', None, None),
    ('completar-registro', '/completar-registro?token=ok', None, None),
    ('completar-registro (enlace vencido)', '/completar-registro?token=vencido', None, None),
    ('perfil', '/perfil', 'cliente', None),
    ('perfil (edición)', '/perfil', 'cliente', edit_profile),
    ('perfil (diálogo de correo)', '/perfil', 'cliente', open_modal),
    ('cambiar contraseña', '/perfil/password', 'cliente', None),
    ('perfil root', '/perfil', 'root', None),
    ('administradores', '/root/administradores', 'root', None),
    ('roles', '/root/roles', 'root', None),
    ('menú lateral (móvil)', '/root/roles', 'root', open_drawer),
    ('menú de cuenta (escritorio)', '/', 'cliente', open_user_menu),
    ('inicio visitante', '/', None, None),
    ('catálogo de diseño y piezas de viaje', '/dev/ui', None, None),
    ('403', '/root/roles', 'cliente', None),
    ('404', '/no-existe', None, None),
]

def mock_api(pg):
    def handler(route):
        r = route.request
        if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
        url = r.url.replace(API, '')
        body, status = {}, 200
        if url.startswith('/me') and r.method == 'GET': body = PERFIL
        elif url.startswith('/root/administradores'): body = ADMINS
        elif url.startswith('/root/roles'): body = ROLES
        elif url.startswith('/auth/completar-registro') and r.method == 'GET':
            if 'vencido' in url: status, body = 410, {'error': {'code': 'EXPIRADO', 'message': 'x'}}
            else: body = {'correo': 'camila@123.com', 'nombre': 'Camila'}
        route.fulfill(status=status, headers=CORS, content_type='application/json', body=json.dumps(body))
    pg.route(API + '/**', handler)

def audit(base):
    problems, rows = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for name, path, rol, action in SCREENS:
            overflow_at, small, axe_found = [], {}, {}
            for w in WIDTHS:
                ctx = browser.new_context(viewport={'width': w, 'height': 800})
                pg = ctx.new_page(); mock_api(pg)
                if rol:
                    pg.goto(base + '/login')
                    pg.evaluate("([t,u])=>{sessionStorage.setItem('at.token',t);sessionStorage.setItem('at.user',u)}", [jwt(rol), json.dumps({'nombres': 'Ana', 'usuario': 'root'})])
                pg.goto(base + path); pg.wait_for_load_state('load'); pg.wait_for_timeout(900)  # no 'networkidle': el HMR de Vite mantiene una conexión abierta
                if action: action(pg)
                sw = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                if sw > 1: overflow_at.append(f'{w}px (+{sw})')
                if w in (375, 1280):
                    pg.add_script_tag(content=AXE)
                    res = pg.evaluate("axe.run(document,{runOnly:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']})")
                    for v in res['violations']:
                        axe_found.setdefault(v['id'], (v['impact'], v['help'], set()))[2].add(w)
                if w == 375:
                    for t in pg.evaluate("""() => [...document.querySelectorAll('button,a[href],input:not([type=hidden]):not(.visually-hidden),select,[role=switch]')]
                        .filter(e => e.offsetParent !== null && !e.closest('.visually-hidden') && !e.classList.contains('visually-hidden-focusable'))
                        .map(e => { const r = e.getBoundingClientRect(); return [e.getAttribute('aria-label') || e.textContent.trim().slice(0,30) || e.tagName, r.width, r.height] })
                        .filter(([,w,h]) => w < 24 || h < 24)"""):
                        small[t[0]] = f'{t[1]:.0f}×{t[2]:.0f}'
                ctx.close()
            rows.append((name, overflow_at, axe_found, small))
        browser.close()
    print(f"\n{'PANTALLA':38} {'DESBORDE':10} {'AXE':8} {'TARGETS<24px'}")
    for name, ov, ax, sm in rows:
        print(f"{name:38} {'✗ '+', '.join(ov) if ov else '✓':10} {('✗ %d' % len(ax)) if ax else '✓':8} {('✗ %d' % len(sm)) if sm else '✓'}")
        for k, (imp, helptxt, ws) in ax.items(): problems.append(f'[{name}] axe {k} ({imp}) en {sorted(ws)}px: {helptxt}')
        for k in ov: problems.append(f'[{name}] desborde horizontal a {k}')
        for k, v in sm.items(): problems.append(f'[{name}] control pequeño: "{k}" {v}')
    print()
    for pr in problems: print(' -', pr)
    print(f"\n{len(problems)} hallazgo(s)." if problems else '\nSin hallazgos.')
    return 1 if problems else 0

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--base', default='http://localhost:5173')
    sys.exit(audit(ap.parse_args().base))
