import { useEffect, useRef, useState } from 'react'
import Card from './Card.jsx'
import { ErrorMsg } from './ui.jsx'

// Modal reutilizable de FIRMA DOBLE (AUD-004). Pide usuario + contraseña de un
// supervisor co-firmante y ejecuta la acción vía onConfirmar(cofirma).
// La validación real (rol >= SUPERVISOR, usuario distinto al actor, password) la
// hace el server; acá sólo mostramos el error que devuelva.
//
// Props:
//   abierto        → boolean, controla visibilidad
//   titulo         → string, encabezado del modal
//   detalle        → nodo opcional con el resumen de la operación a co-firmar
//   onCancelar()   → cierra sin ejecutar
//   onConfirmar(cofirma) → async; recibe {usuario, password}. Si rechaza, se
//                    muestra el error y el modal queda abierto para reintentar.
const inputCls =
  'min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'

export default function CofirmaModal({ abierto, titulo, detalle, onCancelar, onConfirmar }) {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const usuarioRef = useRef(null)

  // Al abrir: limpiar campos/estado y enfocar el usuario.
  useEffect(() => {
    if (abierto) {
      setUsuario('')
      setPassword('')
      setError('')
      setEnviando(false)
      // Enfocar tras el render.
      setTimeout(() => usuarioRef.current?.focus(), 0)
    }
  }, [abierto])

  if (!abierto) return null

  const cerrar = () => {
    if (enviando) return
    onCancelar()
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!usuario.trim() || !password) {
      setError('Ingresá usuario y contraseña del supervisor co-firmante.')
      return
    }
    setEnviando(true)
    try {
      await onConfirmar({ usuario: usuario.trim(), password })
      // El padre cierra el modal al tener éxito (abierto → false).
    } catch (err) {
      setError(err?.message || 'No se pudo validar la co-firma.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4 py-8">
      <div className="w-full max-w-md">
        <Card className="max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">{titulo || 'Firma doble'}</h2>
            <button
              onClick={cerrar}
              className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
          <form onSubmit={submit} className="space-y-4 p-5">
            <p className="text-xs text-slate-500">
              Esta operación requiere la firma de un supervisor distinto al operario.
            </p>

            {detalle && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {detalle}
              </div>
            )}

            {error && <ErrorMsg mensaje={error} />}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Usuario del supervisor
              </label>
              <input
                ref={usuarioRef}
                type="text"
                autoCapitalize="none"
                autoComplete="off"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Contraseña</label>
              <input
                type="password"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={cerrar}
                disabled={enviando}
                className="min-h-[44px] rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviando}
                className="min-h-[44px] rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
              >
                {enviando ? 'Confirmando…' : 'Confirmar co-firma'}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
