#!/usr/bin/env python3
"""
Recorrido de funcionalidades en un navegador real (Chromium) contra un backend SIMULADO.
Verifica los flujos de extremo a extremo del módulo Usuarios: sesión y rutas protegidas, registro, perfil,
cambio de correo y de contraseña, panel root (administradores y roles) y primer ingreso del administrador.

Requisitos:  pip install playwright && playwright install chromium
Uso:         npm run dev   (en otra terminal)   y luego   npm run e2e      [BASE=http://localhost:5173]
Complementa a Vitest (que usa jsdom) y a audit-ui.py (que revisa estilos, accesibilidad y desbordes).
"""
import base64, json, time

CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'}
PERFIL={'id':7,'rol':'cliente','dni':'11111','nombres':'María José','apellidos':'Gómez Ríos','fecha_nacimiento':'1998-05-10',
 'lugar_nacimiento':'Pereira','direccion_facturacion':'Cra 8 # 20-15','genero':'femenino','correo':'usuario@123.com','usuario':'maria.j','imagen_url':None}
def jwt(rol):
    b=lambda o: base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
    return f"{b({'alg':'x'})}.{b({'sub':'7','rol':rol,'exp':int(time.time())+1800})}.s"
def seed(pg,rol='cliente',user=None):
    pg.goto(B+'/login')
    pg.evaluate("([t,u])=>{sessionStorage.setItem('at.token',t);sessionStorage.setItem('at.user',u)}",[jwt(rol),json.dumps(user or {'nombres':'María José'})])
def fulfill(route,status=200,body=None):
    route.fulfill(status=status,headers=CORS,content_type='application/json',body=json.dumps(body if body is not None else {}))

ADMINS=[{'id':1,'nombre':'Jose Luis','correo':'jose1@123.com','estado':'activo','imagen_url':None},
        {'id':2,'nombre':'Manolo','correo':'manolito@123.com','estado':'activo','imagen_url':None},
        {'id':3,'nombre':'Camila Torres','correo':'camila@123.com','estado':'pendiente','imagen_url':None}]
ROLES={'modulos':[{'id':'usuarios','nombre':'Usuarios'},{'id':'vuelos','nombre':'Vuelos'},{'id':'busqueda','nombre':'Búsqueda'},{'id':'reservas','nombre':'Reservas y compras'}],
 'roles':[{'id':'root','nombre':'Root','descripcion':'Control total del sistema','editable':False,'modulos':{'usuarios':True,'vuelos':True,'busqueda':True,'reservas':False}},
          {'id':'administrador','nombre':'Administrador','descripcion':'Vuelos y noticias','editable':True,'modulos':{'usuarios':False,'vuelos':True,'busqueda':True,'reservas':False}},
          {'id':'cliente','nombre':'Cliente','descripcion':'Reservas y compras','editable':True,'modulos':{'usuarios':False,'vuelos':False,'busqueda':True,'reservas':True}},
          {'id':'visitante','nombre':'Visitante','descripcion':'Búsqueda y check-in','editable':True,'modulos':{'usuarios':False,'vuelos':False,'busqueda':True,'reservas':False}}]}

import re, sys, tempfile, os
from playwright.sync_api import sync_playwright

B = os.environ.get('BASE', 'http://localhost:5173'); API = 'http://localhost:8000'

# PNG mínimo de 1×1 para probar la subida de foto (sin depender de Pillow)
FOTO = os.path.join(tempfile.gettempdir(), 'at-foto.png')
open(FOTO, 'wb').write(bytes.fromhex('89504e470d0a1a0a0000000d4948445200000001000000010806000000'+'1f15c4890000000d49444154789c6360f8cfc00000030101000518d84e0000000049454e44ae426082'))
perfil=dict(PERFIL); admins=[dict(a) for a in ADMINS]; roles=json.loads(json.dumps(ROLES)); log=[]; ok=[]; bad=[]
def check(name, cond, extra=''):
    (ok if cond else bad).append(name); print(('  ✓ ' if cond else '  ✗ ')+name+(f'  [{extra}]' if extra and not cond else ''))
def opt(r): return r.request.method=='OPTIONS'

def handler(route):
    r=route.request
    if opt(route): return route.fulfill(status=204,headers=CORS)
    u=r.url.replace(API,''); m=r.method
    if u=='/auth/login':
        d=json.loads(r.post_data)
        if d['password']=='bien': return fulfill(route,200,{'access_token':jwt('cliente'),'rol':'cliente','usuario':{'nombres':'María José'}})
        return fulfill(route,401,{'error':{'code':'CRED','message':'x','fields':{}}})
    if u=='/auth/registro':
        body=r.post_data_buffer.decode('latin1'); log.append(('registro',r.headers.get('content-type','').split(';')[0],sorted(set(re.findall(r'name="([a-z_]+)"',body)))))
        if 'jose1@123.com' in body: return fulfill(route,409,{'error':{'code':'DUP','message':'d','fields':{'correo':'Este correo ya está registrado'}}})
        return fulfill(route,201,{})
    if u=='/me' and m=='GET': return fulfill(route,200,perfil)
    if u=='/me' and m=='PUT':
        body=r.post_data_buffer.decode('latin1'); fields=sorted(set(re.findall(r'name="([a-z_]+)"',body))); log.append(('put_me',fields))
        if 'correo_nuevo' in fields:
            if 'Mala' in body: return fulfill(route,400,{'error':{'code':'P','message':'x','fields':{'password_actual':'La contraseña no es correcta'}}})
            perfil['correo_pendiente']='nuevo@123.com'; return fulfill(route,202,{})
        mm=re.search(r'name="nombres"\r\n\r\n(.*?)\r\n',body)
        if mm: perfil['nombres']=mm.group(1)
        return fulfill(route,200,perfil)
    if u=='/me/password':
        d=json.loads(r.post_data); log.append(('pw',d))
        if d['password_actual']=='Mala12345': return fulfill(route,400,{'error':{'code':'PW','message':'x','fields':{'password_actual':'La contraseña actual no coincide'}}})
        return fulfill(route,200,{})
    if u=='/root/administradores' and m=='GET': return fulfill(route,200,admins)
    if u=='/root/administradores' and m=='POST':
        d=json.loads(r.post_data); log.append(('adm_post',d)); admins.append({'id':9,'nombre':d['nombre'],'correo':d['correo'],'estado':'pendiente','imagen_url':None}); return fulfill(route,201,{})
    if u.startswith('/root/administradores/') and m=='DELETE':
        i=u.split('/')[-1]; log.append(('adm_del',i)); admins[:]=[a for a in admins if str(a['id'])!=i]; return route.fulfill(status=204,headers=CORS)
    if u=='/root/roles' and m=='GET': return fulfill(route,200,roles)
    if u=='/root/roles' and m=='PUT':
        d=json.loads(r.post_data); log.append(('roles_put',d))
        for ch in d['roles']:
            for x in roles['roles']:
                if x['id']==ch['id']: x['modulos']=ch['modulos']
        return fulfill(route,200,{})
    if u.startswith('/auth/completar-registro'):
        if m=='GET': return fulfill(route,200,{'correo':'camila@123.com','nombre':'Camila'}) if 'vencido' not in u else fulfill(route,410,{'error':{'code':'E','message':'x'}})
        body=r.post_data_buffer.decode('latin1'); log.append(('completar',sorted(set(re.findall(r'name="([a-z_]+)"',body))),'tok123' in body)); return fulfill(route,201,{})
    fulfill(route,200,{})

with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def page(vp):
        pg=b.new_page(viewport={'width':vp[0],'height':vp[1]}); pg.on('pageerror',lambda e:errs.append(str(e))); pg.route(API+'/**',handler); return pg

    print('\n[1] Sesión y rutas protegidas (escritorio)')
    pg=page((1280,800)); pg.goto(B+'/perfil'); pg.wait_for_url('**/login')
    check('ruta privada sin sesión → /login', pg.url.endswith('/login'))
    pg.get_by_role('button',name='Iniciar sesión').click()
    check('campos vacíos muestran errores', pg.get_by_text('Escribe tu usuario o correo.').is_visible())
    pg.get_by_label('Escribe tu usuario o correo electrónico').fill('ana'); pg.get_by_label('Escribe tu contraseña').fill('mal')
    pg.get_by_role('button',name='Iniciar sesión').click(); pg.get_by_role('alert').filter(has_text='incorrectos').wait_for()
    check('credenciales malas → mensaje genérico', True)
    pw=pg.get_by_label('Escribe tu contraseña'); pg.get_by_role('button',name='Mostrar contraseña').click()
    check('mostrar contraseña funciona', pw.get_attribute('type')=='text'); pg.get_by_role('button',name='Ocultar contraseña').click()
    pw.fill('bien'); pg.get_by_role('button',name='Iniciar sesión').click(); pg.wait_for_url('**/perfil')
    check('login correcto vuelve a la ruta que quería (/perfil)', pg.url.endswith('/perfil'))
    pg.reload(); pg.get_by_role('heading',level=1).wait_for(); check('la sesión sobrevive a recargar', pg.url.endswith('/perfil'))

    print('\n[2] Perfil, correo y contraseña')
    check('muestra nombre y documento', pg.get_by_role('heading',level=1).inner_text()=='María José Gómez Ríos' and pg.get_by_text('Documento: 11111').is_visible())
    pg.get_by_role('button',name='Editar mis datos').click()
    check('el documento no es editable', pg.get_by_label('Documento').count()==0)
    pg.set_input_files('input[type=file]',FOTO); pg.get_by_label('Nombres').fill('Laura')
    pg.get_by_role('button',name='Guardar cambios').click(); pg.get_by_text('Perfil actualizado').wait_for()
    f=[x for x in log if x[0]=='put_me'][0][1]
    check('PUT /me multipart con foto y sin dni/correo/usuario', 'imagen' in f and not any(k in f for k in ['dni','correo','usuario']), str(f))
    check('el nombre se refresca', 'Laura' in pg.get_by_role('heading',level=1).inner_text())
    pg.get_by_role('button',name='Cambiar correo').click(); d=pg.get_by_role('dialog')
    d.get_by_label('Correo nuevo').press_sequentially('nuevo@123.com',delay=15)
    check('se puede escribir en el diálogo sin perder el foco', d.get_by_label('Correo nuevo').input_value()=='nuevo@123.com')
    d.get_by_label('Contraseña actual').press_sequentially('Mala1234',delay=15); d.get_by_role('button',name='Enviar enlace').click()
    d.get_by_text('La contraseña no es correcta').wait_for(); check('error del backend en su campo', True)
    d.get_by_label('Contraseña actual').fill('Clave1234'); d.get_by_role('button',name='Enviar enlace').click()
    pg.get_by_text('Pendiente de verificar').wait_for(); check('correo pendiente de verificación se informa', True)
    pg.get_by_role('button',name='Cambiar contraseña').click(); pg.wait_for_url('**/perfil/password')
    pg.get_by_label('Contraseña actual').fill('Mala12345'); pg.get_by_label('Nueva contraseña',exact=True).fill('Nueva5678'); pg.get_by_label('Confirmar nueva contraseña').fill('Nueva5678')
    pg.get_by_role('button',name='Guardar cambios').click(); pg.get_by_text('La contraseña actual no coincide').wait_for(); check('contraseña actual incorrecta → error en su campo', True)
    pg.get_by_label('Contraseña actual').fill('Vieja1234'); pg.get_by_role('button',name='Guardar cambios').click(); pg.wait_for_url('**/perfil')
    check('cambio de contraseña exitoso vuelve al perfil', json.dumps([x for x in log if x[0]=='pw'][-1][1])==json.dumps({'password_actual':'Vieja1234','password_nueva':'Nueva5678'}))

    print('\n[3] Menú de cuenta y cierre de sesión (escritorio)')
    pg.goto(B+'/'); pg.get_by_role('button',name='María José').click() if pg.get_by_role('button',name='María José').count() else pg.get_by_role('button',name=re.compile('Laura|María')).first.click()
    check('el menú muestra "Mi perfil" y "Cerrar sesión"', pg.get_by_role('menuitem',name='Mi perfil').is_visible() and pg.get_by_role('menuitem',name='Cerrar sesión').is_visible())
    pg.get_by_role('menuitem',name='Cerrar sesión').click(); pg.get_by_role('link',name='Registrarse').wait_for()
    check('cerrar sesión limpia el token', pg.evaluate("sessionStorage.getItem('at.token')") is None); pg.close()

    print('\n[4] Registro')
    pg=page((1280,800)); pg.goto(B+'/registro'); pg.set_input_files('input[type=file]',FOTO)
    for l,v in [('Nombres','María José'),('Apellidos','Gómez'),('Documento (DNI)','1088123456'),('Lugar de nacimiento','Pereira'),('Dirección de facturación','Cra 8 # 20-15'),('Correo','jose1@123.com'),('Usuario','maria.j'),('Contraseña','Clave1234')]: pg.get_by_label(l,exact=True).fill(v)
    pg.get_by_label('Fecha de nacimiento').fill('1998-05-10'); pg.get_by_label('Género').select_option('femenino')
    pg.get_by_role('button',name='Registrarse').click(); pg.get_by_text('Este correo ya está registrado').wait_for()
    check('correo duplicado (409) se muestra en su campo', True)
    reg=log[-1]; check('POST /auth/registro es multipart con los 11 campos', reg[1]=='multipart/form-data' and len(reg[2])==11, str(reg))
    pg.get_by_label('Correo').fill('nuevo@123.com'); pg.get_by_role('button',name='Registrarse').click(); pg.wait_for_url('**/login')
    check('registro correcto lleva al login con aviso', pg.get_by_text('Cuenta creada').is_visible()); pg.close()

    print('\n[5] Panel root (escritorio)')
    pg=page((1280,800)); pg.goto(B+'/login'); pg.evaluate("([t,u])=>{sessionStorage.setItem('at.token',t);sessionStorage.setItem('at.user',u)}",[jwt('root'),json.dumps({'usuario':'root'})])
    pg.goto(B+'/root/administradores'); pg.get_by_text('Jose Luis').wait_for()
    check('lista con estado activo y pendiente', pg.get_by_text('Activo').first.is_visible() and pg.get_by_text('Pendiente').is_visible())
    pg.get_by_label('Nombre').fill('Nuevo Admin'); pg.get_by_label('Correo').fill('nuevo@123.com'); pg.get_by_role('button',name='Crear administrador').click(); pg.locator('.us-adm__item',has_text='Nuevo Admin').wait_for()
    check('crear administrador (solo nombre y correo) y aparece pendiente', [x for x in log if x[0]=='adm_post'][-1][1]=={'nombre':'Nuevo Admin','correo':'nuevo@123.com'})
    pg.get_by_role('button',name='Eliminar a Nuevo Admin').click(); pg.get_by_role('dialog').get_by_role('button',name='Eliminar').click(); pg.locator('.us-adm__item',has_text='Nuevo Admin').wait_for(state='detached')
    check('eliminar pide confirmación y borra', [x for x in log if x[0]=='adm_del'][-1][1]=='9')
    pg.get_by_role('link',name='Roles',exact=True).click(); pg.get_by_role('table').wait_for()
    check('el rol root está bloqueado', pg.get_by_role('switch',name='Root: Vuelos').is_disabled())
    pg.get_by_role('switch',name='Cliente: Vuelos').click(); pg.get_by_role('button',name='Guardar cambios').click(); pg.get_by_text('Permisos actualizados').wait_for()
    rp=[x for x in log if x[0]=='roles_put'][-1][1]; check('PUT roles solo con el rol modificado', [r['id'] for r in rp['roles']]==['cliente'])
    pg.goto(B+'/admin/vuelos'); pg.get_by_text('No tienes acceso a esta sección').wait_for()
    check('403 real: el root abre /admin/vuelos (ruta de administrador) y ve la pantalla de acceso denegado', pg.get_by_role('link',name='Volver a mi inicio').is_visible()); pg.close()

    print('\n[6] Primer ingreso del administrador')
    pg=page((1280,800)); pg.goto(B+'/completar-registro?token=tok123'); pg.get_by_role('heading',name='Completar registro').wait_for()
    check('correo bloqueado y nombre precargado', pg.get_by_label('Correo').get_attribute('readonly') is not None and pg.get_by_label('Nombres').input_value()=='Camila')
    for l,v in [('Apellidos','Torres'),('Documento (DNI)','1088123456'),('Lugar de nacimiento','Pereira'),('Dirección de facturación','Cra 8'),('Usuario','camila.t'),('Contraseña','Clave1234')]: pg.get_by_label(l,exact=True).fill(v)
    pg.get_by_label('Fecha de nacimiento').fill('1995-03-02'); pg.get_by_label('Género').select_option('otro')
    pg.get_by_role('button',name='Completar registro').click(); pg.wait_for_url('**/login')
    c=[x for x in log if x[0]=='completar'][-1]; check('POST completar-registro incluye el token', c[2])
    pg.goto(B+'/completar-registro?token=vencido'); pg.get_by_role('heading',name='Enlace no válido').wait_for(); check('enlace vencido muestra "Enlace no válido"', True); pg.close()

    print('\n[7] Móvil (390 px): menú lateral')
    pg=page((390,844)); pg.goto(B+'/'); pg.get_by_role('button',name='Abrir menú').click(); dlg=pg.get_by_role('dialog',name='Menú'); dlg.wait_for()
    check('el panel lista Iniciar sesión y Registrarse', dlg.get_by_role('link',name='Iniciar sesión').is_visible() and dlg.get_by_role('link',name='Registrarse').is_visible())
    dlg.get_by_role('link',name='Iniciar sesión').click(); pg.wait_for_url('**/login'); check('navegar desde el panel funciona', pg.url.endswith('/login'))
    pg.close()
    pg=page((1280,800)); pg.goto(B+'/'); check('botón hamburguesa oculto en escritorio', not pg.get_by_role('button',name='Abrir menú').is_visible()); pg.close()
    check('sin errores de JavaScript en la página', not errs, str(errs)[:200])
    b.close()
print(f'\nRESULTADO: {len(ok)} correctas, {len(bad)} fallidas'); sys.exit(1 if bad else 0)
