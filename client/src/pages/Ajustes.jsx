import { useEffect, useState } from 'react'
import { get, put } from '../api.js'
import Card from '../components/Card.jsx'
import { PageHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { useConexion } from '../context/ConexionContext.jsx'

// Pantalla de Ajustes: puerto del servidor + acceso para terminales.
export default function Ajustes() {
  const { online } = useConexion()

  const [config, setConfig] = useState(null)
  const [health, setHealth] = useState(null)
  const [error, setError] = useState('')

  const [puerto, setPuerto] = useState('')
  const [errorPuerto, setErrorPuerto] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [copiado, setCopiado] = useState('')

  useEffect(() => {
    Promise.all([get('/config'), get('/health')])
      .then(([cfg, hlt]) => {
        setConfig(cfg)
        setHealth(hlt)
        setPuerto(String(cfg.puerto ?? ''))
      })
      .catch((e) => setError(e.message))
  }, [])

  const guardarPuerto = async (e) => {
    e.preventDefault()
    setErrorPuerto('')
    setAviso('')

    const n = parseInt(puerto, 10)
    if (Number.isNaN(n) || n < 1024 || n > 65535) {
      setErrorPuerto('El puerto debe ser un número entero entre 1024 y 65535.')
      return
    }

    setGuardando(true)
    try {
      const res = await put('/config', { puerto: n })
      const nuevoPuerto = res?.config?.puerto ?? n
      setConfig((c) => ({ ...c, puerto: nuevoPuerto }))
      setAviso('Cambio guardado. Reiniciá la aplicación para aplicar el nuevo puerto.')
    } catch (err) {
      setErrorPuerto(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const copiar = async (url) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(url)
      setTimeout(() => setCopiado(''), 1500)
    } catch {
      // Si el navegador bloquea el portapapeles, no rompemos la UI.
      setCopiado('')
    }
  }

  if (error) return <ErrorMsg mensaje={error} />
  if (!config) return <Cargando />

  const puertoHealth = health?.puerto ?? config.puerto
  const ips = health?.ips || []

  return (
    <div>
      <PageHeader titulo="Ajustes" descripcion="Configuración de la instalación de LavaTrack" />

      {/* Puerto del servidor */}
      <Card className="mb-6">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800">Puerto del servidor</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Puerto en el que escucha LavaTrack. Cambiarlo requiere reiniciar la aplicación.
          </p>
        </div>
        <form onSubmit={guardarPuerto} className="p-5">
          {errorPuerto && (
            <div className="mb-4">
              <ErrorMsg mensaje={errorPuerto} />
            </div>
          )}
          {aviso && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {aviso}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Puerto (1024–65535)
              </label>
              <input
                type="number"
                min="1024"
                max="65535"
                value={puerto}
                onChange={(e) => setPuerto(e.target.value)}
                className="w-40 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <button
              type="submit"
              disabled={guardando || !online}
              title={!online ? 'Sin conexión con el servidor' : undefined}
              className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar puerto'}
            </button>
          </div>
        </form>
      </Card>

      {/* Acceso para terminales */}
      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800">Acceso para terminales</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Abrí estas direcciones desde el navegador de cada terminal en la red local.
          </p>
        </div>
        <div className="p-5">
          {ips.length === 0 ? (
            <p className="text-sm text-slate-400">No se detectaron direcciones de red.</p>
          ) : (
            <ul className="space-y-2">
              {ips.map((item) => {
                const url = `http://${item.ip}:${puertoHealth}`
                return (
                  <li
                    key={item.ip}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5"
                  >
                    <div>
                      <p className="font-mono text-sm text-slate-700">{url}</p>
                      {item.interfaz && (
                        <p className="text-[11px] text-slate-400">Interfaz {item.interfaz}</p>
                      )}
                    </div>
                    <button
                      onClick={() => copiar(url)}
                      className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
                    >
                      {copiado === url ? 'Copiado ✓' : 'Copiar'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="mt-4 border-t border-slate-100 pt-4">
            <a
              href="/terminal-info"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-teal-700 hover:underline"
            >
              Ver instrucciones de acceso para terminales →
            </a>
          </div>
        </div>
      </Card>
    </div>
  )
}
