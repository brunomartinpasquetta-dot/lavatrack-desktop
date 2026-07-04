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
