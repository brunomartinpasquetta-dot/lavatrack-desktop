import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { get, qs } from '../api.js'
import Card from '../components/Card.jsx'
import TablaRemitos from '../components/TablaRemitos.jsx'
import FiltrosRemitos from '../components/FiltrosRemitos.jsx'
import { PageHeader, Cargando, ErrorMsg } from '../components/ui.jsx'

const FILTROS_VACIOS = { estado: '', tipo: '', sector_id: '', desde: '', hasta: '' }

export default function Remitos() {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [sectores, setSectores] = useState([])
  const [remitos, setRemitos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // Cargar sectores para el filtro (una vez).
  useEffect(() => {
    get('/sectores')
      .then(setSectores)
      .catch(() => setSectores([]))
  }, [])

  // Refetch al cambiar filtros (query params).
  useEffect(() => {
    setCargando(true)
    setError('')
    get(`/remitos${qs(filtros)}`)
      .then((r) => setRemitos(r || []))
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [filtros])

  return (
    <div>
      <PageHeader
        titulo="Remitos"
        descripcion="Envíos y retornos de ropa a la lavandería"
        accion={
          <Link
            to="/remitos/nuevo"
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
          >
            + Nuevo envío
          </Link>
        }
      />

      <Card className="mb-4 p-4">
        <FiltrosRemitos
          filtros={filtros}
          sectores={sectores}
          onChange={setFiltros}
          onLimpiar={() => setFiltros(FILTROS_VACIOS)}
        />
      </Card>

      {error && <ErrorMsg mensaje={error} />}

      <Card>
        {cargando ? (
          <Cargando />
        ) : (
          <>
            <div className="border-b border-slate-100 px-4 py-3 text-xs font-medium text-slate-500">
              {remitos.length} remito{remitos.length === 1 ? '' : 's'}
            </div>
            <TablaRemitos remitos={remitos} />
          </>
        )}
      </Card>
    </div>
  )
}
