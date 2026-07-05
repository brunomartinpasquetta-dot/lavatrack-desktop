import { useEffect, useState } from 'react'
import { get, post } from '../api.js'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import { TablaWrap, Tabla, Thead, Th, Td, Fila } from '../components/tabla.jsx'
import { ModuleHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { formatNum } from '../utils/format.js'
import { useConexion } from '../context/ConexionContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

const claseInput =
  'w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'

// Estado -> tono/etiqueta del Badge.
const ESTADO_TONO = { EN_SECTOR: 'emerald', EN_LAVANDERIA: 'sky', BAJA: 'rose' }
const ESTADO_LABEL = { EN_SECTOR: 'En sector', EN_LAVANDERIA: 'En lavandería', BAJA: 'Baja' }

export default function PrendasIdentificadas() {
  const { online } = useConexion()
  const toast = useToast()

  const [prendas, setPrendas] = useState(null)
  const [sectores, setSectores] = useState([])
  const [tipos, setTipos] = useState([])
  const [error, setError] = useState('')

  // Alta manual.
  const [abierto, setAbierto] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [tipoId, setTipoId] = useState('')
  const [sectorId, setSectorId] = useState('')
  const [errorForm, setErrorForm] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = () =>
    get('/prendas-identificadas')
      .then((d) => setPrendas(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message))

  useEffect(() => {
    Promise.all([get('/prendas-identificadas'), get('/sectores'), get('/tipos-prenda')])
      .then(([p, s, t]) => {
        setPrendas(Array.isArray(p) ? p : [])
        setSectores(Array.isArray(s) ? s : [])
        setTipos(Array.isArray(t) ? t : [])
      })
      .catch((e) => setError(e.message))
  }, [])

  const abrir = () => {
    setCodigo('')
    setTipoId('')
    setSectorId('')
    setErrorForm('')
    setAbierto(true)
  }

  const guardar = async () => {
    setErrorForm('')
    if (!codigo.trim()) return setErrorForm('Ingresá un código.')
    if (!tipoId) return setErrorForm('Seleccioná el tipo de prenda.')
    setGuardando(true)
    try {
      await post('/prendas-identificadas', {
        codigo: codigo.trim(),
        tipo_prenda_id: Number(tipoId),
        sector_actual_id: sectorId ? Number(sectorId) : null,
      })
      toast.exito('Prenda registrada.')
      setAbierto(false)
      cargar()
    } catch (e) {
      setErrorForm(e.message)
      toast.error(e.message)
    } finally {
      setGuardando(false)
    }
  }

  if (error) return <ErrorMsg mensaje={error} />
  if (!prendas) return <Cargando />

  return (
    <div>
      <ModuleHeader
        titulo="Prendas identificadas"
        descripcion="Prendas con código individual: estado, ciclos y ubicación"
        breadcrumb={['Control', 'Prendas identificadas']}
        accion={
          <button
            onClick={abrir}
            className="min-h-[44px] rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
          >
            + Alta manual
          </button>
        }
      />

      {abierto && (
        <Card className="mb-6">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Alta de prenda identificada</h2>
          </div>
          <div className="p-5">
            {errorForm && <div className="mb-4"><ErrorMsg mensaje={errorForm} /></div>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Código *</label>
                <input
                  type="text"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ej: CQ-0001"
                  className={claseInput}
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Tipo de prenda *</label>
                <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} className={claseInput}>
                  <option value="">Seleccionar prenda…</option>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Sector</label>
                <select value={sectorId} onChange={(e) => setSectorId(e.target.value)} className={claseInput}>
                  <option value="">Sin asignar</option>
                  {sectores.map((s) => (
                    <option key={s.id} value={s.id}>{s.nombre}</option>
                  ))}
                </select>
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
                {guardando ? 'Guardando…' : 'Registrar prenda'}
              </button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        {prendas.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">No hay prendas identificadas cargadas.</p>
        ) : (
          <TablaWrap>
            <Tabla>
              <Thead>
                <Th>Código</Th>
                <Th>Tipo</Th>
                <Th>Estado</Th>
                <Th num>Ciclos</Th>
                <Th>Sector</Th>
              </Thead>
              <tbody>
                {prendas.map((p) => (
                  <Fila key={p.id}>
                    <Td className="font-mono font-medium text-slate-700">{p.codigo}</Td>
                    <Td>{p.tipo_prenda}</Td>
                    <Td>
                      <Badge tono={ESTADO_TONO[p.estado] || 'slate'}>
                        {ESTADO_LABEL[p.estado] || p.estado}
                      </Badge>
                    </Td>
                    <Td num>{formatNum(p.ciclos ?? 0)}</Td>
                    <Td className="text-slate-500">{p.sector_actual || '—'}</Td>
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
