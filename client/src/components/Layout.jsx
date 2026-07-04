import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import BannerConexion from './BannerConexion.jsx'

// Layout general: sidebar fija a la izquierda + área de contenido.
// El banner de "sin conexión" se monta acá para cubrir toda la app.
export default function Layout() {
  return (
    <div className="min-h-full">
      <BannerConexion />
      <Sidebar />
      <main className="ml-60 min-h-screen">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
