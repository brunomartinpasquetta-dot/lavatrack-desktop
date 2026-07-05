import { useEffect, useState } from 'react'
import { get, post, put, del } from '../api.js'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import { TablaWrap, Tabla, Thead, Th, Td, Fila } from '../components/tabla.jsx'
import { ModuleHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { formatNum } from '../utils/format.js'
import { useConexion } from '../context/ConexionContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

const claseInput =
  'w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'

function lineaVacia() {
  return { tipo_prenda_id: '', cantidad: '' }
}

export default function Presets() {
  const { online } = useConexion()
  const toast = useToast()

  const [presets, setPresets] = useState(null)
  const [sectores, setSectores] = useState([])
  const [tipos, setTipos] = useState([])
  const [error, setError] = useState('')

  // Form (crear/editar). editId=null => crear.
  const [abierto, setAbierto] = useState(false)
  const [editId, setEditId] = useState(null)
  const [nombre, setNombre] = useState('')
  const [sectorId, setSectorId] = useState('') // '' = Global
  const [activo, setActivo] = useState(true)
  const [lineas, setLineas] = useState([lineaVacia()])
  const [errorForm, setErrorForm] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = () =>
    get('/presets')
      .then((d) => setPresets(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message))

  useEffect(() => {
    Promise.all([get('/presets'), get('/sectores'), get('/tipos-prenda')])
      .then(([p, s, t]) => {
        setPresets(Array.isArray(p) ? p : [])
        setSectores(Array.isArray(s) ? s : [])
        setTipos(Array.isArray(t) ? t : [])
      })
      .catch((e) => setError(e.message))
  }, [])

  const nuevo = () => {
    setEditId(null)
    setNombre('')
    setSectorId('')
    setActivo(true)
    setLineas([lineaVacia()])
    setErrorForm('')
    setAbierto(true)
  }

  const editar = (p) => {
    setEditId(p.id)
    setNombre(p.nombre || '')
    setSectorId(p.sector_id != null ? String(p.sector_id) : '')
    setActivo(!!p.activo)
    setLineas(
      (p.items || []).length
        ? p.items.map((it) => ({ tipo_prenda_id: String(it.tipo_prenda_id), cantidad: String(it.cantidad) }))
        : [lineaVacia()],
    )
    setErrorForm('')
    setAbierto(true)
  }

  const setLinea = (i, campo, valor) =>
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)))
  const agregarLinea = () => setLineas((prev) => [...prev, lineaVacia()])
  const quitarLinea = (i) =>
    setLineas((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)))

  const guardar = async () => {
    setErrorForm('')
    if (!nombre.trim()) return setErrorForm('El nombre no puede estar vacío.')
    const items = lineas
      .filter((l) => l.tipo_prenda_id && l.cantidad)
      .map((l) => ({ tipo_prenda_id: Number(l.tipo_prenda_id), cantidad: parseInt(l.cantidad, 10) }))
      .filter((it) => it.cantidad > 0)
    if (!items.length) return setErrorForm('Agregá al menos una línea con prenda y cantidad mayor a cero.')

    const body = {
      nombre: nombre.trim(),
      sector_id: sectorId ? Number(sectorId) : null,
      activo: activo ? 1 : 0,
      items,
    }
    setGuardando(true)
    try {
      if (editId != null) {
        await put(`/presets/${editId}`, body)
        toast.exito('Preset actualizado.')
      } else {
        await post('/presets', body)
        toast.exito('Preset creado.')
      }
      setAbierto(false)
      cargar()
    } catch (e) {
      setErrorForm(e.message)
      toast.error(e.message)
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (p) => {
    if (!window.confirm(`¿Eliminar el preset "${p.nombre}"?`)) return
    try {
      await del(`/presets/${p.id}`)
      toast.exito('Preset eliminado.')
      cargar()
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (error) return <ErrorMsg mensaje={error} />
  if (!presets) return <Cargando />

  return (
    <div>
      <ModuleHeader
        titulo="Presets de carga"
        descripcion="Plantillas de prendas para precargar envíos y carros de intercambio"
        breadcrumb={['Maestros', 'Presets de carga']}
        accion={
          <button
            onClick={nuevo}
            className="min-h-[44px] rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
          >
            + Nuevo preset
          </button>
        }
      />

      {abierto && (
        <Card className="mb-6">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">
              {editId != null ? 'Editar preset' : 'Nuevo preset'}
            </h2>
          </div>
          <div className="p-5">
            {errorForm && <div className="mb-4"><ErrorMsg mensaje={errorForm} /></div>}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Nombre *</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Carro Internación estándar"
                  className={claseInput}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Sector</label>
                <select value={sectorId} onChange={(e) => setSectorId(e.target.value)} className={claseInput}>
                  <option value="">Global (todos los sectores)</option>
                  {sectores.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={(e) => setActivo(e.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  Activo
                </label>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Líneas</h3>
                <button
                  type="button"
                  onClick={agregarLinea}
                  className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
                >
                  + Agregar línea
                </button>
              </div>
              <div className="space-y-2">
                {lineas.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 items-center gap-3">
                    <div className="col-span-8 sm:col-span-9">
                      <select
                        value={l.tipo_prenda_id}
                        onChange={(e) => setLinea(i, 'tipo_prenda_id', e.target.value)}
                        className={claseInput}
                      >
                        <option value="">Seleccionar prenda…</option>
                        {tipos.map((t) => (
                          <option key={t.id} value={t.id}>{t.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min="1"
                        value={l.cantidad}
                        onChange={(e) => setLinea(i, 'cantidad', e.target.value)}
                        placeholder="0"
                        className={`${claseInput} text-right tabular-nums`}
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
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
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setAbierto(false)}
                className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando || !online}
                title={!online ? 'Sin conexión con el servidor' : undefined}
                className="min-h-[44px] rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
              >
                {guardando ? 'Guardando…' : 'Guardar preset'}
              </button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        {presets.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">No hay presets cargados.</p>
        ) : (
          <TablaWrap>
            <Tabla>
              <Thead>
                <Th>Nombre</Th>
                <Th>Sector</Th>
                <Th num>Ítems</Th>
                <Th>Estado</Th>
                <Th num> </Th>
              </Thead>
              <tbody>
                {presets.map((p) => (
                  <Fila key={p.id}>
                    <Td className="font-medium text-slate-700">{p.nombre}</Td>
                    <Td>{p.sector || <span className="text-slate-400">Global</span>}</Td>
                    <Td num>{formatNum((p.items || []).length)}</Td>
                    <Td>
                      <Badge tono={p.activo ? 'emerald' : 'slate'}>{p.activo ? 'Activo' : 'Inactivo'}</Badge>
                    </Td>
                    <Td num>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => editar(p)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminar(p)}
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                        >
                          Eliminar
                        </button>
                      </div>
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
