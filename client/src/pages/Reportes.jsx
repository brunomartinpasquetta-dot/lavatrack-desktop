import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { get } from '../api.js'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import { TablaWrap, Tabla, Thead, Th, Td, Fila } from '../components/tabla.jsx'
import { ModuleHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { formatARS, formatNum } from '../utils/format.js'

// Íconos SVG inline para las tarjetas de acceso.
const IconoMermas = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
    <path d="M12 9v4M12 17h.01" strokeLinecap="round" />
    <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
  </svg>
)
const IconoBajas = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinejoin="round" strokeLinecap="round" />
  </svg>
)
const IconoSector = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
    <path d="M4 20V10M10 20V4M16 20v-7M4 20h16" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconoCalendario = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18M8 2v4M16 2v4" strokeLinecap="round" />
  </svg>
)

const MOTIVO_BAJA = {
  ROTURA: 'Rotura',
  PERDIDA: 'Pérdida',
  FIN_VIDA_UTIL: 'Fin vida útil',
}
const MOTIVO_TONO = { ROTURA: 'rose', PERDIDA: 'amber', FIN_VIDA_UTIL: 'slate' }

// Tarjeta de acceso a un reporte.
function CardReporte({ icono, titulo, descripcion, onClick, activa = true, badge }) {
  return (
    <Card
      onClick={activa ? onClick : undefined}
      className={
        'relative p-5 ' +
        (activa
          ? 'cursor-pointer transition-shadow hover:shadow-md hover:border-teal-300'
          : 'opacity-60')
      }
    >
      <div className="flex items-start gap-4">
        <div
          className={
            'shrink-0 rounded-lg p-2.5 ' +
            (activa ? 'bg-teal-50 text-teal-600' : 'bg-slate-100 text-slate-400')
          }
        >
          {icono}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">{titulo}</h3>
            {badge}
          </div>
          <p className="mt-1 text-sm text-slate-500">{descripcion}</p>
        </div>
      </div>
    </Card>
  )
}

export default function Reportes() {
  const navigate = useNavigate()
  // Vista activa desplegada: null | 'bajas' | 'sector'
  const [vista, setVista] = useState(null)
  const [mermas, setMermas] = useState(null)
  const [remitos, setRemitos] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  // Carga perezosa según la vista seleccionada.
  useEffect(() => {
    if (vista === 'bajas' && mermas == null) {
      setCargando(true)
      setError('')
      // Últimos 60 días (default del backend con params vacíos).
      get('/mermas')
        .then(setMermas)
        .catch((e) => setError(e.message))
        .finally(() => setCargando(false))
    }
    if (vista === 'sector' && remitos == null) {
      setCargando(true)
      setError('')
      get('/remitos?tipo=ENVIO')
        .then((r) => setRemitos(Array.isArray(r) ? r : []))
        .catch((e) => setError(e.message))
        .finally(() => setCargando(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista])

  // Agrupación: bajas por motivo.
  const bajasPorMotivo = (() => {
    const acc = {}
    ;(mermas?.bajas || []).forEach((b) => {
      const m = b.motivo || 'OTRO'
      if (!acc[m]) acc[m] = { motivo: m, cantidad: 0, costo_ars: 0 }
      acc[m].cantidad += Number(b.cantidad) || 0
      acc[m].costo_ars += Number(b.costo_ars) || 0
    })
    return Object.values(acc).sort((a, b) => b.costo_ars - a.costo_ars)
  })()
  const totalBajas = bajasPorMotivo.reduce(
    (t, r) => ({ cantidad: t.cantidad + r.cantidad, costo_ars: t.costo_ars + r.costo_ars }),
    { cantidad: 0, costo_ars: 0 }
  )

  // Agrupación: uso por sector (envíos).
  const usoPorSector = (() => {
    const acc = {}
    ;(remitos || []).forEach((r) => {
      const s = r.sector || '—'
      if (!acc[s]) acc[s] = { sector: s, prendas: 0, remitos: 0 }
      acc[s].prendas += Number(r.total_prendas) || 0
      acc[s].remitos += 1
    })
    return Object.values(acc).sort((a, b) => b.prendas - a.prendas)
  })()
  const totalUso = usoPorSector.reduce(
    (t, r) => ({ prendas: t.prendas + r.prendas, remitos: t.remitos + r.remitos }),
    { prendas: 0, remitos: 0 }
  )

  return (
    <div>
      <ModuleHeader
        titulo="Reportes"
        descripcion="Vistas de control sobre datos operativos"
        breadcrumb={['Control', 'Reportes']}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CardReporte
          icono={IconoMermas}
          titulo="Mermas por período"
          descripcion="Faltantes de conciliación y bajas por rango de fechas."
          onClick={() => navigate('/mermas')}
        />
        <CardReporte
          icono={IconoBajas}
          titulo="Bajas por motivo"
          descripcion="Bajas de los últimos 60 días agrupadas por motivo."
          activa
          onClick={() => setVista((v) => (v === 'bajas' ? null : 'bajas'))}
        />
        <CardReporte
          icono={IconoSector}
          titulo="Uso por sector"
          descripcion="Prendas enviadas acumuladas por sector."
          activa
          onClick={() => setVista((v) => (v === 'sector' ? null : 'sector'))}
        />
        <CardReporte
          icono={IconoCalendario}
          titulo="Kg y remitos por mes"
          descripcion="Serie mensual de peso y cantidad de remitos."
          activa={false}
          badge={<Badge tono="slate">Próximamente</Badge>}
        />
      </div>

      {error && (
        <div className="mt-6">
          <ErrorMsg mensaje={error} />
        </div>
      )}

      {/* Vista: Bajas por motivo */}
      {vista === 'bajas' && (
        <Card className="mt-6">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Bajas por motivo</h2>
            <p className="mt-0.5 text-xs text-slate-500">Últimos 60 días</p>
          </div>
          {cargando && mermas == null ? (
            <Cargando />
          ) : bajasPorMotivo.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">Sin bajas en el período.</p>
          ) : (
            <TablaWrap>
              <Tabla>
                <Thead>
                  <Th>Motivo</Th>
                  <Th num>Cantidad</Th>
                  <Th num>Costo</Th>
                </Thead>
                <tbody>
                  {bajasPorMotivo.map((r) => (
                    <Fila key={r.motivo}>
                      <Td>
                        <Badge tono={MOTIVO_TONO[r.motivo] || 'slate'}>
                          {MOTIVO_BAJA[r.motivo] || r.motivo}
                        </Badge>
                      </Td>
                      <Td num>{formatNum(r.cantidad)}</Td>
                      <Td num className="font-medium text-rose-700">{formatARS(r.costo_ars)}</Td>
                    </Fila>
                  ))}
                  <tr className="border-t-2 border-slate-200 font-semibold">
                    <Td className="font-semibold text-slate-700">Total</Td>
                    <Td num className="font-semibold text-slate-800">{formatNum(totalBajas.cantidad)}</Td>
                    <Td num className="font-semibold text-rose-700">{formatARS(totalBajas.costo_ars)}</Td>
                  </tr>
                </tbody>
              </Tabla>
            </TablaWrap>
          )}
        </Card>
      )}

      {/* Vista: Uso por sector */}
      {vista === 'sector' && (
        <Card className="mt-6">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Uso por sector</h2>
            <p className="mt-0.5 text-xs text-slate-500">Prendas enviadas acumuladas</p>
          </div>
          {cargando && remitos == null ? (
            <Cargando />
          ) : usoPorSector.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">Sin envíos registrados.</p>
          ) : (
            <TablaWrap>
              <Tabla>
                <Thead>
                  <Th>Sector</Th>
                  <Th num>Remitos</Th>
                  <Th num>Prendas enviadas</Th>
                </Thead>
                <tbody>
                  {usoPorSector.map((r) => (
                    <Fila key={r.sector}>
                      <Td className="font-medium text-slate-700">{r.sector}</Td>
                      <Td num>{formatNum(r.remitos)}</Td>
                      <Td num className="font-medium text-slate-800">{formatNum(r.prendas)}</Td>
                    </Fila>
                  ))}
                  <tr className="border-t-2 border-slate-200 font-semibold">
                    <Td className="font-semibold text-slate-700">Total</Td>
                    <Td num className="font-semibold text-slate-800">{formatNum(totalUso.remitos)}</Td>
                    <Td num className="font-semibold text-slate-800">{formatNum(totalUso.prendas)}</Td>
                  </tr>
                </tbody>
              </Tabla>
            </TablaWrap>
          )}
        </Card>
      )}
    </div>
  )
}
