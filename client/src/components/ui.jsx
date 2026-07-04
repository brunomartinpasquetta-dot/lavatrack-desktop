// Pequeños helpers de UI compartidos entre páginas.

// Encabezado de página con título y acción opcional.
export function PageHeader({ titulo, descripcion, accion }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-slate-500">{descripcion}</p>}
      </div>
      {accion}
    </div>
  )
}

// Estado de carga simple.
export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-slate-400">
      {texto}
    </div>
  )
}

// Mensaje de error.
export function ErrorMsg({ mensaje }) {
  if (!mensaje) return null
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {mensaje}
    </div>
  )
}
