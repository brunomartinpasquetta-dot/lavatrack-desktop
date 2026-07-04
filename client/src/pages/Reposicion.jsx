import { useCallback, useEffect, useRef, useState } from 'react'
import { get, post } from '../api.js'
import Card from '../components/Card.jsx'
import { PageHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { useConexion } from '../context/ConexionContext.jsx'

// Estilos y textos por método de reposición.
const METODO = {
  PAR: {
    etiqueta: 'Par (reponer hasta el par)',
    badge: 'bg-teal-100 text-teal-700',
    ayuda: 'Se repone hasta completar el par (par − stock actual).',
  },
  CARRO_INTERCAMBIO: {
    etiqueta: 'Carro de intercambio',
    badge: 'bg-sky-100 text-sky-700',
    ayuda: 'Carga de carro: se entrega el par completo.',
  },
  PEDIDO: {
    etiqueta: 'Pedido',
    badge: 'bg-amber-100 text-amber-700',
    ayuda: 'Carga manual: ingresá a mano las cantidades a entregar.',
  },
}

const claseInput =
  'w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-right text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'

// Card de un sector con su tabla editable y el botón de distribución.
function SectorReposicion({ sector, onDistribuido }) {
  const { online } = useConexion()
  const [cantidades, setCantidades] = useState(() => {
    const init = {}
    ;(sector.lineas || []).forEach((l) => {
      init[l.tipo_prenda_id] = l.a_entregar
    })
    return init
  })
  const [firmante, setFirmante] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  // Al recargarse los datos tras una distribución, resincronizamos los inputs
  // con los nuevos valores sugeridos (stock/par actualizados).
  const primeraRef = useRef(true)
  useEffect(() => {
    if (primeraRef.current) {
      primeraRef.current = false
      return
    }
    const init = {}
    ;(sector.lineas || []).forEach((l) => {
      init[l.tipo_prenda_id] = l.a_entregar
    })
    setCantidades(init)
  }, [sector])

  const meta = METODO[sector.metodo_reposicion] || METODO.PAR

  const setCantidad = (tipoId, valor) =>
    setCantidades((prev) => ({ ...prev, [tipoId]: valor }))

  const distribuir = async () => {
    setError('')
    setExito('')
    const items = (sector.lineas || [])
      .map((l) => ({
        tipo_prenda_id: l.tipo_prenda_id,
        cantidad: parseInt(cantidades[l.tipo_prenda_id], 10) || 0,
      }))
      .filter((it) => it.cantidad > 0)

    if (!items.length) {
      setError('Ingresá al menos una cantidad mayor a cero.')
      return
    }

    setGuardando(true)
    try {
      const creado = await post('/reposicion/distribuir', {
        sector_id: sector.sector_id,
        firmante,
        items,
      })
      setExito(`Remito de distribución ${creado.numero} generado.`)
      setFirmante('')
      onDistribuido()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Card className="mb-5">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-800">{sector.sector}</h2>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}
        >
          {meta.etiqueta}
        </span>
      </div>

      <div className="px-5 pt-2 text-xs text-slate-500">{meta.ayuda}</div>

      <div className="overflow-x-auto p-5 pt-3">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-4">Tipo de prenda</th>
              <th className="py-2 px-4 text-right">Stock actual</th>
              <th className="py-2 px-4 text-right">Par</th>
              <th className="py-2 pl-4 text-right">A entregar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(sector.lineas || []).map((l) => (
              <tr key={l.tipo_prenda_id} className="hover:bg-slate-50">
                <td className="py-2.5 pr-4 text-slate-700">{l.tipo_prenda}</td>
                <td className="py-2.5 px-4 text-right text-slate-600">{l.stock_actual}</td>
                <td className="py-2.5 px-4 text-right text-slate-600">{l.par}</td>
                <td className="py-2.5 pl-4 text-right">
                  <input
                    type="number"
                    min="0"
                    value={cantidades[l.tipo_prenda_id] ?? ''}
                    onChange={(e) => setCantidad(l.tipo_prenda_id, e.target.value)}
                    className={claseInput}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-100 px-5 py-4">
        {error && (
          <div className="mb-3">
            <ErrorMsg mensaje={error} />
          </div>
        )}
        {exito && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {exito}
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xs flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Firmante</label>
            <input
              type="text"
              value={firmante}
              onChange={(e) => setFirmante(e.target.value)}
              placeholder="Nombre y apellido"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <button
            onClick={distribuir}
            disabled={guardando || !online}
            title={!online ? 'Sin conexión con el servidor' : undefined}
            className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
          >
            {guardando ? 'Generando…' : 'Generar remito de distribución interna'}
          </button>
        </div>
      </div>
    </Card>
  )
}

// Pantalla "Reposición del día": lista los sectores con su sugerencia por método.
export default function Reposicion() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    setError('')
    get('/reposicion')
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (error) return <ErrorMsg mensaje={error} />
  if (!data) return <Cargando />

  const sectores = data.sectores || []

  return (
    <div>
      <PageHeader
        titulo="Reposición del día"
        descripcion="Distribución interna desde Ropería Central hacia cada sector"
      />

      {sectores.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-400">
          No hay sectores para reponer.
        </Card>
      ) : (
        sectores.map((s) => (
          <SectorReposicion key={s.sector_id} sector={s} onDistribuido={cargar} />
        ))
      )}
    </div>
  )
}
