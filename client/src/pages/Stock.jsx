import { useEffect, useState } from 'react'
import { get } from '../api.js'
import Card from '../components/Card.jsx'
import SemaforoStock, { CeldaStock } from '../components/SemaforoStock.jsx'
import { PageHeader, Cargando, ErrorMsg } from '../components/ui.jsx'

// Matriz de stock: filas = sectores, columnas = tipos de prenda.
export default function Stock() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    get('/stock')
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <ErrorMsg mensaje={error} />
  if (!data) return <Cargando />

  const tipos = data.tipos_prenda || []

  // Busca la celda de un sector para un tipo de prenda dado.
  const buscarCelda = (sector, tipoId) =>
    (sector.celdas || []).find((c) => c.tipo_prenda_id === tipoId)

  return (
    <div>
      <PageHeader titulo="Stock" descripcion="Existencias por sector y tipo de prenda" />

      <Card className="mb-4 p-4">
        <SemaforoStock />
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="sticky left-0 z-10 bg-white px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sector
                </th>
                {tipos.map((t) => (
                  <th
                    key={t.id}
                    className="px-2 py-3 text-center text-xs font-semibold text-slate-500"
                  >
                    {t.nombre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data.sectores || []).map((s) => (
                <tr key={s.sector_id} className="hover:bg-slate-50">
                  <td className="sticky left-0 z-10 bg-white px-5 py-2 font-medium text-slate-700">
                    <span>{s.sector}</span>
                    {s.metodo_reposicion && (
                      <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-slate-400">
                        {s.metodo_reposicion.replace('_', ' ')}
                      </span>
                    )}
                  </td>
                  {tipos.map((t) => (
                    <CeldaStock key={t.id} celda={buscarCelda(s, t.id)} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-slate-400">
        Cada celda muestra el stock actual, el mínimo y el par del sector para ese tipo de prenda.
      </p>
    </div>
  )
}
