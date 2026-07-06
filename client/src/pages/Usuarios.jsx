import { useEffect, useState } from 'react'
import { get, post, put } from '../api.js'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import { TablaWrap, Tabla, Thead, Th, Td, Fila } from '../components/tabla.jsx'
import { ModuleHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const ROLES = ['ADMIN', 'SUPERVISOR', 'OPERARIO']

const inputCls =
  'min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'

function Campo({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      {children}
    </div>
  )
}

// Modal liviano centrado (sin librerías).
function Modal({ titulo, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4 py-8">
      <div className="w-full max-w-md">
        <Card className="max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>
            <button
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
          <div className="p-5">{children}</div>
        </Card>
      </div>
    </div>
  )
}

export default function Usuarios() {
  const toast = useToast()
  const { usuario: yo } = useAuth()

  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null) // { tipo: 'nuevo'|'editar'|'password', usuario? }
  const [form, setForm] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState('')

  const cargar = () => {
    get('/usuarios')
      .then((d) => setData(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    cargar()
  }, [])

  const abrirNuevo = () => {
    setErrorForm('')
    setForm({ usuario: '', nombre: '', rol: 'OPERARIO', password: '' })
    setModal({ tipo: 'nuevo' })
  }

  const abrirEditar = (u) => {
    setErrorForm('')
    setForm({ nombre: u.nombre, rol: u.rol, activo: !!u.activo })
    setModal({ tipo: 'editar', usuario: u })
  }

  const abrirPassword = (u) => {
    setErrorForm('')
    setForm({ password: '' })
    setModal({ tipo: 'password', usuario: u })
  }

  const cerrar = () => {
    if (guardando) return
    setModal(null)
    setErrorForm('')
  }

  const guardar = async (e) => {
    e.preventDefault()
    setErrorForm('')

    try {
      if (modal.tipo === 'nuevo') {
        if (!form.usuario.trim() || !form.nombre.trim() || !form.password) {
          setErrorForm('Completá usuario, nombre y contraseña.')
          return
        }
        setGuardando(true)
        await post('/usuarios', {
          usuario: form.usuario.trim(),
          nombre: form.nombre.trim(),
          rol: form.rol,
          password: form.password,
        })
        toast.exito('Usuario creado.')
      } else if (modal.tipo === 'editar') {
        if (!form.nombre.trim()) {
          setErrorForm('El nombre no puede quedar vacío.')
          return
        }
        setGuardando(true)
        await put(`/usuarios/${modal.usuario.id}`, {
          nombre: form.nombre.trim(),
          rol: form.rol,
          activo: form.activo ? 1 : 0,
        })
        toast.exito('Usuario actualizado.')
      } else if (modal.tipo === 'password') {
        if (!form.password) {
          setErrorForm('Ingresá la nueva contraseña.')
          return
        }
        setGuardando(true)
        await put(`/usuarios/${modal.usuario.id}/password`, { password: form.password })
        toast.exito('Contraseña actualizada.')
      }
      setModal(null)
      cargar()
    } catch (err) {
      setErrorForm(err.message)
      toast.error(err.message)
    } finally {
      setGuardando(false)
    }
  }

  // Activar / desactivar reenviando nombre + rol con el nuevo estado.
  const toggleActivo = async (u) => {
    try {
      await put(`/usuarios/${u.id}`, {
        nombre: u.nombre,
        rol: u.rol,
        activo: u.activo ? 0 : 1,
      })
      toast.exito(u.activo ? 'Usuario desactivado.' : 'Usuario activado.')
      cargar()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (error) return <ErrorMsg mensaje={error} />
  if (!data) return <Cargando />

  return (
    <div>
      <ModuleHeader
        titulo="Usuarios"
        descripcion="Cuentas de acceso y roles del sistema"
        breadcrumb={['Sistema', 'Usuarios']}
        accion={
          <button
            onClick={abrirNuevo}
            className="min-h-[44px] rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
          >
            Nuevo usuario
          </button>
        }
      />

      <Card>
        {data.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">No hay usuarios cargados.</p>
        ) : (
          <TablaWrap>
            <Tabla>
              <Thead>
                <Th>Usuario</Th>
                <Th>Nombre</Th>
                <Th>Rol</Th>
                <Th>Estado</Th>
                <Th className="text-right">Acciones</Th>
              </Thead>
              <tbody>
                {data.map((u) => (
                  <Fila key={u.id}>
                    <Td className="font-mono font-medium text-slate-700">{u.usuario}</Td>
                    <Td>{u.nombre}</Td>
                    <Td>
                      <Badge rol={u.rol} />
                    </Td>
                    <Td>
                      {u.activo ? (
                        <Badge tono="emerald">Activo</Badge>
                      ) : (
                        <Badge tono="slate">Inactivo</Badge>
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          onClick={() => abrirEditar(u)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => abrirPassword(u)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          Reset clave
                        </button>
                        <button
                          onClick={() => toggleActivo(u)}
                          disabled={yo && yo.id === u.id}
                          title={yo && yo.id === u.id ? 'No podés desactivar tu propia cuenta' : undefined}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${
                            u.activo
                              ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {u.activo ? 'Desactivar' : 'Activar'}
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

      {modal && (
        <Modal
          titulo={
            modal.tipo === 'nuevo'
              ? 'Nuevo usuario'
              : modal.tipo === 'editar'
                ? `Editar: ${modal.usuario.usuario}`
                : `Reset de clave: ${modal.usuario.usuario}`
          }
          onClose={cerrar}
        >
          <form onSubmit={guardar} className="space-y-4">
            {errorForm && <ErrorMsg mensaje={errorForm} />}

            {modal.tipo === 'nuevo' && (
              <>
                <Campo label="Usuario">
                  <input
                    type="text"
                    autoCapitalize="none"
                    autoFocus
                    value={form.usuario}
                    onChange={(e) => setForm((f) => ({ ...f, usuario: e.target.value }))}
                    className={inputCls}
                  />
                </Campo>
                <Campo label="Nombre">
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                    className={inputCls}
                  />
                </Campo>
                <Campo label="Rol">
                  <select
                    value={form.rol}
                    onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}
                    className={inputCls}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Contraseña">
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className={inputCls}
                  />
                </Campo>
              </>
            )}

            {modal.tipo === 'editar' && (
              <>
                <Campo label="Nombre">
                  <input
                    type="text"
                    autoFocus
                    value={form.nombre}
                    onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                    className={inputCls}
                  />
                </Campo>
                <Campo label="Rol">
                  <select
                    value={form.rol}
                    onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}
                    className={inputCls}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Campo>
                <label className="flex min-h-[44px] items-center gap-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!form.activo}
                    onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  Usuario activo
                </label>
              </>
            )}

            {modal.tipo === 'password' && (
              <Campo label="Nueva contraseña">
                <input
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className={inputCls}
                />
              </Campo>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={cerrar}
                disabled={guardando}
                className="min-h-[44px] rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="min-h-[44px] rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
