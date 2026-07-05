import { createContext, useCallback, useContext, useState } from 'react'

// Toast liviano propio (sin librerías). Aparece arriba a la derecha y se auto-oculta a los ~3s.
// teal = éxito, rose = error. Uso: const toast = useToast(); toast.exito('...') / toast.error('...').
const ToastContext = createContext({ exito: () => {}, error: () => {} })

let idSeq = 0

function IconoExito() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0">
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconoError() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0">
      <path d="M12 8v5M12 16.5v.5M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ToastItem({ toast, onClose }) {
  const esExito = toast.tipo === 'exito'
  const estilo = esExito
    ? 'border-teal-200 bg-teal-50 text-teal-800'
    : 'border-rose-200 bg-rose-50 text-rose-800'
  return (
    <div
      role="status"
      onClick={onClose}
      className={`pointer-events-auto flex cursor-pointer items-start gap-2.5 rounded-lg border px-4 py-3 text-sm shadow-lg ${estilo}`}
    >
      {esExito ? <IconoExito /> : <IconoError />}
      <span className="min-w-0 break-words font-medium">{toast.mensaje}</span>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const quitar = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const mostrar = useCallback(
    (mensaje, tipo) => {
      if (!mensaje) return
      const id = ++idSeq
      setToasts((prev) => [...prev, { id, mensaje, tipo }])
      setTimeout(() => quitar(id), 3000)
    },
    [quitar],
  )

  const exito = useCallback((m) => mostrar(m, 'exito'), [mostrar])
  const error = useCallback((m) => mostrar(m, 'error'), [mostrar])

  return (
    <ToastContext.Provider value={{ exito, error }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => quitar(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// Hook para disparar toasts desde cualquier página.
export function useToast() {
  return useContext(ToastContext)
}
