import { http } from './http'

/**
 * Adaptador de la respuesta de /auth/login. ES EL ÚNICO LUGAR que conoce su forma:
 * si B1 define nombres distintos en el contrato (B1-00), solo se ajusta aquí.
 * Supuesto actual: { access_token, rol, usuario: { ... } }
 */
export function mapLoginResponse(data) {
  return {
    token: data.access_token ?? data.token,
    rol: data.rol ?? data.usuario?.rol,
    user: data.usuario ?? data.user ?? {},
  }
}

export async function login(identificador, password) {
  const { data } = await http.post('/auth/login', { identificador, password })
  return mapLoginResponse(data)
}
