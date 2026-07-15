// Helper de API: fetch a rutas relativas /api/... (funciona con proxy en dev y en prod servido por Express).

const TOKEN_KEY = 'lavatrack.token'
const USUARIO_KEY = 'lavatrack.usuario'

// Devuelve los headers con el Authorization: Bearer <token> si hay token guardado.
function authHeaders(extra = {}) {
  const headers = { ...extra }
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) headers['Authorization'] = `Bearer ${token}`
  } catch {
    // localStorage no disponible: seguimos sin token.
  }
  return headers
}

async function handle(res) {
  // Sesión inválida o expirada: limpiamos credenciales y volvemos al login
  // (salvo que ya estemos en /login, para no romper el flujo de un login fallido).
  if (res.status === 401) {
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USUARIO_KEY)
    } catch {
      // ignorar
    }
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  }

  if (res.status === 204) return null
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    const mensaje = (data && data.error) || 'Ocurrió un error inesperado'
    const err = new Error(mensaje)
    err.status = res.status
    err.body = data
    throw err
  }
  return data
}

// Arma un querystring a partir de un objeto, ignorando valores vacíos/nulos.
export function qs(params = {}) {
  const usp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') usp.append(k, v)
  })
  const s = usp.toString()
  return s ? `?${s}` : ''
}

export function get(path) {
  return fetch(`/api${path}`, { headers: authHeaders() }).then(handle)
}

export function post(path, body, headers = {}) {
  return fetch(`/api${path}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json', ...headers }),
    body: JSON.stringify(body),
  }).then(handle)
}

export function put(path, body) {
  return fetch(`/api${path}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  }).then(handle)
}

export function del(path) {
  return fetch(`/api${path}`, { method: 'DELETE', headers: authHeaders() }).then(handle)
}

export default { get, post, put, del, qs }
