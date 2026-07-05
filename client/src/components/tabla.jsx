// Primitivas de tabla densa y consistente para toda la app.
// Encabezados uppercase tracking-wide, filas compactas con hover, números tabulares
// alineados a la derecha, y soporte de primera columna sticky en matrices anchas.

// Contenedor con scroll horizontal propio (para que el body de la página nunca scrollee).
export function TablaWrap({ children, className = '' }) {
  return <div className={`overflow-x-auto ${className}`}>{children}</div>
}

export function Tabla({ children, className = '' }) {
  return <table className={`min-w-full text-sm ${className}`}>{children}</table>
}

// Encabezado de columna. num=true → alinea a la derecha. sticky=true → primera col fija.
export function Th({ children, num = false, sticky = false, className = '' }) {
  return (
    <th
      className={
        'px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 ' +
        (num ? 'text-right ' : 'text-left ') +
        (sticky ? 'sticky left-0 z-10 bg-slate-50 ' : '') +
        className
      }
    >
      {children}
    </th>
  )
}

// Celda. num=true → tabular-nums + derecha. sticky=true → primera col fija.
export function Td({ children, num = false, sticky = false, className = '' }) {
  return (
    <td
      className={
        'px-3 py-2 text-slate-700 ' +
        (num ? 'text-right tabular-nums ' : '') +
        (sticky ? 'sticky left-0 z-10 bg-white ' : '') +
        className
      }
    >
      {children}
    </td>
  )
}

// Fila del cuerpo (hover + divisor). onClick opcional la hace cliqueable.
export function Fila({ children, onClick, className = '' }) {
  return (
    <tr
      onClick={onClick}
      className={
        'border-t border-slate-100 ' +
        (onClick ? 'cursor-pointer hover:bg-slate-50 transition-colors ' : 'hover:bg-slate-50/60 ') +
        className
      }
    >
      {children}
    </tr>
  )
}

// Encabezado de tabla con borde inferior.
export function Thead({ children }) {
  return (
    <thead>
      <tr className="border-b border-slate-200">{children}</tr>
    </thead>
  )
}
