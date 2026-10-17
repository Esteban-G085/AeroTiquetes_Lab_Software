import {
  EMPTY_PERSONAL_DATA, rules, validateImagen, validatePersonalData, todayISO,
  validateProfile, validateCambioCorreo, validateCambioPassword, validateNuevoAdmin,
} from './validators'

const valid = {
  dni: '1088123456', nombres: 'María José', apellidos: "O'Brien-Gómez", fecha_nacimiento: '1998-05-10',
  lugar_nacimiento: 'Pereira', direccion_facturacion: 'Cra 8 # 20-15', genero: 'femenino',
  correo: 'maria@correo.com', usuario: 'maria.j', password: 'Clave1234',
}

describe('validatePersonalData', () => {
  it('datos correctos no producen errores', () => {
    expect(validatePersonalData(valid)).toEqual({})
  })

  it('formulario vacío marca los 10 campos', () => {
    expect(Object.keys(validatePersonalData(EMPTY_PERSONAL_DATA))).toHaveLength(10)
  })

  it('`skip` omite campos ya fijados (ej. correo del administrador)', () => {
    expect(validatePersonalData({ ...valid, correo: '' }, { skip: ['correo'] })).toEqual({})
  })
})

describe('reglas individuales', () => {
  it('DNI: solo dígitos, 5 a 15', () => {
    expect(rules.dni('12ab5')).toBeTruthy()
    expect(rules.dni('1234')).toBeTruthy()
    expect(rules.dni('12345')).toBeNull()
  })
  it('nombres aceptan tildes y rechazan números', () => {
    expect(rules.nombres('José Ángel')).toBeNull()
    expect(rules.nombres('Ana2')).toBeTruthy()
  })
  it('fecha de nacimiento: no futura ni absurda', () => {
    const today = '2026-10-14'
    expect(rules.fecha_nacimiento('2026-10-15', { today })).toMatch(/futura/)
    expect(rules.fecha_nacimiento('2026-10-14', { today })).toBeNull()
    expect(rules.fecha_nacimiento('1800-01-01', { today })).toBeTruthy()
    expect(rules.fecha_nacimiento('2026-13-45', { today })).toBeTruthy()
  })
  it('correo', () => {
    expect(rules.correo('a@b')).toBeTruthy()
    expect(rules.correo('a@b.co')).toBeNull()
  })
  it('usuario: 4 a 20, sin espacios ni símbolos', () => {
    expect(rules.usuario('abc')).toBeTruthy()
    expect(rules.usuario('con espacio')).toBeTruthy()
    expect(rules.usuario('ana_2026')).toBeNull()
  })
  it('contraseña: 8+, letras y números; los espacios cuentan', () => {
    expect(rules.password('corta1')).toBeTruthy()
    expect(rules.password('sololetrasaqui')).toBeTruthy()
    expect(rules.password('12345678')).toBeTruthy()
    expect(rules.password('Clave1234')).toBeNull()
  })
  it('género debe ser una de las opciones', () => {
    expect(rules.genero('x')).toBeTruthy()
    expect(rules.genero('otro')).toBeNull()
  })
})

describe('todayISO', () => {
  it('usa la fecha local, no UTC', () => {
    expect(todayISO(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })
})

describe('validateImagen', () => {
  const file = (type, size) => ({ type, size })
  it('es opcional', () => expect(validateImagen(null)).toBeNull())
  it('acepta JPG/PNG de hasta 2 MB', () => {
    expect(validateImagen(file('image/png', 2 * 1024 * 1024))).toBeNull()
    expect(validateImagen(file('image/jpeg', 1000))).toBeNull()
  })
  it('rechaza otros formatos y archivos pesados', () => {
    expect(validateImagen(file('image/gif', 1000))).toMatch(/JPG o PNG/)
    expect(validateImagen(file('image/png', 2 * 1024 * 1024 + 1))).toMatch(/2 MB/)
  })
})

describe('validateProfile (HU2)', () => {
  it('solo exige los campos editables: ignora dni, correo, usuario y contraseña', () => {
    const editable = {
      nombres: 'Ana', apellidos: 'Gómez', fecha_nacimiento: '2000-01-01',
      lugar_nacimiento: 'Cali', direccion_facturacion: 'Calle 1', genero: 'otro',
    }
    expect(validateProfile(editable)).toEqual({})
    expect(Object.keys(validateProfile({}))).toEqual(
      ['nombres', 'apellidos', 'fecha_nacimiento', 'lugar_nacimiento', 'direccion_facturacion', 'genero'])
  })
})

describe('validateCambioCorreo (D8)', () => {
  it('exige correo válido y contraseña actual', () => {
    expect(validateCambioCorreo({ correo_nuevo: 'x', password_actual: '' }, 'a@b.co'))
      .toEqual({ correo_nuevo: 'Escribe un correo válido.', password_actual: expect.any(String) })
  })
  it('rechaza el mismo correo (sin distinguir mayúsculas)', () => {
    expect(validateCambioCorreo({ correo_nuevo: 'A@B.co', password_actual: 'x' }, 'a@b.co').correo_nuevo).toMatch(/mismo correo/)
  })
  it('acepta uno distinto', () => {
    expect(validateCambioCorreo({ correo_nuevo: 'nuevo@b.co', password_actual: 'x' }, 'a@b.co')).toEqual({})
  })
})

describe('validateCambioPassword (HU3)', () => {
  const ok = { password_actual: 'Vieja1234', password_nueva: 'Nueva5678', confirmar: 'Nueva5678' }
  it('caso correcto', () => expect(validateCambioPassword(ok)).toEqual({}))
  it('exige la actual', () => expect(validateCambioPassword({ ...ok, password_actual: '' }).password_actual).toBeTruthy())
  it('la nueva cumple la política', () => {
    expect(validateCambioPassword({ ...ok, password_nueva: 'corta', confirmar: 'corta' }).password_nueva).toBeTruthy()
  })
  it('la nueva debe ser distinta de la actual', () => {
    expect(validateCambioPassword({ ...ok, password_nueva: 'Vieja1234', confirmar: 'Vieja1234' }).password_nueva).toMatch(/distinta/)
  })
  it('la confirmación debe coincidir (no hay "olvidé mi contraseña", D9)', () => {
    expect(validateCambioPassword({ ...ok, confirmar: 'Otra12345' }).confirmar).toMatch(/no coinciden/)
  })
})

describe('validateNuevoAdmin (HU23)', () => {
  it('solo pide nombre y correo', () => {
    expect(validateNuevoAdmin({ nombre: 'Camila Torres', correo: 'camila@123.com' })).toEqual({})
    expect(Object.keys(validateNuevoAdmin({ nombre: '', correo: '' }))).toEqual(['nombre', 'correo'])
  })
  it('rechaza nombres con números y correos inválidos', () => {
    expect(validateNuevoAdmin({ nombre: 'Ana2', correo: 'a@b.co' }).nombre).toBeTruthy()
    expect(validateNuevoAdmin({ nombre: 'Ana', correo: 'no-es-correo' }).correo).toBeTruthy()
  })
})
