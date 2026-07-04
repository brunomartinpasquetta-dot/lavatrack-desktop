import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import { ConexionProvider } from './context/ConexionContext.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Remitos from './pages/Remitos.jsx'
import RemitoNuevo from './pages/RemitoNuevo.jsx'
import RemitoDetalle from './pages/RemitoDetalle.jsx'
import Stock from './pages/Stock.jsx'
import Mermas from './pages/Mermas.jsx'
import Reposicion from './pages/Reposicion.jsx'
import Ajustes from './pages/Ajustes.jsx'

// Router principal de LavaTrack.
export default function App() {
  return (
    <ConexionProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/remitos" element={<Remitos />} />
          <Route path="/remitos/nuevo" element={<RemitoNuevo />} />
          <Route path="/remitos/:id" element={<RemitoDetalle />} />
          <Route path="/reposicion" element={<Reposicion />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/mermas" element={<Mermas />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </ConexionProvider>
  )
}
