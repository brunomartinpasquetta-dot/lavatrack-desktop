import Card from './Card.jsx'

// Tarjeta de KPI: etiqueta, valor grande y detalle opcional.
export default function KpiCard({ label, valor, detalle, icono, acento = 'teal' }) {
  const acentos = {
    teal: 'text-teal-600 bg-teal-50',
    amber: 'text-amber-600 bg-amber-50',
    rose: 'text-rose-600 bg-rose-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    slate: 'text-slate-600 bg-slate-100',
  }
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-800">{valor}</p>
          {detalle && <p className="mt-1 text-sm text-slate-500">{detalle}</p>}
        </div>
        {icono && (
          <div className={`p-2.5 rounded-lg ${acentos[acento] || acentos.teal}`}>
            {icono}
          </div>
        )}
      </div>
    </Card>
  )
}
