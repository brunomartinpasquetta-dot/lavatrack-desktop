import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { get, post } from '../api.js'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import CodigosInput from '../components/CodigosInput.jsx'
import { TablaWrap, Tabla, Thead, Th, Td, Fila } from '../components/tabla.jsx'
import { ModuleHeader, Cargando, ErrorMsg } from '../components/ui.jsx'
import { formatARS, formatFecha, formatKg, formatNum } from '../utils/format.js'
import { useConexion } from '../context/ConexionContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { leerFirmante, guardarFirmante } from '../utils/firmante.js'

const claseInput =
  'w-20 min-h-[44px] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-right tabular-nums text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'
const claseInputInvalido =
  'w-20 min-h-[44px] rounded-lg border border-rose-400 bg-rose-50 px-2.5 py-1.5 text-sm text-right tabular-nums text-rose-700 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500'

// Convierte a entero >= 0 (vacío = 0).
const num = (v) => {
  const n = parseInt(v, 10)
  return Number.isNaN(n) || n < 0 ? 0 : n
}

// Dato de cabecera.
function Dato({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm text-slate-700">{children}</p>
    </div>
  )
}

// Línea de retorno inicial (cantidad recibida = enviada, desglose 0).
function lineaRetornoInicial(cantidad) {
  return { cantidad: cantidad, relavado: 0, costura: 0, descarte: 0, codigos: [] }
}

export default function RemitoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { online } = useConexion()
  const toast = useToast()
  const [remito, setRemito] = useState(null)
  const [error, setError] = useState('')

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

  // Precargar el formulario de retorno con las líneas del envío.
  const abrirRetorno = () => {
    const init = {}
    ;(remito.items || []).forEach((it) => {
      const base = lineaRetornoInicial(it.cantidad)
      // Si el envío llevó códigos, los precargamos en el retorno (editables).
      if (Array.isArray(it.codigos) && it.codigos.length) base.codigos = [...it.codigos]
      init[it.tipo_prenda_id] = base
    })
    setLineasRetorno(init)
    // Precargamos el último firmante usado (AUD-005). Sigue siendo editable.
    setFirmanteRetorno(leerFirmante())
    setErrorRetorno('')
    setMostrarRetorno(true)
  }

  const setCampoLinea = (tipoId, campo, valor) =>
    setLineasRetorno((prev) => ({
      ...prev,
      [tipoId]: { ...prev[tipoId], [campo]: valor },
    }))

  // ¿Alguna línea tiene el desglose por encima de lo recibido?
  const hayInvalida = useMemo(() => {
    if (!remito || !mostrarRetorno) return false
    return (remito.items || []).some((it) => {
      const l = lineasRetorno[it.tipo_prenda_id] || {}
      const suma = num(l.relavado) + num(l.costura) + num(l.descarte)
      return suma > num(l.cantidad) || (l.codigos || []).length > num(l.cantidad)
    })
  }, [remito, mostrarRetorno, lineasRetorno])

  // Envía el RETORNO. Reintenta con confirmar:true si el backend rechaza por cantidad mayor.
  const enviarRetorno = async (confirmar = false) => {
    setErrorRetorno('')

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
      if ((l.codigos || []).length > cantidad) {
        setErrorRetorno(
          `En "${it.tipo_prenda}", hay más códigos (${l.codigos.length}) que la cantidad recibida (${cantidad}).`
        )
        return
      }
    }

    const items = (remito.items || []).map((it) => {
      const l = lineasRetorno[it.tipo_prenda_id] || {}
      const item = {
        tipo_prenda_id: it.tipo_prenda_id,
        cantidad: num(l.cantidad),
        cantidad_contaminada: 0,
        cantidad_relavado: num(l.relavado),
        cantidad_costura: num(l.costura),
        cantidad_descarte: num(l.descarte),
      }
      if ((l.codigos || []).length) item.codigos = l.codigos
      return item
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
      const creado = await post('/remitos', body)
      guardarFirmante(firmanteRetorno)
      toast.exito(creado?.numero ? `Retorno ${creado.numero} registrado` : 'Retorno registrado')
      setMostrarRetorno(false)
      cargar()
    } catch (err) {
      // El backend responde 400 con un mensaje claro en español (p. ej. "recibiste
      // más de lo enviado"). Lo mostramos tal cual y, si el operario acepta, reenviamos.
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
        toast.error(err.message)
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
      <ModuleHeader
        titulo={remito.numero}
        descripcion={esEnvio ? 'Remito de envío' : 'Remito de retorno'}
        breadcrumb={['Operación', 'Envíos a lavandería', remito.numero]}
        accion={
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="min-h-[44px] rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100"
            >
              Imprimir remito
            </button>
            <button
              onClick={() => navigate('/remitos')}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              ← Volver
            </button>
          </div>
        }
      />

      {/* Cabecera del remito */}
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

      {/* Items del envío */}
      <Card className="mb-6">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-800">Detalle de prendas</h2>
        </div>
        <TablaWrap>
          <Tabla>
            <Thead>
              <Th>Tipo de prenda</Th>
              <Th num>Cantidad</Th>
              <Th num>Contaminadas</Th>
              <Th num>Peso prom.</Th>
            </Thead>
            <tbody>
              {(remito.items || []).map((it) => (
                <Fila key={it.id ?? it.tipo_prenda_id}>
                  <Td className="text-slate-700">{it.tipo_prenda}</Td>
                  <Td num>{formatNum(it.cantidad)}</Td>
                  <Td num className="text-slate-600">{formatNum(it.cantidad_contaminada ?? 0)}</Td>
                  <Td num className="text-slate-500">
                    {it.peso_promedio_gr != null ? `${it.peso_promedio_gr} g` : '—'}
                  </Td>
                </Fila>
              ))}
            </tbody>
          </Tabla>
        </TablaWrap>
      </Card>

      {/* Registrar retorno (solo ENVIO sin retorno) */}
      {sinRetorno && !mostrarRetorno && (
        <div className="mb-6">
          <button
            onClick={abrirRetorno}
            className="min-h-[44px] rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
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
              <span className="font-medium text-emerald-700">apta</span> se calcula sola: recibido
              menos relavado, costura y descarte.
            </p>
          </div>
          <div className="p-5">
            {errorRetorno && (
              <div className="mb-4">
                <ErrorMsg mensaje={errorRetorno} />
              </div>
            )}

            <TablaWrap>
              <Tabla>
                <Thead>
                  <Th>Prenda</Th>
                  <Th num>Enviado</Th>
                  <Th num>Recibido</Th>
                  <Th num>Relavado</Th>
                  <Th num>Costura</Th>
                  <Th num>Descarte</Th>
                  <Th num>Apta</Th>
                </Thead>
                <tbody>
                  {(remito.items || []).map((it) => {
                    const l = lineasRetorno[it.tipo_prenda_id] || lineaRetornoInicial(0)
                    const recibido = num(l.cantidad)
                    const apta = recibido - num(l.relavado) - num(l.costura) - num(l.descarte)
                    const invalida = apta < 0
                    const excedeEnviado = recibido > it.cantidad
                    const cls = invalida ? claseInputInvalido : claseInput
                    const codigos = l.codigos || []
                    return (
                      <Fragment key={it.tipo_prenda_id}>
                      <tr
                        className={
                          'border-t border-slate-100 ' + (invalida ? 'bg-rose-50/70' : '')
                        }
                      >
                        <Td className="text-slate-700">{it.tipo_prenda}</Td>
                        <Td num className="text-slate-500">{formatNum(it.cantidad)}</Td>
                        <Td num>
                          <input
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            min="0"
                            value={l.cantidad}
                            onChange={(e) => setCampoLinea(it.tipo_prenda_id, 'cantidad', e.target.value)}
                            className={excedeEnviado ? claseInput + ' ring-1 ring-amber-400 border-amber-400' : claseInput}
                            title={excedeEnviado ? 'Recibido supera lo enviado' : undefined}
                          />
                        </Td>
                        <Td num>
                          <input
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            min="0"
                            value={l.relavado}
                            onChange={(e) => setCampoLinea(it.tipo_prenda_id, 'relavado', e.target.value)}
                            className={cls}
                          />
                        </Td>
                        <Td num>
                          <input
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            min="0"
                            value={l.costura}
                            onChange={(e) => setCampoLinea(it.tipo_prenda_id, 'costura', e.target.value)}
                            className={cls}
                          />
                        </Td>
                        <Td num>
                          <input
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            min="0"
                            value={l.descarte}
                            onChange={(e) => setCampoLinea(it.tipo_prenda_id, 'descarte', e.target.value)}
                            className={cls}
                          />
                        </Td>
                        <Td num className={`font-semibold ${invalida ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {apta}
                        </Td>
                      </tr>
                      <tr className={invalida ? 'bg-rose-50/70' : ''}>
                        <td colSpan={7} className="px-3 pb-3 pt-0">
                          <div className="pl-1">
                            <span className="mb-1 block text-[11px] font-medium text-slate-400">
                              Códigos de {it.tipo_prenda} (opcional)
                            </span>
                            <CodigosInput
                              codigos={codigos}
                              cantidad={recibido}
                              onChange={(c) => setCampoLinea(it.tipo_prenda_id, 'codigos', c)}
                            />
                          </div>
                        </td>
                      </tr>
                      </Fragment>
                    )
                  })}
                </tbody>
              </Tabla>
            </TablaWrap>

            {hayInvalida && (
              <p className="mt-3 text-xs font-medium text-rose-600">
                Revisá las filas marcadas: relavado + costura + descarte no puede superar lo recibido.
              </p>
            )}

            <div className="mt-5 max-w-xs">
              <label className="mb-1 block text-xs font-medium text-slate-500">Firmante</label>
              <input
                type="text"
                value={firmanteRetorno}
                onChange={(e) => setFirmanteRetorno(e.target.value)}
                placeholder="Nombre y apellido"
                className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setMostrarRetorno(false)}
                className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => enviarRetorno(false)}
                disabled={guardando || !online || hayInvalida}
                title={
                  !online
                    ? 'Sin conexión con el servidor'
                    : hayInvalida
                    ? 'Corregí las filas marcadas en rojo'
                    : undefined
                }
                className="min-h-[44px] rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
              >
                {guardando ? 'Guardando…' : 'Confirmar retorno'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Retorno vinculado */}
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

          {/* Categorías de calidad */}
          {categorias && (
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-[11px] font-medium text-emerald-700">Apta</p>
                  <p className="text-lg font-semibold tabular-nums text-emerald-700">{categorias.apta ?? 0}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-[11px] font-medium text-amber-700">Relavado</p>
                  <p className="text-lg font-semibold tabular-nums text-amber-700">{categorias.relavado ?? 0}</p>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                  <p className="text-[11px] font-medium text-sky-700">Costura</p>
                  <p className="text-lg font-semibold tabular-nums text-sky-700">{categorias.costura ?? 0}</p>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                  <p className="text-[11px] font-medium text-rose-700">Descarte</p>
                  <p className="text-lg font-semibold tabular-nums text-rose-700">{categorias.descarte ?? 0}</p>
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
            <TablaWrap>
              <Tabla>
                <Thead>
                  <Th>Tipo de prenda</Th>
                  <Th num>Enviado</Th>
                  <Th num>Recibido</Th>
                  <Th num>Faltante</Th>
                  <Th num>Costo</Th>
                </Thead>
                <tbody>
                  {(conciliacion.diferencias || []).map((d, i) => (
                    <tr key={i} className="border-t border-slate-100 bg-rose-50/60">
                      <Td className="font-medium text-slate-700">{d.tipo_prenda}</Td>
                      <Td num className="text-slate-600">{formatNum(d.enviado)}</Td>
                      <Td num className="text-slate-600">{formatNum(d.recibido)}</Td>
                      <Td num className="font-semibold text-rose-700">{formatNum(d.faltante)}</Td>
                      <Td num className="font-semibold text-rose-700">{formatARS(d.costo_ars)}</Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200">
                    <td className="px-3 py-2 text-sm font-semibold text-slate-700" colSpan={4}>
                      Costo total de la merma
                    </td>
                    <td className="px-3 py-2 text-right text-base font-bold tabular-nums text-rose-700">
                      {formatARS(conciliacion.costo_total_ars)}
                    </td>
                  </tr>
                </tfoot>
              </Tabla>
            </TablaWrap>
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

      {/* Rótulo imprimible. Oculto en pantalla (.rotulo { display:none }); sólo
          aparece al imprimir, cuando @media print oculta el resto del chrome. */}
      <RotuloRemito remito={remito} esEnvio={esEnvio} />
    </div>
  )
}

// Rótulo negro sobre blanco (~A4) para acompañar el traslado físico de la ropa.
// Usa estilos inline para garantizar el contraste al imprimir (independiente de Tailwind).
function RotuloRemito({ remito, esEnvio }) {
  const items = remito.items || []
  const totalPrendas = items.reduce((s, it) => s + (Number(it.cantidad) || 0), 0)
  const totalContaminadas = items.reduce(
    (s, it) => s + (Number(it.cantidad_contaminada) || 0),
    0,
  )
  const transportista = remito.transportista

  const borde = '1px solid #000'
  const celda = { border: borde, padding: '4px 8px', textAlign: 'left' }
  const celdaNum = { border: borde, padding: '4px 8px', textAlign: 'right' }

  return (
    <div className="rotulo" style={{ color: '#000' }}>
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <div style={{ fontSize: '18px', fontWeight: 700 }}>
          LavaTrack — Remito de {esEnvio ? 'ENVÍO' : 'RETORNO'}
        </div>
        <div style={{ fontSize: '13px', marginTop: '2px' }}>
          N.º {remito.numero} · Fecha {formatFecha(remito.fecha)}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '16px',
          margin: '10px 0',
        }}
      >
        <div>
          <div style={{ fontWeight: 700 }}>Origen</div>
          <div>{esEnvio ? remito.sector : 'Lavandería'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700 }}>Destino</div>
          <div>{esEnvio ? 'Lavandería' : remito.sector}</div>
        </div>
      </div>

      <div style={{ margin: '10px 0' }}>
        <div style={{ fontWeight: 700 }}>Transportista</div>
        <div>
          {transportista
            ? `${transportista.nombre}${transportista.documento ? ` — ${transportista.documento}` : ''}`
            : '—'}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0' }}>
        <thead>
          <tr>
            <th style={celda}>Tipo de prenda</th>
            <th style={celdaNum}>Cantidad</th>
            <th style={celdaNum}>Contaminadas (bolsa roja)</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id ?? it.tipo_prenda_id}>
              <td style={celda}>{it.tipo_prenda}</td>
              <td style={celdaNum}>{formatNum(it.cantidad)}</td>
              <td style={celdaNum}>{formatNum(it.cantidad_contaminada ?? 0)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...celda, fontWeight: 700 }}>Total</td>
            <td style={{ ...celdaNum, fontWeight: 700 }}>{formatNum(totalPrendas)}</td>
            <td style={{ ...celdaNum, fontWeight: 700 }}>{formatNum(totalContaminadas)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ margin: '10px 0', fontWeight: 700 }}>
        Peso total: {remito.peso_total_kg != null ? formatKg(remito.peso_total_kg) : '—'}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '16px',
          marginTop: '40px',
        }}
      >
        {['Remitente', 'Transportista', 'Receptor'].map((rol) => (
          <div key={rol} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ borderTop: borde, paddingTop: '4px', marginTop: '24px' }}>
              {rol}
            </div>
            <div style={{ fontSize: '10px', marginTop: '2px' }}>Aclaración / fecha</div>
          </div>
        ))}
      </div>
    </div>
  )
}
