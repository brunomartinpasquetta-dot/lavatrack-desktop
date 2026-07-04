// Utilidades y celda del semáforo de stock. Nivel: ok | bajo | critico.

export const NIVEL_CLASES = {
  ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  bajo: 'bg-amber-50 text-amber-700 border-amber-200',
  critico: 'bg-rose-50 text-rose-700 border-rose-200',
}

export const NIVEL_PUNTO = {
  ok: 'bg-emerald-500',
  bajo: 'bg-amber-500',
  critico: 'bg-rose-500',
}

export const NIVEL_ETIQUETA = {
  ok: 'OK',
  bajo: 'Bajo',
  critico: 'Crítico',
}

// Celda de la matriz de stock: muestra actual/mínimo coloreado por nivel.
export function CeldaStock({ celda }) {
  if (!celda) {
    return <td className="px-3 py-2 text-center text-slate-300">—</td>
  }
  // El sector no maneja este tipo de prenda (sin mínimo ni existencias): se muestra tenue.
  if (celda.minimo === 0 && celda.actual === 0) {
    return <td className="px-3 py-2 text-center text-slate-300">—</td>
  }
  const clase = NIVEL_CLASES[celda.nivel] || NIVEL_CLASES.ok
  return (
    <td className="px-2 py-2 text-center">
      <div className={`inline-flex flex-col items-center rounded-md border px-2 py-1 ${clase}`}>
        <span className="text-sm font-semibold leading-tight">{celda.actual}</span>
        <span className="text-[10px] leading-tight opacity-70">
          mín {celda.minimo}
          {celda.par != null ? ` · par ${celda.par}` : ''}
        </span>
      </div>
    </td>
  )
}

// Leyenda del semáforo.
export default function SemaforoStock() {
  const items = [
    { nivel: 'ok', texto: 'OK (≥ mínimo)' },
    { nivel: 'bajo', texto: 'Bajo (≥ 50% y < mínimo)' },
    { nivel: 'critico', texto: 'Crítico (< 50% del mínimo)' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
      {items.map((it) => (
        <div key={it.nivel} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${NIVEL_PUNTO[it.nivel]}`} />
          <span>{it.texto}</span>
        </div>
      ))}
    </div>
  )
}
