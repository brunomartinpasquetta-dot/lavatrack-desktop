import { useNavigate } from 'react-router-dom'
import Badge from './Badge.jsx'
import { formatFecha, formatKg } from '../utils/format.js'

// Tabla de remitos reutilizable (dashboard y listado). Cada fila linkea al detalle.
// `compacto` (dashboard) oculta Peso y Firmante para que el Estado siempre entre
// en pantallas angostas (notebook 1366×768) sin recortar la columna clave.
export default function TablaRemitos({ remitos = [], compacto = false }) {
  const navigate = useNavigate()

  if (!remitos.length) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        No hay remitos para mostrar.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200">
            <th className="px-4 py-3">Número</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Sector</th>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3 text-right">Prendas</th>
            {!compacto && <th className="px-4 py-3 text-right">Peso</th>}
            {!compacto && <th className="px-4 py-3">Firmante</th>}
            <th className="px-4 py-3">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {remitos.map((r) => (
            <tr
              key={r.id}
              onClick={() => navigate(`/remitos/${r.id}`)}
              className="cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <td className="px-4 py-3 font-medium text-teal-700">{r.numero}</td>
              <td className="px-4 py-3">
                <span
                  className={`text-xs font-medium ${
                    r.tipo === 'ENVIO' ? 'text-teal-700' : 'text-sky-700'
                  }`}
                >
                  {r.tipo === 'ENVIO' ? 'Envío' : 'Retorno'}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600">{r.sector}</td>
              <td className="px-4 py-3 text-slate-600">{formatFecha(r.fecha)}</td>
              <td className="px-4 py-3 text-right text-slate-600">
                {r.total_prendas ?? '—'}
              </td>
              {!compacto && (
                <td className="px-4 py-3 text-right text-slate-600">
                  {r.peso_total_kg != null ? formatKg(r.peso_total_kg) : '—'}
                </td>
              )}
              {!compacto && (
                <td className="px-4 py-3 text-slate-600">{r.firmante || '—'}</td>
              )}
              <td className="px-4 py-3">
                <Badge estado={r.estado} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
