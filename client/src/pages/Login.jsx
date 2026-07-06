import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../components/Card.jsx'
import { ErrorMsg } from '../components/ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'

function Logo() {
  return (
    <svg viewBox="0 0 24 24" className="h-9 w-9 text-teal-600" fill="currentColor">
      <path d="M12 2.5c-.35 0-.68.18-.86.48C9.9 5.1 5.5 10.2 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10.2 14.1 5.1 12.86 2.98A1 1 0 0 0 12 2.5Zm-2.2 12.2a.9.9 0 0 1 .9.9 1.4 1.4 0 0 0 1.4 1.4.9.9 0 0 1 0 1.8 3.2 3.2 0 0 1-3.2-3.2.9.9 0 0 1 .9-.9Z" />
    </svg>
  )
}

// Pantalla de ingreso. Form usuario + password, estética slate/teal.
export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const toast = useToast()

  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!usuario.trim() || !password) {
      setError('Ingresá usuario y contraseña.')
      return
    }
    setEnviando(true)
    try {
      const u = await login(usuario.trim(), password)
      toast.exito(`Bienvenido/a, ${u?.nombre || u?.usuario || ''}`)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const msg = err?.message || 'No se pudo iniciar sesión.'
      setError(msg)
      toast.error(msg)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex items-center gap-2.5">
            <Logo />
            <div className="text-left">
              <p className="text-2xl font-semibold leading-none text-slate-800">LavaTrack</p>
              <p className="mt-1 text-xs text-slate-400">Gestión de Ropa Hospitalaria</p>
            </div>
          </div>
        </div>

        <Card className="p-6">
          <h1 className="mb-1 text-lg font-semibold text-slate-800">Iniciar sesión</h1>
          <p className="mb-5 text-sm text-slate-500">Ingresá con tu usuario para continuar.</p>

          {error && (
            <div className="mb-4">
              <ErrorMsg mensaje={error} />
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="usuario" className="mb-1 block text-xs font-medium text-slate-500">
                Usuario
              </label>
              <input
                id="usuario"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoFocus
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-xs font-medium text-slate-500">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="min-h-[44px] w-full rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
            >
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>

          <p className="mt-5 border-t border-slate-100 pt-4 text-center text-[11px] leading-relaxed text-slate-400">
            Usuarios demo: <span className="font-mono text-slate-500">admin</span> ·{' '}
            <span className="font-mono text-slate-500">super</span> ·{' '}
            <span className="font-mono text-slate-500">oper</span>
          </p>
        </Card>
      </div>
    </div>
  )
}
