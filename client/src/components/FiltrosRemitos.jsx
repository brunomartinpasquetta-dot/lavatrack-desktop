// Barra de filtros para el listado de remitos.

const ESTADOS = [
  { value: '', label: 'Todos los estados' },
  { value: 'BORRADOR', label: 'Borrador' },
  { value: 'ENVIADO', label: 'Enviado' },
  { value: 'RECIBIDO', label: 'Recibido' },
  { value: 'CONCILIADO', label: 'Conciliado' },
  { value: 'CON_DIFERENCIA', label: 'Con diferencia' },
]

const TIPOS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'ENVIO', label: 'Envío' },
  { value: 'RETORNO', label: 'Retorno' },
]

const claseInput =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'

export default function FiltrosRemitos({ filtros, sectores, onChange, onLimpiar }) {
  const set = (campo) => (e) => onChange({ ...filtros, [campo]: e.target.value })

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Estado</label>
        <select value={filtros.estado} onChange={set('estado')} className={claseInput}>
          {ESTADOS.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Tipo</label>
        <select value={filtros.tipo} onChange={set('tipo')} className={claseInput}>
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Sector</label>
        <select value={filtros.sector_id} onChange={set('sector_id')} className={claseInput}>
          <option value="">Todos los sectores</option>
          {sectores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Desde</label>
        <input type="date" value={filtros.desde} onChange={set('desde')} className={claseInput} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Hasta</label>
        <input type="date" value={filtros.hasta} onChange={set('hasta')} className={claseInput} />
      </div>

      <div className="flex items-end">
        <button
          onClick={onLimpiar}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Limpiar filtros
        </button>
      </div>
    </div>
  )
}
