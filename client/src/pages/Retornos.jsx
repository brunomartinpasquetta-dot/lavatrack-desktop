import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { get } from '../api.js'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import { TablaWrap, Tabla, Thead, Th, Td, Fila } from '../components/tabla.jsx'
import { ModuleHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { formatFecha, formatNum, diasDesde, nivelAntiguedad } from '../utils/format.js'

export default function Retornos() {
  const navigate = useNavigate()
  const [pendientes, setPendientes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setCargando(true)
    setError('')
    get('/remitos?estado=ENVIADO')
      .then((r) => {
        // Más viejos primero (fecha ascendente = antigüedad descendente).
        const ordenados = [...(r || [])].sort(
          (a, b) => String(a.fecha).localeCompare(String(b.fecha))
        )
        setPendientes(ordenados)
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [])

  return (
    <div>
      <ModuleHeader
        titulo="Retornos y conciliación"
        descripcion="Envíos pendientes de retorno, más viejos primero"
        breadcrumb={['Operación', 'Retornos y conciliación']}
        accion={
          !cargando && (
            <Badge tono={pendientes.length ? 'amber' : 'emerald'}>
              {pendientes.length} pendiente{pendientes.length === 1 ? '' : 's'}
            </Badge>
          )
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorMsg mensaje={error} />
        </div>
      )}

      {cargando ? (
        <Cargando />
      ) : pendientes.length === 0 ? (
        <Card className="px-6 py-16 text-center">
          <p className="text-sm font-medium text-slate-600">
            No hay envíos pendientes de retorno. ✅
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Todo lo enviado a la lavandería ya fue registrado.
          </p>
        </Card>
      ) : (
        <Card>
          <TablaWrap>
            <Tabla>
              <Thead>
                <Th>Número</Th>
                <Th>Sector</Th>
                <Th>Fecha envío</Th>
                <Th>Antigüedad</Th>
                <Th num>Prendas</Th>
                <Th>Firmante</Th>
                <Th num>Acción</Th>
              </Thead>
              <tbody>
                {pendientes.map((r) => {
                  const dias = diasDesde(r.fecha)
                  return (
                    <Fila key={r.id} onClick={() => navigate(`/remitos/${r.id}`)}>
                      <Td className="font-medium text-slate-800">{r.numero}</Td>
                      <Td>{r.sector}</Td>
                      <Td className="text-slate-500">{formatFecha(r.fecha)}</Td>
                      <Td>
                        <Badge nivel={nivelAntiguedad(dias)}>
                          {dias} día{dias === 1 ? '' : 's'}
                        </Badge>
                      </Td>
                      <Td num>{formatNum(r.total_prendas)}</Td>
                      <Td className="text-slate-600">{r.firmante || '—'}</Td>
                      <Td num>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/remitos/${r.id}`)
                          }}
                          className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-teal-700"
                        >
                          Registrar retorno
                        </button>
                      </Td>
                    </Fila>
                  )
                })}
              </tbody>
            </Tabla>
          </TablaWrap>
        </Card>
      )}
    </div>
  )
}
