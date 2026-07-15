import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { get, qs } from '../api.js'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import { TablaWrap, Tabla, Thead, Th, Td, Fila } from '../components/tabla.jsx'
import { ModuleHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { formatFecha, formatKg, formatNum } from '../utils/format.js'

const FILTROS_VACIOS = { estado: '', sector_id: '', desde: '', hasta: '' }

const ESTADOS = [
  { value: '', label: 'Todos los estados' },
  { value: 'BORRADOR', label: 'Borrador' },
  { value: 'ENVIADO', label: 'Enviado' },
  { value: 'RECIBIDO', label: 'Recibido' },
  { value: 'CONCILIADO', label: 'Conciliado' },
  { value: 'CON_DIFERENCIA', label: 'Con diferencia' },
]

// Estilo compacto para los controles de la barra de filtros.
const claseControl =
  'rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'

const LIMITE = 20

export default function Remitos() {
  const navigate = useNavigate()
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [sectores, setSectores] = useState([])
  const [remitos, setRemitos] = useState([])
  const [pagina, setPagina] = useState(1)
  // total: cantidad total de remitos según el backend paginado (null = desconocido,
  // p. ej. si el server todavía devolviera un array plano).
  const [total, setTotal] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // Cargar sectores para el filtro (una vez).
  useEffect(() => {
    get('/sectores')
      .then((s) => setSectores(s || []))
      .catch(() => setSectores([]))
  }, [])

  // Al cambiar los filtros, volvemos a la primera página.
  useEffect(() => {
    setPagina(1)
  }, [filtros])

  // Refetch al cambiar filtros o página (query params + paginación).
  useEffect(() => {
    setCargando(true)
    setError('')
    get(`/remitos${qs({ ...filtros, page: pagina, limit: LIMITE })}`)
      .then((resp) => {
        // Defensivo: contemplamos tanto la respuesta paginada {items,total,...}
        // como un array plano (por si el backend aún no paginara).
        if (Array.isArray(resp)) {
          setRemitos(resp)
          setTotal(null)
        } else {
          setRemitos(resp?.items || [])
          setTotal(typeof resp?.total === 'number' ? resp.total : null)
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [filtros, pagina])

  const set = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }))
  const hayFiltros =
    filtros.estado || filtros.sector_id || filtros.desde || filtros.hasta

  // Índices para el indicador "X-Y de N". offset base-0 según la página actual.
  const offset = (pagina - 1) * LIMITE
  const desde = remitos.length ? offset + 1 : 0
  const hasta = offset + remitos.length
  // Hay página siguiente si conocemos el total y quedan filas, o si (sin total)
  // la página vino llena (heurística defensiva ante un array plano).
  const haySiguiente = total != null ? hasta < total : remitos.length === LIMITE
  const hayAnterior = pagina > 1

  return (
    <div>
      <ModuleHeader
        titulo="Envíos a lavandería"
        breadcrumb={['Operación', 'Envíos a lavandería']}
        accion={
          <Link
            to="/remitos/nuevo"
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
          >
            + Nuevo envío
          </Link>
        }
      />

      {/* Barra de filtros compacta */}
      <Card className="mb-4 px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="mb-1 text-xs font-medium text-slate-500">Estado</label>
            <select value={filtros.estado} onChange={set('estado')} className={claseControl}>
              {ESTADOS.map((e) => (
                <option key={e.value} value={e.value}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-xs font-medium text-slate-500">Sector</label>
            <select value={filtros.sector_id} onChange={set('sector_id')} className={claseControl}>
              <option value="">Todos los sectores</option>
              {sectores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-xs font-medium text-slate-500">Desde</label>
            <input type="date" value={filtros.desde} onChange={set('desde')} className={claseControl} />
          </div>

          <div className="flex flex-col">
            <label className="mb-1 text-xs font-medium text-slate-500">Hasta</label>
            <input type="date" value={filtros.hasta} onChange={set('hasta')} className={claseControl} />
          </div>

          <button
            onClick={() => setFiltros(FILTROS_VACIOS)}
            disabled={!hayFiltros}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            Limpiar
          </button>
        </div>
      </Card>

      {error && (
        <div className="mb-4">
          <ErrorMsg mensaje={error} />
        </div>
      )}

      <Card>
        {cargando ? (
          <Cargando />
        ) : (
          <>
            <div className="border-b border-slate-100 px-4 py-3 text-xs font-medium text-slate-500">
              {total != null
                ? `${desde}-${hasta} de ${total} remito${total === 1 ? '' : 's'}`
                : `${remitos.length} remito${remitos.length === 1 ? '' : 's'}`}
            </div>
            {remitos.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-slate-400">
                No hay remitos que coincidan con los filtros.
              </div>
            ) : (
              <TablaWrap>
                <Tabla>
                  <Thead>
                    <Th>Número</Th>
                    <Th>Tipo</Th>
                    <Th>Sector</Th>
                    <Th>Fecha</Th>
                    <Th num>Prendas</Th>
                    <Th num>Peso</Th>
                    <Th>Estado</Th>
                  </Thead>
                  <tbody>
                    {remitos.map((r) => (
                      <Fila key={r.id} onClick={() => navigate(`/remitos/${r.id}`)}>
                        <Td className="font-medium text-slate-800">{r.numero}</Td>
                        <Td className="text-slate-500">{r.tipo === 'ENVIO' ? 'Envío' : 'Retorno'}</Td>
                        <Td>{r.sector}</Td>
                        <Td className="text-slate-500">{formatFecha(r.fecha)}</Td>
                        <Td num>{formatNum(r.total_prendas)}</Td>
                        <Td num className="text-slate-500">
                          {r.peso_total_kg != null ? formatKg(r.peso_total_kg) : '—'}
                        </Td>
                        <Td>
                          <Badge estado={r.estado} />
                        </Td>
                      </Fila>
                    ))}
                  </tbody>
                </Tabla>
              </TablaWrap>
            )}

            {/* Controles de paginación (AUD-012) */}
            {(hayAnterior || haySiguiente) && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                <button
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={!hayAnterior}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="text-xs font-medium text-slate-500">
                  {total != null ? `Página ${pagina} de ${Math.max(1, Math.ceil(total / LIMITE))}` : `Página ${pagina}`}
                </span>
                <button
                  onClick={() => setPagina((p) => p + 1)}
                  disabled={!haySiguiente}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
