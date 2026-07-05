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

// Encabezado de MÓDULO: breadcrumb + título + acción primaria a la derecha del título.
// breadcrumb = array de strings (ej: ['Operación', 'Reposición del día']).
export function ModuleHeader({ titulo, descripcion, breadcrumb, accion }) {
  return (
    <div className="mb-5">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
          {breadcrumb.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-slate-300">/</span>}
              <span className={i === breadcrumb.length - 1 ? 'text-slate-500' : ''}>{b}</span>
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{titulo}</h1>
          {descripcion && <p className="mt-0.5 text-sm text-slate-500">{descripcion}</p>}
        </div>
        {accion && <div className="shrink-0">{accion}</div>}
      </div>
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
