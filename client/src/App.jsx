import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import { ConexionProvider } from './context/ConexionContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Remitos from './pages/Remitos.jsx'
import RemitoNuevo from './pages/RemitoNuevo.jsx'
import RemitoDetalle from './pages/RemitoDetalle.jsx'
import Retornos from './pages/Retornos.jsx'
import Stock from './pages/Stock.jsx'
import Mermas from './pages/Mermas.jsx'
import Reposicion from './pages/Reposicion.jsx'
import Reportes from './pages/Reportes.jsx'
import Sectores from './pages/Sectores.jsx'
import TiposPrenda from './pages/TiposPrenda.jsx'
import Ajustes from './pages/Ajustes.jsx'
import Inventario from './pages/Inventario.jsx'
import Presets from './pages/Presets.jsx'
import PrendasIdentificadas from './pages/PrendasIdentificadas.jsx'
import Usuarios from './pages/Usuarios.jsx'

// Guard de rutas privadas: sin usuario válido → /login. Mientras valida la sesión, spinner.
function GuardPrivado() {
  const { usuario, cargando } = useAuth()
  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600" />
      </div>
    )
  }
  if (!usuario) return <Navigate to="/login" replace />
  return <Outlet />
}

// Router principal de LavaTrack.
export default function App() {
  return (
    <ConexionProvider>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Pública */}
            <Route path="/login" element={<Login />} />

            {/* Privadas: detrás del guard de sesión */}
            <Route element={<GuardPrivado />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                {/* Operación */}
                <Route path="/reposicion" element={<Reposicion />} />
                <Route path="/remitos" element={<Remitos />} />
                <Route path="/remitos/nuevo" element={<RemitoNuevo />} />
                <Route path="/remitos/:id" element={<RemitoDetalle />} />
                <Route path="/retornos" element={<Retornos />} />
                {/* Control */}
                <Route path="/stock" element={<Stock />} />
                <Route path="/mermas" element={<Mermas />} />
                <Route path="/inventario" element={<Inventario />} />
                <Route path="/prendas-identificadas" element={<PrendasIdentificadas />} />
                <Route path="/reportes" element={<Reportes />} />
                {/* Maestros */}
                <Route path="/sectores" element={<Sectores />} />
                <Route path="/tipos-prenda" element={<TiposPrenda />} />
                <Route path="/presets" element={<Presets />} />
                {/* Sistema */}
                <Route path="/usuarios" element={<Usuarios />} />
                <Route path="/ajustes" element={<Ajustes />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </ConexionProvider>
  )
}
