import { useConexion } from '../context/ConexionContext.jsx'

// Banner fijo arriba cuando no hay conexión con el servidor.
// Se muestra sobre todo el contenido y avisa que se está reintentando.
export default function BannerConexion() {
  const { online } = useConexion()
  if (online) return null

  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-rose-600 text-white shadow-md">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-6 py-2 text-sm font-medium">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="h-4 w-4 animate-pulse"
        >
          <path d="M1 1l22 22" strokeLinecap="round" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" strokeLinecap="round" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" strokeLinecap="round" />
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9" strokeLinecap="round" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" strokeLinecap="round" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" strokeLinecap="round" />
          <path d="M12 20h.01" strokeLinecap="round" />
        </svg>
        <span>Sin conexión con el servidor. Reintentando…</span>
      </div>
    </div>
  )
}
