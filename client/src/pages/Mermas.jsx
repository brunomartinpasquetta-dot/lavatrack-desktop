import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { get, qs } from '../api.js'
import Card from '../components/Card.jsx'
import KpiCard from '../components/KpiCard.jsx'
import { PageHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { formatARS, formatFecha } from '../utils/format.js'

const claseInput =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'

const MOTIVO_BAJA = {
  ROTURA: 'Rotura',
  PERDIDA: 'Pérdida',
  FIN_VIDA_UTIL: 'Fin vida útil',
}

export default function Mermas() {
  // Inputs del período (vacío = default del backend: últimos 60 días).
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  // Filtros efectivamente aplicados (se disparan al tocar "Aplicar").
  const [aplicados, setAplicados] = useState({ desde: '', hasta: '' })

  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setCargando(true)
    setError('')
    get(`/mermas${qs(aplicados)}`)
      .then((d) => {
        setData(d)
        // Reflejar el período resuelto por el backend en los inputs si estaban vacíos.
        if (!desde && d.desde) setDesde(d.desde)
        if (!hasta && d.hasta) setHasta(d.hasta)
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aplicados])

  const aplicar = () => setAplicados({ desde, hasta })

  const totales = data?.totales || { unidades: 0, ars: 0 }

  return (
    <div>
      <PageHeader titulo="Mermas" descripcion="Reporte de faltantes y bajas por período" />

      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className={claseInput}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className={claseInput}
            />
          </div>
          <button
            onClick={aplicar}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
          >
            Aplicar
          </button>
        </div>
      </Card>

      {error && <ErrorMsg mensaje={error} />}

      {cargando || !data ? (
        <Cargando />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <KpiCard label="Merma en unidades" valor={`${totales.unidades ?? 0} u.`} acento="rose" />
            <KpiCard label="Merma en pesos" valor={formatARS(totales.ars ?? 0)} acento="rose" />
          </div>

          <p className="mb-6 text-xs text-slate-400">
            Período: {formatFecha(data.desde)} — {formatFecha(data.hasta)}
          </p>

          {/* Diferencias de conciliación */}
          <Card className="mb-6">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-800">Faltantes por conciliación</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200">
                    <th className="px-5 py-3">Remito</th>
                    <th className="px-5 py-3">Fecha</th>
                    <th className="px-5 py-3">Sector</th>
                    <th className="px-5 py-3">Prenda</th>
                    <th className="px-5 py-3 text-right">Faltante</th>
                    <th className="px-5 py-3 text-right">Costo unit.</th>
                    <th className="px-5 py-3 text-right">Costo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data.diferencias || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
                        Sin faltantes en el período.
                      </td>
                    </tr>
                  ) : (
                    data.diferencias.map((d, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-5 py-3">
                          {d.remito_id != null ? (
                            <Link
                              to={`/remitos/${d.remito_id}`}
                              className="font-medium text-teal-700 hover:underline"
                            >
                              {d.numero}
                            </Link>
                          ) : (
                            d.numero
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-600">{formatFecha(d.fecha)}</td>
                        <td className="px-5 py-3 text-slate-600">{d.sector}</td>
                        <td className="px-5 py-3 text-slate-600">{d.tipo_prenda}</td>
                        <td className="px-5 py-3 text-right font-semibold text-rose-700">
                          {d.faltante}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-600">
                          {formatARS(d.costo_unitario)}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-rose-700">
                          {formatARS(d.costo_ars)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Bajas */}
          <Card>
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-slate-800">Bajas registradas</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200">
                    <th className="px-5 py-3">Fecha</th>
                    <th className="px-5 py-3">Prenda</th>
                    <th className="px-5 py-3 text-right">Cantidad</th>
                    <th className="px-5 py-3">Motivo</th>
                    <th className="px-5 py-3">Autorizado por</th>
                    <th className="px-5 py-3 text-right">Costo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data.bajas || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                        Sin bajas en el período.
                      </td>
                    </tr>
                  ) : (
                    data.bajas.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 text-slate-600">{formatFecha(b.fecha)}</td>
                        <td className="px-5 py-3 text-slate-700">{b.tipo_prenda}</td>
                        <td className="px-5 py-3 text-right text-slate-700">{b.cantidad}</td>
                        <td className="px-5 py-3 text-slate-600">
                          {MOTIVO_BAJA[b.motivo] || b.motivo}
                        </td>
                        <td className="px-5 py-3 text-slate-600">{b.autorizado_por || '—'}</td>
                        <td className="px-5 py-3 text-right font-semibold text-rose-700">
                          {formatARS(b.costo_ars)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
