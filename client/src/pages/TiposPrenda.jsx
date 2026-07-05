import { useEffect, useState } from 'react'
import { get } from '../api.js'
import Card from '../components/Card.jsx'
import { TablaWrap, Tabla, Thead, Th, Td, Fila } from '../components/tabla.jsx'
import { ModuleHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { formatARS, formatNum } from '../utils/format.js'

export default function TiposPrenda() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    get('/tipos-prenda')
      .then((d) => setData(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <ErrorMsg mensaje={error} />
  if (!data) return <Cargando />

  return (
    <div>
      <ModuleHeader
        titulo="Tipos de prenda"
        descripcion="Catálogo de prendas con peso, vida útil y costo de reposición"
        breadcrumb={['Maestros', 'Tipos de prenda']}
      />

      <Card>
        {data.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400">No hay tipos de prenda cargados.</p>
        ) : (
          <TablaWrap>
            <Tabla>
              <Thead>
                <Th>Nombre</Th>
                <Th num>Peso prom.</Th>
                <Th num>Vida útil</Th>
                <Th num>Costo reposición</Th>
              </Thead>
              <tbody>
                {data.map((t) => (
                  <Fila key={t.id}>
                    <Td className="font-medium text-slate-700">{t.nombre}</Td>
                    <Td num>{`${formatNum(t.peso_promedio_gr ?? 0)} g`}</Td>
                    <Td num>{`${formatNum(t.vida_util_ciclos ?? 0)} ciclos`}</Td>
                    <Td num>{formatARS(t.costo_reposicion_ars ?? 0)}</Td>
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
