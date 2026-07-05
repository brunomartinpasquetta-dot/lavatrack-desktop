import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { get } from '../api.js'
import Card from '../components/Card.jsx'
import KpiCard from '../components/KpiCard.jsx'
import Badge from '../components/Badge.jsx'
import { TablaWrap, Tabla, Thead, Th, Td, Fila } from '../components/tabla.jsx'
import { ModuleHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { formatARS, formatKg, formatNum, formatPct, formatFecha, diasDesde, nivelAntiguedad } from '../utils/format.js'

// Íconos KPI (SVG inline).
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
const IconoAlerta = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
    <path d="M4 20V6M4 6h11l-1.5 4L15 14H4" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
)
const IconoCirculacion = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
    <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8M20 4v4h-4" strokeLinejoin="round" strokeLinecap="round" />
    <path d="M20 12a8 8 0 0 1-13.7 5.6L4 16M4 20v-4h4" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
)

// KPI envuelto en Link (drill-down).
function KpiLink({ to, ...props }) {
  return (
    <Link to={to} className="block transition-shadow hover:shadow-md rounded-xl">
      <KpiCard {...props} />
    </Link>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [stock, setStock] = useState(null)
  const [envios, setEnvios] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      get('/dashboard'),
      get('/stock').catch(() => null),
      get('/remitos?estado=ENVIADO').catch(() => []),
    ])
      .then(([d, s, e]) => {
        setData(d)
        setStock(s)
        setEnvios(Array.isArray(e) ? e : [])
      })
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <ErrorMsg mensaje={error} />
  if (!data) return <Cargando />

  const merma = data.mermas_mes || { unidades: 0, ars: 0 }
  const mermaInterna = data.merma_interna_mes || { unidades: 0, ars: 0 }
  const alertasVida = data.alertas_vida_util || []
  const sectores = stock?.sectores || []

  // Sectores con al menos una celda bajo/crítico + prendas en circulación + lookup de par.
  let sectoresBajoPar = 0
  let prendasCirculacion = 0
  const parLookup = {} // `${sector}|${tipo_prenda}` → par
  sectores.forEach((s) => {
    let tieneBajo = false
    ;(s.celdas || []).forEach((c) => {
      prendasCirculacion += Number(c.actual) || 0
      if (c.nivel === 'bajo' || c.nivel === 'critico') tieneBajo = true
      parLookup[`${s.sector}|${c.tipo_prenda}`] = c.par
    })
    if (tieneBajo) sectoresBajoPar += 1
  })

  // Envíos sin retorno ordenados por antigüedad DESC (más viejos arriba).
  const enviosOrden = [...envios].sort((a, b) => diasDesde(b.fecha) - diasDesde(a.fecha))

  const alertas = data.sectores_stock_bajo || []
  const ultimos = data.ultimos_remitos || []

  return (
    <div>
      <ModuleHeader
        titulo="Panel general"
        descripcion="Resumen del circuito de ropa hospitalaria"
        breadcrumb={['Operación', 'Panel general']}
      />

      {/* Fila 1 — KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiLink
          to="/remitos"
          label="En lavandería ahora"
          valor={formatNum(data.prendas_en_lavanderia ?? 0)}
          detalle="Prendas enviadas sin retornar"
          icono={IconoPrenda}
          acento="teal"
        />
        <KpiLink
          to="/remitos"
          label="Kg enviados del mes"
          valor={formatKg(data.kg_enviados_mes ?? 0)}
          detalle="Peso total despachado"
          icono={IconoPeso}
          acento="emerald"
        />
        <KpiLink
          to="/mermas"
          label="Merma del mes"
          valor={formatARS(merma.ars ?? 0)}
          detalle={`${formatNum(merma.unidades ?? 0)} u. · vs lavandería`}
          icono={IconoMerma}
          acento="rose"
        />
        <KpiLink
          to="/inventario"
          label="Merma interna del mes"
          valor={formatARS(mermaInterna.ars ?? 0)}
          detalle={`${formatNum(mermaInterna.unidades ?? 0)} u. · ajustes de stock`}
          icono={IconoMerma}
          acento="amber"
        />
        <KpiLink
          to="/stock"
          label="Sectores bajo par"
          valor={formatNum(sectoresBajoPar)}
          detalle="Con stock bajo o crítico"
          icono={IconoAlerta}
          acento={sectoresBajoPar > 0 ? 'amber' : 'slate'}
        />
        <KpiLink
          to="/stock"
          label="Prendas en circulación"
          valor={formatNum(prendasCirculacion)}
          detalle="Stock total en sectores"
          icono={IconoCirculacion}
          acento="slate"
        />
      </div>

      {/* Alarmas de vida útil (ciclos) */}
      {alertasVida.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {alertasVida.map((a, i) => {
            const vencida = a.estado === 'vencida'
            const estilo = vencida
              ? 'border-rose-200 bg-rose-50'
              : 'border-amber-200 bg-amber-50'
            const acento = vencida ? 'text-rose-700' : 'text-amber-700'
            return (
              <Card key={i} className={`p-4 border ${estilo}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold ${acento}`}>
                      {vencida ? 'Dotación vencida' : 'Reposición próxima'}
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-slate-800">{a.tipo_prenda}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatPct((Number(a.pct) || 0) * 100)} de la vida útil
                    </p>
                  </div>
                  {vencida && (
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] text-slate-500">Reposición est.</p>
                      <p className="text-sm font-semibold tabular-nums text-rose-700">
                        {formatARS(a.costo_estimado ?? 0)}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Fila 2 — Envíos sin retorno + Alertas de stock */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Envíos sin retorno</h2>
            <Link to="/retornos" className="text-xs font-medium text-teal-700 hover:underline">
              Ver retornos →
            </Link>
          </div>
          {enviosOrden.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">
              No hay envíos pendientes de retorno.
            </p>
          ) : (
            <TablaWrap>
              <Tabla>
                <Thead>
                  <Th>Número</Th>
                  <Th>Sector</Th>
                  <Th>Fecha</Th>
                  <Th>Antigüedad</Th>
                  <Th num>Prendas</Th>
                </Thead>
                <tbody>
                  {enviosOrden.map((r) => {
                    const dias = diasDesde(r.fecha)
                    return (
                      <Fila key={r.id} onClick={() => navigate(`/remitos/${r.id}`)}>
                        <Td className="font-medium text-teal-700">{r.numero}</Td>
                        <Td>{r.sector}</Td>
                        <Td className="text-slate-500">{formatFecha(r.fecha)}</Td>
                        <Td>
                          <Badge nivel={nivelAntiguedad(dias)}>{`${dias} días`}</Badge>
                        </Td>
                        <Td num>{formatNum(r.total_prendas ?? 0)}</Td>
                      </Fila>
                    )
                  })}
                </tbody>
              </Tabla>
            </TablaWrap>
          )}
        </Card>

        <Card className="lg:col-span-1">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Alertas de stock</h2>
            <Link to="/stock" className="text-xs font-medium text-teal-700 hover:underline">
              Ver stock →
            </Link>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {alertas.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400">
                Sin alertas. Todo el stock está por encima del mínimo.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {alertas.map((a, i) => {
                  const par = parLookup[`${a.sector}|${a.tipo_prenda}`]
                  const deficit = par != null ? Math.max(0, Number(par) - Number(a.actual)) : null
                  return (
                    <li key={i} className="flex items-center justify-between px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700">{a.tipo_prenda}</p>
                        <p className="truncate text-xs text-slate-500">{a.sector}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 pl-2">
                        <span className="tabular-nums text-xs text-slate-500">
                          {formatNum(a.actual)}/{formatNum(a.minimo)}
                        </span>
                        <Badge nivel={a.nivel} />
                        {deficit != null && deficit > 0 && (
                          <span className="tabular-nums text-xs font-medium text-rose-600">
                            −{formatNum(deficit)} vs par
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {/* Fila 3 — Últimos movimientos */}
      <Card className="mt-6">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800">Últimos movimientos</h2>
          <Link to="/remitos" className="text-xs font-medium text-teal-700 hover:underline">
            Ver envíos →
          </Link>
        </div>
        {ultimos.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">Sin movimientos recientes.</p>
        ) : (
          <TablaWrap>
            <Tabla>
              <Thead>
                <Th>Número</Th>
                <Th>Tipo</Th>
                <Th>Sector</Th>
                <Th>Fecha</Th>
                <Th>Estado</Th>
                <Th num>Prendas</Th>
              </Thead>
              <tbody>
                {ultimos.map((r) => (
                  <Fila key={r.id} onClick={() => navigate(`/remitos/${r.id}`)}>
                    <Td className="font-medium text-teal-700">{r.numero}</Td>
                    <Td className="text-slate-500">{r.tipo}</Td>
                    <Td>{r.sector}</Td>
                    <Td className="text-slate-500">{formatFecha(r.fecha)}</Td>
                    <Td>
                      <Badge estado={r.estado} />
                    </Td>
                    <Td num>{formatNum(r.total_prendas ?? 0)}</Td>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
          </TablaWrap>
        )}
      </Card>

      {/* Pie sutil: aclaración de demo. */}
      <p className="mt-8 text-center text-xs text-slate-400">
        Demo — datos ficticios. BPSG Sistemas
      </p>
    </div>
  )
}
