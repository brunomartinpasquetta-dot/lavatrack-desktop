import { useCallback, useEffect, useRef, useState } from 'react'
import { get, post } from '../api.js'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import { TablaWrap, Tabla, Thead, Th, Td, Fila } from '../components/tabla.jsx'
import { ModuleHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { formatNum } from '../utils/format.js'
import { useConexion } from '../context/ConexionContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { leerFirmante, guardarFirmante } from '../utils/firmante.js'

// Aclaración de cada método de reposición (el badge lo dibuja <Badge metodo>).
const AYUDA_METODO = {
  PAR: 'Reponer hasta el par: se entrega par − stock actual.',
  CARRO_INTERCAMBIO: 'Carga del carro de intercambio: se entrega el par completo.',
  PEDIDO: 'Pedido: carga manual, sin sugerencia automática.',
}

// Fecha de hoy en formato DD/MM/YYYY (es-AR).
function hoyLargo() {
  return new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

const claseInput =
  'w-20 min-h-[44px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm text-right tabular-nums text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-400'

// Card de un sector: picking list del día + firmante + botón de distribución.
function SectorReposicion({ sector, completado, onDistribuido, presets = [] }) {
  const { online } = useConexion()
  const toast = useToast()

  // Presets aplicables al sector (globales + del sector), activos.
  const presetsSector = (presets || []).filter((p) => {
    if (p.activo === 0 || p.activo === false) return false
    return p.sector_id == null || Number(p.sector_id) === Number(sector.sector_id)
  })
  const esCarro = sector.metodo_reposicion === 'CARRO_INTERCAMBIO'
  const [presetSel, setPresetSel] = useState('')

  // Estado por línea: cantidad a entregar + si está marcada (entra al remito).
  const construirEstado = useCallback((lineas) => {
    const cant = {}
    const marc = {}
    ;(lineas || []).forEach((l) => {
      cant[l.tipo_prenda_id] = l.a_entregar
      marc[l.tipo_prenda_id] = l.a_entregar > 0
    })
    return { cant, marc }
  }, [])

  const [cantidades, setCantidades] = useState(() => construirEstado(sector.lineas).cant)
  const [marcados, setMarcados] = useState(() => construirEstado(sector.lineas).marc)
  // Precargamos el último firmante usado (AUD-005). Sigue siendo editable.
  const [firmante, setFirmante] = useState(() => leerFirmante())
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Al recargar los datos tras distribuir, resincronizamos inputs con lo sugerido.
  const primeraRef = useRef(true)
  useEffect(() => {
    if (primeraRef.current) {
      primeraRef.current = false
      return
    }
    const { cant, marc } = construirEstado(sector.lineas)
    setCantidades(cant)
    setMarcados(marc)
  }, [sector, construirEstado])

  const ayuda = AYUDA_METODO[sector.metodo_reposicion] || AYUDA_METODO.PAR

  const setCantidad = (id, valor) => setCantidades((prev) => ({ ...prev, [id]: valor }))
  const toggleMarcado = (id) => setMarcados((prev) => ({ ...prev, [id]: !prev[id] }))

  // Carga un preset del sector como carga del carro: fija cantidad y marca las
  // líneas del preset que existen en la picking list (editables antes de distribuir).
  const aplicarPreset = (id) => {
    setPresetSel(id)
    if (!id) return
    const p = presetsSector.find((x) => String(x.id) === String(id))
    if (!p) return
    const idsSector = new Set((sector.lineas || []).map((l) => l.tipo_prenda_id))
    const cant = { ...cantidades }
    const marc = { ...marcados }
    let aplicadas = 0
    ;(p.items || []).forEach((it) => {
      if (idsSector.has(it.tipo_prenda_id)) {
        cant[it.tipo_prenda_id] = it.cantidad
        marc[it.tipo_prenda_id] = it.cantidad > 0
        aplicadas += 1
      }
    })
    setCantidades(cant)
    setMarcados(marc)
    toast.exito(`Preset "${p.nombre}" cargado (${aplicadas} ${aplicadas === 1 ? 'línea' : 'líneas'})`)
  }

  // Líneas que efectivamente entran al remito: marcadas y con cantidad > 0.
  const itemsValidos = (sector.lineas || [])
    .map((l) => ({
      tipo_prenda_id: l.tipo_prenda_id,
      cantidad: parseInt(cantidades[l.tipo_prenda_id], 10) || 0,
      marcado: !!marcados[l.tipo_prenda_id],
    }))
    .filter((it) => it.marcado && it.cantidad > 0)

  // Total de prendas a entregar (para el resumen de confirmación).
  const totalPrendas = itemsValidos.reduce((acc, it) => acc + it.cantidad, 0)

  // confirmarDuplicado=true reenvía al backend con `confirmar:true` (sector ya repuesto hoy).
  const distribuir = async (confirmarDuplicado = false) => {
    setError('')
    if (!itemsValidos.length) {
      setError('Marcá al menos una línea con cantidad mayor a cero.')
      return
    }

    // Resumen + confirmación previa (AUD-020). No se re-pregunta en el reintento por duplicado.
    if (!confirmarDuplicado) {
      const ok = window.confirm(
        `Vas a entregar al sector ${sector.sector}: ${totalPrendas} ${totalPrendas === 1 ? 'prenda' : 'prendas'} ` +
          `(${itemsValidos.length} ${itemsValidos.length === 1 ? 'línea' : 'líneas'}).\n\n¿Confirmás?`,
      )
      if (!ok) return
    }

    setGuardando(true)
    try {
      const body = {
        sector_id: sector.sector_id,
        firmante,
        items: itemsValidos.map((it) => ({
          tipo_prenda_id: it.tipo_prenda_id,
          cantidad: it.cantidad,
        })),
      }
      if (confirmarDuplicado) body.confirmar = true
      const creado = await post('/reposicion/distribuir', body)
      guardarFirmante(firmante)
      toast.exito(
        creado?.numero
          ? `Distribución al sector ${sector.sector} registrada (${creado.numero})`
          : `Distribución al sector ${sector.sector} registrada`,
      )
      onDistribuido(sector.sector_id)
    } catch (err) {
      // El backend rechaza la distribución duplicada (sector ya repuesto hoy) con un
      // mensaje claro. Si el operario acepta, reenviamos con confirmar:true (AUD-019/020).
      if (err.status === 400 && !confirmarDuplicado) {
        setGuardando(false)
        const ok = window.confirm(`${err.message}\n\n¿Generar la distribución de todas formas?`)
        if (ok) return distribuir(true)
        return
      }
      setError(err.message)
      toast.error(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const puedeGenerar = online && firmante.trim() && itemsValidos.length > 0

  return (
    <Card className="mb-5 overflow-hidden">
      {/* Cabecera del sector: nombre + método + estado del día */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-800">{sector.sector}</h2>
          <Badge metodo={sector.metodo_reposicion} />
        </div>
        <div className="flex items-center gap-3">
          {esCarro && presetsSector.length > 0 && (
            <select
              value={presetSel}
              onChange={(e) => aplicarPreset(e.target.value)}
              className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              title="Cargar el carro desde un preset"
            >
              <option value="">Cargar preset…</option>
              {presetsSector.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}{p.sector_id == null ? ' (Global)' : ''}
                </option>
              ))}
            </select>
          )}
          {completado ? (
            <Badge tono="emerald">Completado hoy</Badge>
          ) : (
            <Badge tono="amber">Pendiente</Badge>
          )}
        </div>
      </div>

      <p className="px-5 pt-3 text-xs text-slate-500">{ayuda}</p>

      {/* Picking list del sector */}
      <div className="px-5 pt-2">
        <TablaWrap>
          <Tabla>
            <Thead>
              <Th className="w-10"> </Th>
              <Th>Prenda</Th>
              <Th num>Stock actual</Th>
              <Th num>Par</Th>
              <Th num>A entregar</Th>
            </Thead>
            <tbody>
              {(sector.lineas || []).map((l) => {
                const marcado = !!marcados[l.tipo_prenda_id]
                return (
                  <Fila key={l.tipo_prenda_id} className={marcado ? '' : 'opacity-55'}>
                    <Td>
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => toggleMarcado(l.tipo_prenda_id)}
                        className="h-6 w-6 cursor-pointer rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                    </Td>
                    <Td className="font-medium text-slate-700">{l.tipo_prenda}</Td>
                    <Td num>{formatNum(l.stock_actual)}</Td>
                    <Td num className="text-slate-500">{formatNum(l.par)}</Td>
                    <Td num>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min="0"
                        value={cantidades[l.tipo_prenda_id] ?? ''}
                        onChange={(e) => setCantidad(l.tipo_prenda_id, e.target.value)}
                        disabled={!marcado}
                        className={claseInput}
                      />
                    </Td>
                  </Fila>
                )
              })}
            </tbody>
          </Tabla>
        </TablaWrap>
      </div>

      {/* Firmante + acción */}
      <div className="border-t border-slate-100 px-5 py-4">
        {error && (
          <div className="mb-3">
            <ErrorMsg mensaje={error} />
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="w-full max-w-xs">
            <label className="mb-1 block text-xs font-medium text-slate-500">Firmante</label>
            <input
              type="text"
              value={firmante}
              onChange={(e) => setFirmante(e.target.value)}
              placeholder="Nombre y apellido"
              className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={() => distribuir()}
              disabled={guardando || !puedeGenerar}
              title={!online ? 'Sin conexión con el servidor' : undefined}
              className="min-h-[44px] rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {guardando ? 'Generando…' : 'Generar remito de distribución'}
            </button>
            <span className="text-[11px] text-slate-400">
              {itemsValidos.length > 0
                ? `${itemsValidos.length} ${itemsValidos.length === 1 ? 'línea' : 'líneas'} a entregar`
                : 'Sin líneas seleccionadas'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}

// Pantalla "Reposición del día": picking list por sector con sugerencia por método.
export default function Reposicion() {
  const [data, setData] = useState(null)
  const [presets, setPresets] = useState([])
  const [error, setError] = useState('')

  const cargar = useCallback(() => {
    setError('')
    get('/reposicion')
      .then(setData)
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    cargar()
    get('/presets')
      .then((p) => setPresets(Array.isArray(p) ? p : []))
      .catch(() => setPresets([]))
  }, [cargar])

  // Tras distribuir recargamos: el estado "completado hoy" viene del server (persiste al refrescar).
  const marcarCompletado = useCallback(() => {
    cargar()
  }, [cargar])

  if (error) return <ErrorMsg mensaje={error} />
  if (!data) return <Cargando />

  const sectores = data.sectores || []
  const completados = sectores.filter((s) => s.completado_hoy).length
  const pendientes = sectores.length - completados

  return (
    <div>
      <ModuleHeader
        titulo="Reposición del día"
        descripcion="Distribución interna desde Ropería Central"
        breadcrumb={['Operación', 'Reposición del día']}
        accion={
          <div className="text-right">
            <div className="text-sm font-medium capitalize text-slate-600">{hoyLargo()}</div>
            <div className="mt-1 flex items-center justify-end gap-2 text-xs">
              <Badge tono="amber">{pendientes} pendientes</Badge>
              <span className="text-slate-300">·</span>
              <Badge tono="emerald">{completados} completados hoy</Badge>
            </div>
          </div>
        }
      />

      {sectores.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-400">
          No hay sectores para reponer.
        </Card>
      ) : (
        sectores.map((s) => (
          <SectorReposicion
            key={s.sector_id}
            sector={s}
            completado={s.completado_hoy}
            onDistribuido={marcarCompletado}
            presets={presets}
          />
        ))
      )}
    </div>
  )
}
