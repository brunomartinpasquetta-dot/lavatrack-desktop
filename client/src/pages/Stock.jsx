import { useEffect, useMemo, useState } from 'react'
import { get } from '../api.js'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import { TablaWrap, Tabla, Thead, Th, Td } from '../components/tabla.jsx'
import { ModuleHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { formatNum } from '../utils/format.js'

// Clases de fondo por nivel del semáforo.
const NIVEL_CLASES = {
  ok: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  bajo: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  critico: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
}
const NIVEL_PUNTO = { ok: 'bg-emerald-500', bajo: 'bg-amber-500', critico: 'bg-rose-500' }

const LEYENDA = [
  { nivel: 'ok', texto: 'OK (≥ mínimo)' },
  { nivel: 'bajo', texto: 'Bajo (≥ 50% y < mínimo)' },
  { nivel: 'critico', texto: 'Crítico (< 50% del mínimo)' },
]

// ¿La celda representa un tipo que el sector no maneja? (sin mínimo ni existencias)
const esVacia = (c) => !c || (c.minimo === 0 && c.actual === 0)
// ¿La celda está por debajo del par?
const bajoPar = (c) => c && c.par > 0 && c.actual < c.par

// Celda de la matriz: actual + (mín · par) + déficit/superávit contra el par.
function Celda({ celda, atenuar }) {
  if (esVacia(celda)) {
    return (
      <td className="px-2 py-2 text-center text-slate-300">—</td>
    )
  }
  const clase = NIVEL_CLASES[celda.nivel] || NIVEL_CLASES.ok
  const tienePar = celda.par > 0
  const delta = tienePar ? celda.actual - celda.par : 0
  const bajo = bajoPar(celda)

  return (
    <td className={`px-2 py-2 text-center align-middle ${atenuar && !bajo ? 'opacity-40' : ''}`}>
      <div className={`inline-flex min-w-[3.25rem] flex-col items-center rounded-md px-2 py-1 ${clase}`}>
        <span className="text-sm font-semibold leading-tight tabular-nums">
          {formatNum(celda.actual)}
        </span>
        <span className="text-[10px] leading-tight opacity-70 tabular-nums">
          mín {formatNum(celda.minimo)} · par {formatNum(celda.par)}
        </span>
        {tienePar && (
          <span
            className={`text-[10px] font-semibold leading-tight tabular-nums ${
              delta < 0 ? 'text-rose-600' : 'text-emerald-600'
            }`}
          >
            {delta >= 0 ? `+${formatNum(delta)}` : formatNum(delta)}
          </span>
        )}
      </div>
    </td>
  )
}

// Matriz de stock: filas = sectores, columnas = tipos de prenda.
export default function Stock() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [soloBajoPar, setSoloBajoPar] = useState(false)

  useEffect(() => {
    get('/stock')
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  const tipos = data?.tipos_prenda || []

  const buscarCelda = (sector, tipoId) =>
    (sector.celdas || []).find((c) => c.tipo_prenda_id === tipoId)

  // Con "Solo bajo par" activo, mostramos únicamente sectores con al menos una celda bajo par.
  const sectoresVisibles = useMemo(() => {
    const todos = data?.sectores || []
    if (!soloBajoPar) return todos
    return todos.filter((s) => (s.celdas || []).some((c) => bajoPar(c)))
  }, [data, soloBajoPar])

  if (error) return <ErrorMsg mensaje={error} />
  if (!data) return <Cargando />

  return (
    <div>
      <ModuleHeader
        titulo="Stock por sector"
        descripcion="Existencias por sector y tipo de prenda, contra el mínimo y el par"
        breadcrumb={['Control', 'Stock por sector']}
        accion={
          <label className="flex cursor-pointer select-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <input
              type="checkbox"
              checked={soloBajoPar}
              onChange={(e) => setSoloBajoPar(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            Solo bajo par
          </label>
        }
      />

      {/* Leyenda del semáforo */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
        {LEYENDA.map((it) => (
          <div key={it.nivel} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${NIVEL_PUNTO[it.nivel]}`} />
            <span>{it.texto}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-rose-600">−</span>
          <span>déficit vs par</span>
          <span className="ml-2 font-semibold text-emerald-600">+</span>
          <span>superávit vs par</span>
        </div>
      </div>

      <Card>
        <TablaWrap>
          <Tabla>
            <Thead>
              <Th sticky>Sector</Th>
              {tipos.map((t) => (
                <th
                  key={t.id}
                  className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {t.nombre}
                </th>
              ))}
            </Thead>
            <tbody>
              {sectoresVisibles.length === 0 ? (
                <tr className="border-t border-slate-100">
                  <td
                    colSpan={tipos.length + 1}
                    className="px-5 py-8 text-center text-sm text-slate-400"
                  >
                    Ningún sector con stock por debajo del par.
                  </td>
                </tr>
              ) : (
                sectoresVisibles.map((s) => (
                  <tr key={s.sector_id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <Td sticky>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-700">{s.sector}</span>
                        {s.metodo_reposicion && <Badge metodo={s.metodo_reposicion} />}
                      </div>
                    </Td>
                    {tipos.map((t) => (
                      <Celda
                        key={t.id}
                        celda={buscarCelda(s, t.id)}
                        atenuar={soloBajoPar}
                      />
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </Tabla>
        </TablaWrap>
      </Card>

      <p className="mt-3 text-xs text-slate-400">
        Cada celda muestra el stock actual, el mínimo y el par del sector para ese tipo de prenda,
        y el déficit o superávit contra el par.
      </p>
    </div>
  )
}
