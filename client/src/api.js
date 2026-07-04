// Helper de API: fetch a rutas relativas /api/... (funciona con proxy en dev y en prod servido por Express).

async function handle(res) {
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
  return fetch(`/api${path}`).then(handle)
}

export function post(path, body) {
  return fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(handle)
}

export function put(path, body) {
  return fetch(`/api${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(handle)
}

export function del(path) {
  return fetch(`/api${path}`, { method: 'DELETE' }).then(handle)
}

export default { get, post, put, del, qs }
