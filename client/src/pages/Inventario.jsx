import { useCallback, useEffect, useState } from 'react'
import { get, post, put } from '../api.js'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import { TablaWrap, Tabla, Thead, Th, Td, Fila } from '../components/tabla.jsx'
import { ModuleHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { formatFecha, formatNum } from '../utils/format.js'
import { useConexion } from '../context/ConexionContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { leerFirmante, guardarFirmante } from '../utils/firmante.js'

const claseInput =
  'w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'
const claseInputNum =
  'w-24 min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-right tabular-nums text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'

export default function Inventario() {
  const { online } = useConexion()
  const toast = useToast()

  const [sectores, setSectores] = useState([])
  const [historial, setHistorial] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // Formulario de inicio.
  const [sectorId, setSectorId] = useState('')
  const [usuario, setUsuario] = useState(() => leerFirmante())
  const [iniciando, setIniciando] = useState(false)

  // Inventario activo (EN_CURSO o CERRADO recién visto).
  const [activo, setActivo] = useState(null)
  const [conteos, setConteos] = useState({}) // tipo_prenda_id -> valor string
  const [guardando, setGuardando] = useState(false)
  const [observaciones, setObservaciones] = useState('')

  const cargarHistorial = useCallback(() => {
    return get('/inventarios')
      .then((d) => setHistorial(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    Promise.all([get('/sectores'), get('/inventarios')])
      .then(([sec, inv]) => {
        setSectores(Array.isArray(sec) ? sec : [])
        setHistorial(Array.isArray(inv) ? inv : [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [])

  // Carga el detalle de un inventario y sincroniza los inputs de conteo.
  const abrirDetalle = async (id) => {
    setError('')
    try {
      const det = await get(`/inventarios/${id}`)
      setActivo(det)
      const c = {}
      ;(det.items || []).forEach((it) => {
        if (it.cantidad_contada != null) c[it.tipo_prenda_id] = String(it.cantidad_contada)
      })
      setConteos(c)
      setObservaciones(det.observaciones || '')
    } catch (e) {
      setError(e.message)
      toast.error(e.message)
    }
  }

  const iniciar = async () => {
    setError('')
    if (!sectorId) return setError('Seleccioná un sector para iniciar el conteo.')
    setIniciando(true)
    try {
      const det = await post('/inventarios', {
        sector_id: Number(sectorId),
        usuario,
      })
      guardarFirmante(usuario)
      setActivo(det)
      setConteos({})
      setObservaciones('')
      toast.exito('Inventario iniciado. Contá a ciegas cada prenda.')
      cargarHistorial()
    } catch (e) {
      setError(e.message)
      toast.error(e.message)
    } finally {
      setIniciando(false)
    }
  }

  const listaConteos = () =>
    (activo?.items || [])
      .filter((it) => conteos[it.tipo_prenda_id] !== undefined && conteos[it.tipo_prenda_id] !== '')
      .map((it) => ({
        tipo_prenda_id: it.tipo_prenda_id,
        cantidad_contada: parseInt(conteos[it.tipo_prenda_id], 10) || 0,
      }))

  const guardarConteo = async () => {
    if (!activo) return
    setGuardando(true)
    setError('')
    try {
      const det = await put(`/inventarios/${activo.id}/conteo`, { conteos: listaConteos() })
      setActivo(det)
      toast.exito('Conteo guardado.')
    } catch (e) {
      setError(e.message)
      toast.error(e.message)
    } finally {
      setGuardando(false)
    }
  }

  const cerrar = async () => {
    if (!activo) return
    if (!window.confirm('Cerrar el inventario aplica los ajustes por diferencia. ¿Confirmás?')) return
    setGuardando(true)
    setError('')
    try {
      // Guardamos primero el conteo actual, después cerramos.
      await put(`/inventarios/${activo.id}/conteo`, { conteos: listaConteos() })
      const det = await post(`/inventarios/${activo.id}/cerrar`, {
        observaciones,
        autorizado_por: usuario || leerFirmante(),
      })
      setActivo(det)
      const nAjustes = (det.items || []).filter((it) => (it.diferencia ?? 0) !== 0).length
      toast.exito(`Inventario cerrado, ${nAjustes} ${nAjustes === 1 ? 'ajuste generado' : 'ajustes generados'}.`)
      cargarHistorial()
    } catch (e) {
      setError(e.message)
      toast.error(e.message)
    } finally {
      setGuardando(false)
    }
  }

  const volver = () => {
    setActivo(null)
    setConteos({})
    setError('')
  }

  if (cargando) return <Cargando />

  // ---- Vista de detalle CERRADO: teórico / contado / diferencia ----
  if (activo && activo.estado === 'CERRADO') {
    const items = activo.items || []
    const nAjustes = items.filter((it) => (it.diferencia ?? 0) !== 0).length
    return (
      <div>
        <ModuleHeader
          titulo={`Inventario #${activo.id} — ${activo.sector || ''}`}
          descripcion="Diferencias entre stock teórico y contado"
          breadcrumb={['Control', 'Inventario cíclico', 'Diferencias']}
          accion={
            <button
              onClick={volver}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              ← Volver
            </button>
          }
        />
        {error && <div className="mb-4"><ErrorMsg mensaje={error} /></div>}
        <Card className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <Badge tono="emerald">Cerrado</Badge>
              <span className="text-xs text-slate-500">
                {formatFecha(activo.fecha)} · {activo.usuario || '—'}
              </span>
            </div>
            <Badge tono={nAjustes > 0 ? 'amber' : 'slate'}>
              {nAjustes} {nAjustes === 1 ? 'ajuste' : 'ajustes'}
            </Badge>
          </div>
          <TablaWrap>
            <Tabla>
              <Thead>
                <Th>Prenda</Th>
                <Th num>Teórico</Th>
                <Th num>Contado</Th>
                <Th num>Diferencia</Th>
              </Thead>
              <tbody>
                {items.map((it) => {
                  const dif = it.diferencia ?? 0
                  const color = dif === 0 ? 'text-slate-400' : dif > 0 ? 'text-emerald-700' : 'text-rose-600'
                  return (
                    <Fila key={it.tipo_prenda_id} className={dif !== 0 ? 'bg-amber-50/40' : ''}>
                      <Td className="font-medium text-slate-700">{it.tipo_prenda}</Td>
                      <Td num className="text-slate-500">{formatNum(it.cantidad_teorica ?? 0)}</Td>
                      <Td num>{formatNum(it.cantidad_contada ?? 0)}</Td>
                      <Td num className={`font-semibold ${color}`}>
                        {dif > 0 ? `+${formatNum(dif)}` : formatNum(dif)}
                      </Td>
                    </Fila>
                  )
                })}
              </tbody>
            </Tabla>
          </TablaWrap>
          {activo.observaciones && (
            <div className="border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
              {activo.observaciones}
            </div>
          )}
        </Card>
      </div>
    )
  }

  // ---- Vista de conteo CIEGO (EN_CURSO) ----
  if (activo && activo.estado === 'EN_CURSO') {
    const items = activo.items || []
    return (
      <div>
        <ModuleHeader
          titulo={`Conteo — ${activo.sector || ''}`}
          descripcion="Conteo a ciegas: ingresá lo que contás, sin ver el teórico"
          breadcrumb={['Control', 'Inventario cíclico', 'Conteo']}
          accion={
            <button
              onClick={volver}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              ← Volver
            </button>
          }
        />
        {error && <div className="mb-4"><ErrorMsg mensaje={error} /></div>}

        <Card className="mb-6">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Prendas a contar</h2>
            <Badge tono="teal">En curso</Badge>
          </div>
          {items.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">Este inventario no tiene prendas para contar.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((it) => (
                <li
                  key={it.tipo_prenda_id}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <span className="min-w-0 flex-1 text-sm font-medium text-slate-700">{it.tipo_prenda}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min="0"
                    value={conteos[it.tipo_prenda_id] ?? ''}
                    onChange={(e) =>
                      setConteos((prev) => ({ ...prev, [it.tipo_prenda_id]: e.target.value }))
                    }
                    placeholder="0"
                    className={claseInputNum}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="mb-6 p-5">
          <label className="mb-1 block text-xs font-medium text-slate-500">Observaciones</label>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={2}
            placeholder="Notas del conteo (opcional)"
            className={claseInput}
          />
        </Card>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            onClick={guardarConteo}
            disabled={guardando || !online}
            className="min-h-[44px] rounded-lg border border-teal-200 bg-teal-50 px-5 py-2.5 text-sm font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Guardar conteo'}
          </button>
          <button
            onClick={cerrar}
            disabled={guardando || !online}
            title={!online ? 'Sin conexión con el servidor' : undefined}
            className="min-h-[44px] rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
          >
            Cerrar y ver diferencias
          </button>
        </div>
      </div>
    )
  }

  // ---- Vista principal: iniciar + historial ----
  return (
    <div>
      <ModuleHeader
        titulo="Inventario cíclico"
        descripcion="Conteo a ciegas por sector con ajuste automático de diferencias"
        breadcrumb={['Control', 'Inventario cíclico']}
      />
      {error && <div className="mb-4"><ErrorMsg mensaje={error} /></div>}

      <Card className="mb-6 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Sector *</label>
            <select value={sectorId} onChange={(e) => setSectorId(e.target.value)} className={claseInput}>
              <option value="">Seleccionar sector…</option>
              {sectores.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Responsable</label>
            <input
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Nombre y apellido"
              className={claseInput}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={iniciar}
              disabled={iniciando || !online || !sectorId}
              title={!online ? 'Sin conexión con el servidor' : undefined}
              className="min-h-[44px] w-full rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
            >
              {iniciando ? 'Iniciando…' : 'Iniciar conteo'}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800">Historial de inventarios</h2>
        </div>
        {historial.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">Todavía no hay inventarios.</p>
        ) : (
          <TablaWrap>
            <Tabla>
              <Thead>
                <Th>#</Th>
                <Th>Sector</Th>
                <Th>Fecha</Th>
                <Th>Responsable</Th>
                <Th>Estado</Th>
              </Thead>
              <tbody>
                {historial.map((inv) => (
                  <Fila key={inv.id} onClick={() => abrirDetalle(inv.id)}>
                    <Td className="font-medium text-teal-700">{inv.id}</Td>
                    <Td>{inv.sector}</Td>
                    <Td className="text-slate-500">{formatFecha(inv.fecha)}</Td>
                    <Td className="text-slate-500">{inv.usuario || '—'}</Td>
                    <Td>
                      <Badge tono={inv.estado === 'CERRADO' ? 'emerald' : 'teal'}>
                        {inv.estado === 'CERRADO' ? 'Cerrado' : 'En curso'}
                      </Badge>
                    </Td>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
          </TablaWrap>
        )}
      </Card>
    </div>
  )
}
