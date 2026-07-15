import { useEffect, useState } from 'react'
import { get, post, put } from '../api.js'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import { TablaWrap, Tabla, Thead, Th, Td, Fila } from '../components/tabla.jsx'
import { ModuleHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { formatFecha } from '../utils/format.js'
import { useConexion } from '../context/ConexionContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const claseInput =
  'w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'

export default function Transportistas() {
  const { online } = useConexion()
  const toast = useToast()
  const { rolAlMenos } = useAuth()
  // Activar/desactivar y editar es gestión → SUPERVISOR+. Alta → OPERARIO+ (todos los logueados llegan acá).
  const puedeGestionar = rolAlMenos('SUPERVISOR')

  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  // Form (crear/editar). editId=null => crear.
  const [abierto, setAbierto] = useState(false)
  const [editId, setEditId] = useState(null)
  const [nombre, setNombre] = useState('')
  const [documento, setDocumento] = useState('')
  const [contacto, setContacto] = useState('')
  const [activo, setActivo] = useState(true)
  const [errorForm, setErrorForm] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = () =>
    get('/transportistas')
      .then((d) => setData(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message))

  useEffect(() => {
    cargar()
  }, [])

  const nuevo = () => {
    setEditId(null)
    setNombre('')
    setDocumento('')
    setContacto('')
    setActivo(true)
    setErrorForm('')
    setAbierto(true)
  }

  const editar = (t) => {
    setEditId(t.id)
    setNombre(t.nombre || '')
    setDocumento(t.documento || '')
    setContacto(t.contacto || '')
    setActivo(!!t.activo)
    setErrorForm('')
    setAbierto(true)
  }

  const guardar = async () => {
    setErrorForm('')
    if (!nombre.trim()) return setErrorForm('El nombre no puede estar vacío.')

    setGuardando(true)
    try {
      if (editId != null) {
        await put(`/transportistas/${editId}`, {
          nombre: nombre.trim(),
          documento: documento.trim(),
          contacto: contacto.trim(),
          activo: activo ? 1 : 0,
        })
        toast.exito('Transportista actualizado.')
      } else {
        await post('/transportistas', {
          nombre: nombre.trim(),
          documento: documento.trim(),
          contacto: contacto.trim(),
        })
        toast.exito('Transportista creado.')
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

  // Alterna activo/inactivo con el PUT (soft-delete). Requiere SUPERVISOR+.
  const alternarActivo = async (t) => {
    try {
      await put(`/transportistas/${t.id}`, {
        nombre: t.nombre,
        documento: t.documento || '',
        contacto: t.contacto || '',
        activo: t.activo ? 0 : 1,
      })
      toast.exito(t.activo ? 'Transportista desactivado.' : 'Transportista activado.')
      cargar()
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (error) return <ErrorMsg mensaje={error} />
  if (!data) return <Cargando />

  return (
    <div>
      <ModuleHeader
        titulo="Transportistas"
        descripcion="Personas o empresas que trasladan la ropa entre el hospital y la lavandería"
        breadcrumb={['Maestros', 'Transportistas']}
        accion={
          <button
            onClick={nuevo}
            className="min-h-[44px] rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
          >
            + Nuevo transportista
          </button>
        }
      />

      {abierto && (
        <Card className="mb-6">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">
              {editId != null ? 'Editar transportista' : 'Nuevo transportista'}
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
                  placeholder="Nombre y apellido o empresa"
                  className={claseInput}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Documento
                </label>
                <input
                  type="text"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  placeholder="CUIT / DNI / patente"
                  className={claseInput}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Contacto</label>
                <input
                  type="text"
                  inputMode="tel"
                  value={contacto}
                  onChange={(e) => setContacto(e.target.value)}
                  placeholder="Teléfono / email"
                  className={claseInput}
                />
              </div>
            </div>

            {editId != null && (
              <div className="mt-4">
                <label className="flex min-h-[44px] w-fit cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={activo}
                    onChange={(e) => setActivo(e.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  Activo
                </label>
              </div>
            )}

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
                {guardando ? 'Guardando…' : 'Guardar transportista'}
              </button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        {data.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">No hay transportistas cargados.</p>
        ) : (
          <TablaWrap>
            <Tabla>
              <Thead>
                <Th>Nombre</Th>
                <Th>Documento</Th>
                <Th>Contacto</Th>
                <Th>Alta</Th>
                <Th>Estado</Th>
                <Th num> </Th>
              </Thead>
              <tbody>
                {data.map((t) => (
                  <Fila key={t.id}>
                    <Td className="font-medium text-slate-700">{t.nombre}</Td>
                    <Td>{t.documento || <span className="text-slate-400">—</span>}</Td>
                    <Td>{t.contacto || <span className="text-slate-400">—</span>}</Td>
                    <Td className="text-slate-500">
                      {t.fecha_alta ? formatFecha(t.fecha_alta) : '—'}
                    </Td>
                    <Td>
                      <Badge tono={t.activo ? 'emerald' : 'slate'}>
                        {t.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </Td>
                    <Td num>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => editar(t)}
                          className="min-h-[44px] rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Editar
                        </button>
                        {puedeGestionar && (
                          <button
                            onClick={() => alternarActivo(t)}
                            className={
                              t.activo
                                ? 'min-h-[44px] rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50'
                                : 'min-h-[44px] rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50'
                            }
                          >
                            {t.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        )}
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
