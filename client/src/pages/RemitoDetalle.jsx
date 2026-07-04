import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { get, post } from '../api.js'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import { PageHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { formatARS, formatFecha, formatKg } from '../utils/format.js'
import { useConexion } from '../context/ConexionContext.jsx'

const claseInput =
  'w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-right text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'

// Convierte a entero >= 0 (vacío = 0).
const num = (v) => {
  const n = parseInt(v, 10)
  return Number.isNaN(n) || n < 0 ? 0 : n
}

// Fila de dato de cabecera.
function Dato({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-slate-700">{children}</p>
    </div>
  )
}

// Línea de retorno vacía (cantidades recibidas + desglose por calidad).
function lineaRetornoInicial(cantidad) {
  return { cantidad: cantidad, relavado: 0, costura: 0, descarte: 0 }
}

export default function RemitoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { online } = useConexion()
  const [remito, setRemito] = useState(null)
  const [error, setError] = useState('')

  // Estado del formulario de retorno: mapa tipo_prenda_id -> { cantidad, relavado, costura, descarte }.
  const [mostrarRetorno, setMostrarRetorno] = useState(false)
  const [lineasRetorno, setLineasRetorno] = useState({})
  const [firmanteRetorno, setFirmanteRetorno] = useState('')
  const [errorRetorno, setErrorRetorno] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(() => {
    setError('')
    get(`/remitos/${id}`)
      .then(setRemito)
      .catch((e) => setError(e.message))
  }, [id])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Precargar el formulario de retorno con las líneas del envío (cantidad recibida = enviada, desglose 0).
  const abrirRetorno = () => {
    const init = {}
    ;(remito.items || []).forEach((it) => {
      init[it.tipo_prenda_id] = lineaRetornoInicial(it.cantidad)
    })
    setLineasRetorno(init)
    setFirmanteRetorno('')
    setErrorRetorno('')
    setMostrarRetorno(true)
  }

  const setCampoLinea = (tipoId, campo, valor) =>
    setLineasRetorno((prev) => ({
      ...prev,
      [tipoId]: { ...prev[tipoId], [campo]: valor },
    }))

  // Envía el RETORNO. Reintenta con confirmar:true si el backend rechaza por cantidad mayor.
  const enviarRetorno = async (confirmar = false) => {
    setErrorRetorno('')

    // Validación en cliente: relavado + costura + descarte no puede superar la cantidad recibida.
    for (const it of remito.items || []) {
      const l = lineasRetorno[it.tipo_prenda_id] || {}
      const cantidad = num(l.cantidad)
      const suma = num(l.relavado) + num(l.costura) + num(l.descarte)
      if (suma > cantidad) {
        setErrorRetorno(
          `En "${it.tipo_prenda}", el desglose (relavado + costura + descarte) supera la cantidad recibida.`
        )
        return
      }
    }

    const items = (remito.items || []).map((it) => {
      const l = lineasRetorno[it.tipo_prenda_id] || {}
      return {
        tipo_prenda_id: it.tipo_prenda_id,
        cantidad: num(l.cantidad),
        cantidad_contaminada: 0,
        cantidad_relavado: num(l.relavado),
        cantidad_costura: num(l.costura),
        cantidad_descarte: num(l.descarte),
      }
    })
    const body = {
      tipo: 'RETORNO',
      sector_id: remito.sector_id,
      fecha: new Date().toISOString().slice(0, 10),
      firmante: firmanteRetorno,
      observaciones: '',
      remito_envio_id: remito.id,
      items,
    }
    if (confirmar) body.confirmar = true

    setGuardando(true)
    try {
      await post('/remitos', body)
      setMostrarRetorno(false)
      cargar()
    } catch (err) {
      // Si el backend rechaza por cantidad recibida > enviada, pedir confirmación y reintentar.
      if (err.status === 400 && !confirmar) {
        const ok = window.confirm(
          `${err.message}\n\n¿Querés registrar el retorno de todas formas?`
        )
        if (ok) {
          setGuardando(false)
          return enviarRetorno(true)
        }
      } else {
        setErrorRetorno(err.message)
      }
    } finally {
      setGuardando(false)
    }
  }

  if (error) return <ErrorMsg mensaje={error} />
  if (!remito) return <Cargando />

  const esEnvio = remito.tipo === 'ENVIO'
  const conciliacion = remito.conciliacion
  const sinRetorno = esEnvio && !remito.retorno
  const categorias = conciliacion?.categorias

  return (
    <div>
      <PageHeader
        titulo={remito.numero}
        descripcion={esEnvio ? 'Remito de envío' : 'Remito de retorno'}
        accion={
          <Link to="/remitos" className="text-sm font-medium text-teal-700 hover:underline">
            ← Volver
          </Link>
        }
      />

      {/* Cabecera */}
      <Card className="mb-6 p-5">
        <div className="mb-4 flex items-center gap-3">
          <Badge estado={remito.estado} />
          <span className="text-xs font-medium text-slate-400">
            {esEnvio ? 'Envío' : 'Retorno'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Dato label="Sector">{remito.sector}</Dato>
          <Dato label="Fecha">{formatFecha(remito.fecha)}</Dato>
          <Dato label="Firmante">{remito.firmante || '—'}</Dato>
          <Dato label="Peso total">
            {remito.peso_total_kg != null ? formatKg(remito.peso_total_kg) : '—'}
          </Dato>
        </div>
        {remito.observaciones && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <Dato label="Observaciones">{remito.observaciones}</Dato>
          </div>
        )}
      </Card>

      {/* Items */}
      <Card className="mb-6">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800">Detalle de prendas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200">
                <th className="px-5 py-3">Tipo de prenda</th>
                <th className="px-5 py-3 text-right">Cantidad</th>
                <th className="px-5 py-3 text-right">Contaminadas</th>
                <th className="px-5 py-3 text-right">Peso prom.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(remito.items || []).map((it) => (
                <tr key={it.id ?? it.tipo_prenda_id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 text-slate-700">{it.tipo_prenda}</td>
                  <td className="px-5 py-3 text-right text-slate-700">{it.cantidad}</td>
                  <td className="px-5 py-3 text-right text-slate-600">
                    {it.cantidad_contaminada ?? 0}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-500">
                    {it.peso_promedio_gr != null ? `${it.peso_promedio_gr} g` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Registrar retorno (solo ENVIO sin retorno) */}
      {sinRetorno && !mostrarRetorno && (
        <div className="mb-6">
          <button
            onClick={abrirRetorno}
            className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
          >
            Registrar retorno
          </button>
        </div>
      )}

      {sinRetorno && mostrarRetorno && (
        <Card className="mb-6">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Registrar retorno</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Ingresá lo recibido de la lavandería y clasificá por calidad. La cantidad{' '}
              <span className="font-medium text-emerald-700">apta</span> es lo recibido menos
              relavado, costura y descarte.
            </p>
          </div>
          <div className="p-5">
            {errorRetorno && (
              <div className="mb-4">
                <ErrorMsg mensaje={errorRetorno} />
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-3">Tipo de prenda</th>
                    <th className="py-2 px-3 text-right">Enviada</th>
                    <th className="py-2 px-3 text-right">Recibida</th>
                    <th className="py-2 px-3 text-right">Relavado</th>
                    <th className="py-2 px-3 text-right">Costura</th>
                    <th className="py-2 px-3 text-right">Descarte</th>
                    <th className="py-2 pl-3 text-right">Apta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(remito.items || []).map((it) => {
                    const l = lineasRetorno[it.tipo_prenda_id] || lineaRetornoInicial(0)
                    const apta = num(l.cantidad) - num(l.relavado) - num(l.costura) - num(l.descarte)
                    const invalida = apta < 0
                    return (
                      <tr key={it.tipo_prenda_id}>
                        <td className="py-2.5 pr-3 text-slate-700">{it.tipo_prenda}</td>
                        <td className="py-2.5 px-3 text-right text-slate-500">{it.cantidad}</td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={l.cantidad}
                            onChange={(e) =>
                              setCampoLinea(it.tipo_prenda_id, 'cantidad', e.target.value)
                            }
                            className={claseInput}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={l.relavado}
                            onChange={(e) =>
                              setCampoLinea(it.tipo_prenda_id, 'relavado', e.target.value)
                            }
                            className={claseInput}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={l.costura}
                            onChange={(e) =>
                              setCampoLinea(it.tipo_prenda_id, 'costura', e.target.value)
                            }
                            className={claseInput}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            value={l.descarte}
                            onChange={(e) =>
                              setCampoLinea(it.tipo_prenda_id, 'descarte', e.target.value)
                            }
                            className={claseInput}
                          />
                        </td>
                        <td
                          className={`py-2.5 pl-3 text-right font-semibold ${
                            invalida ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {apta}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-5 max-w-xs">
              <label className="mb-1 block text-xs font-medium text-slate-500">Firmante</label>
              <input
                type="text"
                value={firmanteRetorno}
                onChange={(e) => setFirmanteRetorno(e.target.value)}
                placeholder="Nombre y apellido"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setMostrarRetorno(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => enviarRetorno(false)}
                disabled={guardando || !online}
                title={!online ? 'Sin conexión con el servidor' : undefined}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
              >
                {guardando ? 'Guardando…' : 'Confirmar retorno'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Link al retorno si ya existe */}
      {esEnvio && remito.retorno && (
        <Card className="mb-6 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Retorno vinculado</p>
              <p className="text-xs text-slate-500">
                {remito.retorno.numero} · {formatFecha(remito.retorno.fecha)} ·{' '}
                {remito.retorno.firmante || '—'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge estado={remito.retorno.estado} />
              {remito.retorno.id != null && (
                <Link
                  to={`/remitos/${remito.retorno.id}`}
                  className="text-sm font-medium text-teal-700 hover:underline"
                >
                  Ver retorno →
                </Link>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Conciliación */}
      {conciliacion && (
        <Card className="mb-6">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Conciliación</h2>
            <Badge estado={conciliacion.estado} />
          </div>

          {/* Mini-resumen de categorías de calidad */}
          {categorias && (
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-[11px] font-medium text-emerald-700">Apta</p>
                  <p className="text-lg font-semibold text-emerald-700">{categorias.apta ?? 0}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-[11px] font-medium text-amber-700">Relavado</p>
                  <p className="text-lg font-semibold text-amber-700">{categorias.relavado ?? 0}</p>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                  <p className="text-[11px] font-medium text-sky-700">Costura</p>
                  <p className="text-lg font-semibold text-sky-700">{categorias.costura ?? 0}</p>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                  <p className="text-[11px] font-medium text-rose-700">Descarte</p>
                  <p className="text-lg font-semibold text-rose-700">{categorias.descarte ?? 0}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                El <span className="font-medium text-rose-700">descarte</span> generó una baja
                automática (fin de vida útil). Lo clasificado como{' '}
                <span className="font-medium text-amber-700">relavado</span> y{' '}
                <span className="font-medium text-sky-700">costura</span> sigue en la lavandería.
              </p>
            </div>
          )}

          {conciliacion.estado === 'CON_DIFERENCIA' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200">
                    <th className="px-5 py-3">Tipo de prenda</th>
                    <th className="px-5 py-3 text-right">Enviado</th>
                    <th className="px-5 py-3 text-right">Recibido</th>
                    <th className="px-5 py-3 text-right">Faltante</th>
                    <th className="px-5 py-3 text-right">Costo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(conciliacion.diferencias || []).map((d, i) => (
                    <tr key={i} className="bg-rose-50/60">
                      <td className="px-5 py-3 font-medium text-slate-700">{d.tipo_prenda}</td>
                      <td className="px-5 py-3 text-right text-slate-600">{d.enviado}</td>
                      <td className="px-5 py-3 text-right text-slate-600">{d.recibido}</td>
                      <td className="px-5 py-3 text-right font-semibold text-rose-700">
                        {d.faltante}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-rose-700">
                        {formatARS(d.costo_ars)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200">
                    <td className="px-5 py-3 text-sm font-semibold text-slate-700" colSpan={4}>
                      Costo total de la merma
                    </td>
                    <td className="px-5 py-3 text-right text-base font-bold text-rose-700">
                      {formatARS(conciliacion.costo_total_ars)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-5 py-6 text-sm text-emerald-700">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Todas las prendas fueron devueltas. Sin diferencias.
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
