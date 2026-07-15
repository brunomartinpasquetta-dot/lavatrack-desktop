import { useEffect, useMemo, useState } from 'react'
import { get, post } from '../api.js'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import CofirmaModal from '../components/CofirmaModal.jsx'
import { TablaWrap, Tabla, Thead, Th, Td, Fila } from '../components/tabla.jsx'
import { ModuleHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { formatARS, formatFecha } from '../utils/format.js'

// Baja manual de prendas (AUD-004): rotura o pérdida, con firma doble obligatoria.
// El operario carga la baja; un supervisor la co-firma en el momento.

const inputCls =
  'min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'

const MOTIVOS = [
  { valor: 'ROTURA', label: 'Rotura' },
  { valor: 'PERDIDA', label: 'Pérdida' },
]
const MOTIVO_LABEL = { ROTURA: 'Rotura', PERDIDA: 'Pérdida' }
const MOTIVO_TONO = { ROTURA: 'amber', PERDIDA: 'rose' }

function Campo({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  )
}

export default function Bajas() {
  const toast = useToast()

  const [sectores, setSectores] = useState([])
  const [tipos, setTipos] = useState([])
  const [bajas, setBajas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // Form de nueva baja.
  const [form, setForm] = useState({ sector_id: '', tipo_prenda_id: '', cantidad: '', motivo: 'ROTURA' })
  const [errorForm, setErrorForm] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)

  const cargarBajas = () =>
    get('/bajas').then((d) => setBajas(Array.isArray(d) ? d : []))

  useEffect(() => {
    Promise.all([get('/sectores'), get('/tipos-prenda'), cargarBajas()])
      .then(([sec, tp]) => {
        setSectores(Array.isArray(sec) ? sec : [])
        setTipos(Array.isArray(tp) ? tp : [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setCampo = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const nombreSector = useMemo(() => {
    const s = sectores.find((x) => String(x.id) === String(form.sector_id))
    return s ? s.nombre : ''
  }, [sectores, form.sector_id])

  const nombreTipo = useMemo(() => {
    const t = tipos.find((x) => String(x.id) === String(form.tipo_prenda_id))
    return t ? t.nombre : ''
  }, [tipos, form.tipo_prenda_id])

  // Valida el form y abre el modal de co-firma.
  const abrirCofirma = (e) => {
    e.preventDefault()
    setErrorForm('')
    const cant = parseInt(form.cantidad, 10)
    if (!form.sector_id) return setErrorForm('Seleccioná un sector.')
    if (!form.tipo_prenda_id) return setErrorForm('Seleccioná un tipo de prenda.')
    if (Number.isNaN(cant) || cant <= 0) return setErrorForm('La cantidad debe ser un entero mayor a 0.')
    if (!form.motivo) return setErrorForm('Elegí un motivo.')
    setModalAbierto(true)
  }

  // Co-firma confirmada → POST /api/bajas. Si el server rechaza, el error se
  // propaga y el modal lo muestra (no cerramos).
  const confirmarBaja = async (cofirma) => {
    await post('/bajas', {
      sector_id: Number(form.sector_id),
      tipo_prenda_id: Number(form.tipo_prenda_id),
      cantidad: parseInt(form.cantidad, 10),
      motivo: form.motivo,
      cofirma,
    })
    setModalAbierto(false)
    toast.exito('Baja registrada.')
    setForm({ sector_id: '', tipo_prenda_id: '', cantidad: '', motivo: 'ROTURA' })
    cargarBajas().catch((e) => setError(e.message))
  }

  if (error) return <ErrorMsg mensaje={error} />
  if (cargando) return <Cargando />

  return (
    <div>
      <ModuleHeader
        titulo="Bajas de prendas"
        descripcion="Registro de bajas por rotura o pérdida (requiere firma doble)"
        breadcrumb={['Control', 'Bajas de prendas']}
      />

      {/* Form de nueva baja */}
      <Card className="mb-6">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800">Registrar baja</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Al confirmar, un supervisor debe co-firmar la operación.
          </p>
        </div>
        <form onSubmit={abrirCofirma} className="p-5">
          {errorForm && (
            <div className="mb-4">
              <ErrorMsg mensaje={errorForm} />
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Sector">
              <select
                value={form.sector_id}
                onChange={(e) => setCampo('sector_id', e.target.value)}
                className={inputCls}
              >
                <option value="">Seleccionar sector…</option>
                {sectores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Tipo de prenda">
              <select
                value={form.tipo_prenda_id}
                onChange={(e) => setCampo('tipo_prenda_id', e.target.value)}
                className={inputCls}
              >
                <option value="">Seleccionar prenda…</option>
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Cantidad">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.cantidad}
                onChange={(e) => setCampo('cantidad', e.target.value.replace(/[^0-9]/g, ''))}
                className={inputCls}
                placeholder="0"
              />
            </Campo>
            <Campo label="Motivo">
              <select
                value={form.motivo}
                onChange={(e) => setCampo('motivo', e.target.value)}
                className={inputCls}
              >
                {MOTIVOS.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              className="min-h-[44px] rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
            >
              Registrar baja
            </button>
          </div>
        </form>
      </Card>

      {/* Listado de bajas del período */}
      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800">Bajas registradas</h2>
        </div>
        {bajas.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">Sin bajas en el período.</p>
        ) : (
          <TablaWrap>
            <Tabla>
              <Thead>
                <Th>Fecha</Th>
                <Th>Sector</Th>
                <Th>Prenda</Th>
                <Th num>Cantidad</Th>
                <Th>Motivo</Th>
                <Th>Autorizado por</Th>
                <Th>Co-firmante</Th>
                <Th num>Costo</Th>
              </Thead>
              <tbody>
                {bajas.map((b) => (
                  <Fila key={b.id}>
                    <Td className="text-slate-600">{formatFecha(b.fecha)}</Td>
                    <Td className="text-slate-600">{b.sector || '—'}</Td>
                    <Td className="text-slate-700">{b.tipo_prenda}</Td>
                    <Td num>{b.cantidad}</Td>
                    <Td>
                      <Badge tono={MOTIVO_TONO[b.motivo] || 'slate'}>
                        {MOTIVO_LABEL[b.motivo] || b.motivo}
                      </Badge>
                    </Td>
                    <Td className="text-slate-600">{b.autorizado_por || '—'}</Td>
                    <Td className="text-slate-600">{b.cofirmante || '—'}</Td>
                    <Td num className="font-semibold text-rose-700">
                      {formatARS(b.costo_ars)}
                    </Td>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
          </TablaWrap>
        )}
      </Card>

      <CofirmaModal
        abierto={modalAbierto}
        titulo="Co-firma de baja"
        detalle={
          <div className="space-y-0.5">
            <p>
              <span className="text-slate-400">Prenda:</span> {nombreTipo || '—'}
            </p>
            <p>
              <span className="text-slate-400">Sector:</span> {nombreSector || '—'}
            </p>
            <p>
              <span className="text-slate-400">Cantidad:</span> {form.cantidad || '—'} u.
            </p>
            <p>
              <span className="text-slate-400">Motivo:</span> {MOTIVO_LABEL[form.motivo] || form.motivo}
            </p>
          </div>
        }
        onCancelar={() => setModalAbierto(false)}
        onConfirmar={confirmarBaja}
      />
    </div>
  )
}
