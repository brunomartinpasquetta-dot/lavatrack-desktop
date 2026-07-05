// Utilidades de formato para la demo (es-AR).

const arsFmt = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

// $ 245.800 (sin decimales)
export function formatARS(n) {
  const valor = Number(n)
  if (n === null || n === undefined || Number.isNaN(valor)) return '$ 0'
  return `$ ${arsFmt.format(Math.round(valor))}`
}

// DD/MM/YYYY a partir de un ISO o "YYYY-MM-DD"
export function formatFecha(iso) {
  if (!iso) return '—'
  // Tomamos solo la parte de fecha para evitar corrimientos por zona horaria.
  const soloFecha = String(iso).slice(0, 10)
  const partes = soloFecha.split('-')
  if (partes.length !== 3) return String(iso)
  const [y, m, d] = partes
  return `${d}/${m}/${y}`
}

// 12,3 kg (un decimal, coma decimal)
export function formatKg(n) {
  const valor = Number(n)
  if (n === null || n === undefined || Number.isNaN(valor)) return '0,0 kg'
  const fmt = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return `${fmt.format(valor)} kg`
}

// 1.234 (entero con separador de miles es-AR)
const numFmt = new Intl.NumberFormat('es-AR')
export function formatNum(n) {
  const valor = Number(n)
  if (n === null || n === undefined || Number.isNaN(valor)) return '0'
  return numFmt.format(valor)
}

// 12,3 % (un decimal)
export function formatPct(n) {
  const valor = Number(n)
  if (n === null || n === undefined || Number.isNaN(valor)) return '0 %'
  return `${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(valor)} %`
}

// Días transcurridos desde una fecha (YYYY-MM-DD o ISO), respecto de hoy.
export function diasDesde(iso) {
  if (!iso) return 0
  const f = new Date(String(iso).slice(0, 10) + 'T00:00:00')
  const hoy = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00')
  return Math.max(0, Math.round((hoy - f) / 86400000))
}

// Semáforo de antigüedad (días): <3 ok (verde), 3-6 bajo (amber), 7+ crítico (rose).
export function nivelAntiguedad(dias) {
  if (dias >= 7) return 'critico'
  if (dias >= 3) return 'bajo'
  return 'ok'
}
