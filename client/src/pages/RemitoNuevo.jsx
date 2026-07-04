import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { get, post } from '../api.js'
import Card from '../components/Card.jsx'
import { PageHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { formatKg } from '../utils/format.js'
import { useConexion } from '../context/ConexionContext.jsx'

const claseInput =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'

function lineaVacia() {
  return { tipo_prenda_id: '', cantidad: '', cantidad_contaminada: '' }
}

export default function RemitoNuevo() {
  const navigate = useNavigate()
  const { online } = useConexion()
  const [sectores, setSectores] = useState([])
  const [tipos, setTipos] = useState([])
  const [cargando, setCargando] = useState(true)

  const [sectorId, setSectorId] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [firmante, setFirmante] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [lineas, setLineas] = useState([lineaVacia()])

  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    Promise.all([get('/sectores'), get('/tipos-prenda')])
      .then(([sec, tp]) => {
        setSectores(sec || [])
        setTipos(tp || [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [])

  // Mapa id -> peso promedio para el cálculo en vivo.
  const pesoPorTipo = useMemo(() => {
    const m = {}
    tipos.forEach((t) => {
      m[t.id] = t.peso_promedio_gr || 0
    })
    return m
  }, [tipos])

  // Peso estimado en vivo: Σ cantidad × peso_promedio_gr / 1000.
  const pesoEstimadoKg = useMemo(() => {
    let gr = 0
    lineas.forEach((l) => {
      const cant = parseInt(l.cantidad, 10)
      const peso = pesoPorTipo[l.tipo_prenda_id] || 0
      if (!Number.isNaN(cant) && cant > 0) gr += cant * peso
    })
    return gr / 1000
  }, [lineas, pesoPorTipo])

  const setLinea = (i, campo, valor) => {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)))
  }
  const agregarLinea = () => setLineas((prev) => [...prev, lineaVacia()])
  const quitarLinea = (i) =>
    setLineas((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)))

  const submit = async (e) => {
    e.preventDefault()
    setError('')

    // Validación básica en el cliente.
    if (!sectorId) return setError('Seleccioná un sector.')
    const items = lineas
      .filter((l) => l.tipo_prenda_id && l.cantidad)
      .map((l) => ({
        tipo_prenda_id: Number(l.tipo_prenda_id),
        cantidad: parseInt(l.cantidad, 10),
        cantidad_contaminada: l.cantidad_contaminada
          ? parseInt(l.cantidad_contaminada, 10)
          : 0,
      }))
    if (!items.length) return setError('Agregá al menos una línea con tipo de prenda y cantidad.')

    const body = {
      tipo: 'ENVIO',
      sector_id: Number(sectorId),
      fecha,
      firmante,
      observaciones,
      remito_envio_id: null,
      items,
    }

    setEnviando(true)
    try {
      const creado = await post('/remitos', body)
      navigate(`/remitos/${creado.id}`)
    } catch (err) {
      setError(err.message)
      setEnviando(false)
    }
  }

  if (cargando) return <Cargando />

  return (
    <div>
      <PageHeader titulo="Nuevo envío" descripcion="Registrar un remito de envío a la lavandería" />

      <form onSubmit={submit} className="space-y-6">
        {error && <ErrorMsg mensaje={error} />}

        <Card className="p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Sector *</label>
              <select
                value={sectorId}
                onChange={(e) => setSectorId(e.target.value)}
                className={claseInput}
              >
                <option value="">Seleccionar sector…</option>
                {sectores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={claseInput}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Firmante</label>
              <input
                type="text"
                value={firmante}
                onChange={(e) => setFirmante(e.target.value)}
                placeholder="Nombre y apellido"
                className={claseInput}
              />
            </div>
          </div>
        </Card>

        {/* Líneas de prendas */}
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Prendas a enviar</h2>
            <button
              type="button"
              onClick={agregarLinea}
              className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
            >
              + Agregar línea
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Encabezados */}
            <div className="hidden grid-cols-12 gap-3 px-1 text-xs font-medium text-slate-500 sm:grid">
              <div className="col-span-6">Tipo de prenda</div>
              <div className="col-span-2 text-right">Cantidad</div>
              <div className="col-span-3 text-right">Contaminadas</div>
              <div className="col-span-1" />
            </div>

            {lineas.map((l, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-3">
                <div className="col-span-12 sm:col-span-6">
                  <select
                    value={l.tipo_prenda_id}
                    onChange={(e) => setLinea(i, 'tipo_prenda_id', e.target.value)}
                    className={claseInput}
                  >
                    <option value="">Seleccionar prenda…</option>
                    {tipos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-5 sm:col-span-2">
                  <input
                    type="number"
                    min="1"
                    value={l.cantidad}
                    onChange={(e) => setLinea(i, 'cantidad', e.target.value)}
                    placeholder="0"
                    className={`${claseInput} text-right`}
                  />
                </div>
                <div className="col-span-5 sm:col-span-3">
                  <input
                    type="number"
                    min="0"
                    value={l.cantidad_contaminada}
                    onChange={(e) => setLinea(i, 'cantidad_contaminada', e.target.value)}
                    placeholder="0"
                    className={`${claseInput} text-right`}
                  />
                </div>
                <div className="col-span-2 flex justify-end sm:col-span-1">
                  <button
                    type="button"
                    onClick={() => quitarLinea(i)}
                    disabled={lineas.length === 1}
                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 disabled:hover:bg-transparent"
                    title="Quitar línea"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Peso estimado en vivo */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
            <span className="text-sm text-slate-500">Peso estimado</span>
            <span className="text-lg font-semibold text-teal-700">{formatKg(pesoEstimadoKg)}</span>
          </div>
        </Card>

        <Card className="p-5">
          <label className="mb-1 block text-xs font-medium text-slate-500">Observaciones</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={3}
            placeholder="Notas del envío (opcional)"
            className={claseInput}
          />
        </Card>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/remitos')}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando || !online}
            title={!online ? 'Sin conexión con el servidor' : undefined}
            className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
          >
            {enviando ? 'Enviando…' : 'Confirmar envío'}
          </button>
        </div>
      </form>
    </div>
  )
}
