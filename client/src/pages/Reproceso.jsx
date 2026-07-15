import { useEffect, useState } from 'react'
import { get, post } from '../api.js'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import { TablaWrap, Tabla, Thead, Th, Td, Fila } from '../components/tabla.jsx'
import { ModuleHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { useToast } from '../context/ToastContext.jsx'

// Reingreso de reproceso (AUD-003): prendas enviadas a relavado/costura que ya
// volvieron y deben reingresar al stock del sector. Operación rutinaria, sin firma doble.

const inputCls =
  'min-h-[44px] w-24 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-right text-sm tabular-nums text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'

// Clave estable por fila (sector + tipo).
const claveFila = (r) => `${r.sector_id}-${r.tipo_prenda_id}`

export default function Reproceso() {
  const toast = useToast()

  const [pendientes, setPendientes] = useState([])
  const [cantidades, setCantidades] = useState({}) // clave → string
  const [enviando, setEnviando] = useState('') // clave en curso
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const cargar = () => {
    setError('')
    return get('/reproceso')
      .then((d) => setPendientes(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    cargar().finally(() => setCargando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setCantidad = (clave, valor) =>
    setCantidades((c) => ({ ...c, [clave]: valor.replace(/[^0-9]/g, '') }))

  const reingresar = async (fila) => {
    const clave = claveFila(fila)
    const cant = parseInt(cantidades[clave], 10)
    if (Number.isNaN(cant) || cant <= 0) {
      toast.error('Ingresá una cantidad mayor a 0.')
      return
    }
    if (cant > fila.pendiente) {
      toast.error(`No podés reingresar más de ${fila.pendiente} (pendiente).`)
      return
    }
    setEnviando(clave)
    try {
      await post('/reproceso/reingreso', {
        sector_id: fila.sector_id,
        tipo_prenda_id: fila.tipo_prenda_id,
        cantidad: cant,
      })
      toast.exito(`Reingresaron ${cant} u. de ${fila.tipo_prenda} a ${fila.sector}.`)
      setCantidades((c) => ({ ...c, [clave]: '' }))
      await cargar()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setEnviando('')
    }
  }

  if (error) return <ErrorMsg mensaje={error} />
  if (cargando) return <Cargando />

  return (
    <div>
      <ModuleHeader
        titulo="Reproceso"
        descripcion="Prendas en relavado/costura pendientes de reingresar al stock"
        breadcrumb={['Operación', 'Reproceso']}
      />

      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800">Pendientes de reingreso</h2>
        </div>
        {pendientes.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-slate-500">No hay prendas de reproceso pendientes.</p>
            <p className="mt-1 text-xs text-slate-400">
              Todo lo enviado a relavado/costura ya reingresó al stock.
            </p>
          </div>
        ) : (
          <TablaWrap>
            <Tabla>
              <Thead>
                <Th>Sector</Th>
                <Th>Prenda</Th>
                <Th num>Pendiente</Th>
                <Th num>Cantidad a reingresar</Th>
                <Th className="text-right">Acción</Th>
              </Thead>
              <tbody>
                {pendientes.map((r) => {
                  const clave = claveFila(r)
                  return (
                    <Fila key={clave}>
                      <Td className="text-slate-700">{r.sector}</Td>
                      <Td className="text-slate-700">{r.tipo_prenda}</Td>
                      <Td num>
                        <Badge tono="amber">{r.pendiente}</Badge>
                      </Td>
                      <Td num>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={cantidades[clave] || ''}
                          onChange={(e) => setCantidad(clave, e.target.value)}
                          placeholder="0"
                          className={inputCls}
                        />
                      </Td>
                      <Td className="text-right">
                        <button
                          onClick={() => reingresar(r)}
                          disabled={enviando === clave}
                          className="min-h-[44px] rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
                        >
                          {enviando === clave ? 'Reingresando…' : 'Reingresar'}
                        </button>
                      </Td>
                    </Fila>
                  )
                })}
              </tbody>
            </Tabla>
          </TablaWrap>
        )}
      </Card>
    </div>
  )
}
