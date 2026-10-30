import { http } from '@/services/http'
import {
  registrarCliente, buildPersonalDataFormData, obtenerPerfil, actualizarPerfil, solicitarCambioCorreo, cambiarPassword,
  listarAdministradores, crearAdministrador, eliminarAdministrador, validarInvitacion, completarRegistro, obtenerRoles,
} from './api'

const values = {
  dni: ' 123 ', nombres: ' Ana ', apellidos: 'Gómez', fecha_nacimiento: '2000-01-01', lugar_nacimiento: 'Cali',
  direccion_facturacion: 'Calle 1', genero: 'femenino', correo: 'a@b.co', usuario: 'ana_g', password: ' Clave 123 ',
}

describe('API de usuarios', () => {
  it('arma multipart: recorta textos, NO recorta la contraseña y adjunta la imagen', () => {
    const img = new File(['x'], 'foto.png', { type: 'image/png' })
    const fd = buildPersonalDataFormData(values, img)
    expect(fd.get('dni')).toBe('123')
    expect(fd.get('nombres')).toBe('Ana')
    expect(fd.get('password')).toBe(' Clave 123 ')
    expect(fd.get('imagen')).toBeInstanceOf(File)
  })

  it('sin foto no envía el campo imagen', () => {
    expect(buildPersonalDataFormData(values, null).has('imagen')).toBe(false)
  })

  it('registrarCliente hace POST /auth/registro con FormData', async () => {
    let seen
    http.defaults.adapter = async (config) => { seen = config; return { status: 201, data: { id: 5 }, headers: {}, config } }
    await expect(registrarCliente(values, null)).resolves.toEqual({ id: 5 })
    expect(seen.method).toBe('post')
    expect(seen.url).toBe('/auth/registro')
    expect(seen.data).toBeInstanceOf(FormData)
  })

  describe('perfil y contraseña', () => {
    let seen
    beforeEach(() => {
      seen = null
      http.defaults.adapter = async (config) => { seen = config; return { status: 200, data: { ok: true }, headers: {}, config } }
    })

    it('obtenerPerfil -> GET /me', async () => {
      await obtenerPerfil()
      expect(seen.method).toBe('get'); expect(seen.url).toBe('/me')
    })

    it('actualizarPerfil -> PUT /me multipart con la foto', async () => {
      await actualizarPerfil({ nombres: ' Ana ' }, new File(['x'], 'f.png', { type: 'image/png' }))
      expect(seen.method).toBe('put'); expect(seen.url).toBe('/me')
      expect(seen.data.get('nombres')).toBe('Ana')
      expect(seen.data.get('imagen')).toBeInstanceOf(File)
    })

    it('solicitarCambioCorreo -> PUT /me con correo_nuevo y password_actual sin recortar', async () => {
      await solicitarCambioCorreo({ correo_nuevo: ' n@b.co ', password_actual: ' Clave 1 ' })
      expect(seen.url).toBe('/me')
      expect(seen.data.get('correo_nuevo')).toBe('n@b.co')
      expect(seen.data.get('password_actual')).toBe(' Clave 1 ')
    })

    it('cambiarPassword -> PUT /me/password en JSON', async () => {
      await cambiarPassword({ password_actual: 'a', password_nueva: 'b' })
      expect(seen.method).toBe('put'); expect(seen.url).toBe('/me/password')
      expect(JSON.parse(seen.data)).toEqual({ password_actual: 'a', password_nueva: 'b' })
    })
  })
})

describe('API de administradores, invitación y roles', () => {
  let seen
  beforeEach(() => {
    seen = null
  })
  const reply = (data, status = 200) => {
    http.defaults.adapter = async (config) => { seen = config; return { status, data, headers: {}, config } }
  }

  it('listarAdministradores acepta arreglo o { items }', async () => {
    reply([{ id: 1 }])
    await expect(listarAdministradores()).resolves.toEqual([{ id: 1 }])
    reply({ items: [{ id: 2 }] })
    await expect(listarAdministradores()).resolves.toEqual([{ id: 2 }])
  })

  it('crearAdministrador -> POST JSON recortado con solo nombre y correo', async () => {
    reply({}, 201)
    await crearAdministrador({ nombre: ' Ana ', correo: ' a@b.co ' })
    expect(seen.method).toBe('post'); expect(seen.url).toBe('/root/administradores')
    expect(JSON.parse(seen.data)).toEqual({ nombre: 'Ana', correo: 'a@b.co' })
  })

  it('eliminarAdministrador -> DELETE /root/administradores/{id}', async () => {
    reply(null, 204)
    await eliminarAdministrador(5)
    expect(seen.method).toBe('delete'); expect(seen.url).toBe('/root/administradores/5')
  })

  it('validarInvitacion envía el token como query', async () => {
    reply({ correo: 'a@b.co' })
    await validarInvitacion('tok123')
    expect(seen.method).toBe('get'); expect(seen.url).toBe('/auth/completar-registro')
    expect(seen.params).toEqual({ token: 'tok123' })
  })

  it('completarRegistro -> multipart con los campos y el token', async () => {
    reply({})
    await completarRegistro('tok123', { nombres: ' Ana ', password: ' Clave 1 ' }, null)
    expect(seen.method).toBe('post'); expect(seen.url).toBe('/auth/completar-registro')
    expect(seen.data).toBeInstanceOf(FormData)
    expect(seen.data.get('token')).toBe('tok123')
    expect(seen.data.get('nombres')).toBe('Ana')
    expect(seen.data.get('password')).toBe(' Clave 1 ')
  })
})
