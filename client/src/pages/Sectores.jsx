import { useEffect, useState } from 'react'
import { get } from '../api.js'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import { TablaWrap, Tabla, Thead, Th, Td, Fila } from '../components/tabla.jsx'
import { ModuleHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { formatNum } from '../utils/format.js'

export default function Sectores() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    get('/sectores')
      .then((d) => setData(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <ErrorMsg mensaje={error} />
  if (!data) return <Cargando />

  return (
    <div>
      <ModuleHeader
        titulo="Sectores"
        descripcion="Sectores del hospital y su método de reposición"
        breadcrumb={['Maestros', 'Sectores']}
      />

      <Card>
        {data.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">No hay sectores cargados.</p>
        ) : (
          <TablaWrap>
            <Tabla>
              <Thead>
                <Th>Nombre</Th>
                <Th>Método de reposición</Th>
                <Th num>Tipos con mínimo</Th>
              </Thead>
              <tbody>
                {data.map((s) => (
                  <Fila key={s.id}>
                    <Td className="font-medium text-slate-700">{s.nombre}</Td>
                    <Td>
                      {s.metodo_reposicion ? (
                        <Badge metodo={s.metodo_reposicion} />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </Td>
                    <Td num>{formatNum(Object.keys(s.stock_minimo || {}).length)}</Td>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
          </TablaWrap>
        )}
      </Card>
    </div>
  )
}
