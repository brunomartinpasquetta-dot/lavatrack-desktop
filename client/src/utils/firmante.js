// Persistencia del último firmante usado (AUD-005). El cliente es un navegador común
// en la terminal táctil; localStorage sobrevive al refresh de la página.
// Es sólo autocompletado: nunca bloquea la edición del campo.
const CLAVE = 'lavatrack.firmante'

// Devuelve el último firmante guardado (o '' si no hay / no hay storage disponible).
export function leerFirmante() {
  try {
    return localStorage.getItem(CLAVE) || ''
  } catch {
    return ''
  }
}

// Guarda el firmante usado en una operación exitosa (ignora vacíos).
export function guardarFirmante(nombre) {
  try {
    const limpio = (nombre || '').trim()
    if (limpio) localStorage.setItem(CLAVE, limpio)
  } catch {
    // storage no disponible: seguimos sin persistir.
  }
}
