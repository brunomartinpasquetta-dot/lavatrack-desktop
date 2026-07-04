import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { get } from '../api.js'
import Card from '../components/Card.jsx'
import KpiCard from '../components/KpiCard.jsx'
import TablaRemitos from '../components/TablaRemitos.jsx'
import { PageHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { formatARS, formatKg } from '../utils/format.js'
import { NIVEL_PUNTO, NIVEL_ETIQUETA } from '../components/SemaforoStock.jsx'

// Íconos KPI
const IconoPrenda = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
    <path d="M7 4l5 3 5-3 3 4-3 2v10H7V10L4 8l3-4Z" strokeLinejoin="round" />
  </svg>
)
const IconoPeso = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
    <path d="M6 4h12l2 16H4L6 4Z" strokeLinejoin="round" />
    <path d="M9 8a3 3 0 1 1 6 0" strokeLinecap="round" />
  </svg>
)
const IconoMerma = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
    <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
    <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
  </svg>
)

const nivelBadge = {
  bajo: 'bg-amber-100 text-amber-700',
  critico: 'bg-rose-100 text-rose-700',
  ok: 'bg-emerald-100 text-emerald-700',
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    get('/dashboard')
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <ErrorMsg mensaje={error} />
  if (!data) return <Cargando />

  const merma = data.mermas_mes || { unidades: 0, ars: 0 }

  return (
    <div>
      <PageHeader
        titulo="Dashboard"
        descripcion="Resumen del circuito de ropa hospitalaria"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Prendas en lavandería"
          valor={data.prendas_en_lavanderia ?? 0}
          detalle="Enviadas y sin retornar"
          icono={IconoPrenda}
          acento="teal"
        />
        <KpiCard
          label="Kg enviados del mes"
          valor={formatKg(data.kg_enviados_mes ?? 0)}
          detalle="Peso total despachado"
          icono={IconoPeso}
          acento="emerald"
        />
        <KpiCard
          label="Mermas del mes"
          valor={`${merma.unidades ?? 0} u.`}
          detalle={formatARS(merma.ars ?? 0)}
          icono={IconoMerma}
          acento="rose"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Alertas de stock bajo */}
        <Card className="lg:col-span-1">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Alertas de stock bajo</h2>
            <Link to="/stock" className="text-xs font-medium text-teal-700 hover:underline">
              Ver stock
            </Link>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {(data.sectores_stock_bajo || []).length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400">
                Sin alertas. Todo el stock está por encima del mínimo.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.sectores_stock_bajo.map((a, i) => (
                  <li key={i} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{a.tipo_prenda}</p>
                      <p className="text-xs text-slate-500">{a.sector}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {a.actual}/{a.minimo}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          nivelBadge[a.nivel] || nivelBadge.bajo
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${NIVEL_PUNTO[a.nivel]}`} />
                        {NIVEL_ETIQUETA[a.nivel] || a.nivel}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* Últimos remitos */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Últimos remitos</h2>
            <Link to="/remitos" className="text-xs font-medium text-teal-700 hover:underline">
              Ver todos
            </Link>
          </div>
          <TablaRemitos remitos={data.ultimos_remitos || []} compacto />
        </Card>
      </div>

      {/* Pie sutil: aclaración de demo. */}
      <p className="mt-8 text-center text-xs text-slate-400">
        Demo — datos ficticios. BPSG Sistemas
      </p>
    </div>
  )
}
