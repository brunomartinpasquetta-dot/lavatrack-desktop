// Badge unificado: estados de remito, semáforo de stock, métodos de reposición y
// genéricos por tono. Un solo componente para toda la app (evita colores sueltos).

const ESTILOS_ESTADO = {
  BORRADOR: 'bg-slate-100 text-slate-700',
  ENVIADO: 'bg-teal-100 text-teal-700',
  RECIBIDO: 'bg-sky-100 text-sky-700',
  CONCILIADO: 'bg-emerald-100 text-emerald-700',
  CON_DIFERENCIA: 'bg-rose-100 text-rose-700',
}
const ETIQUETAS_ESTADO = {
  BORRADOR: 'Borrador',
  ENVIADO: 'Enviado',
  RECIBIDO: 'Recibido',
  CONCILIADO: 'Conciliado',
  CON_DIFERENCIA: 'Con diferencia',
}

// Semáforo de stock (ok / bajo / critico).
const ESTILOS_NIVEL = {
  ok: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  bajo: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  critico: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
}
const PUNTO_NIVEL = { ok: 'bg-emerald-500', bajo: 'bg-amber-500', critico: 'bg-rose-500' }
const ETIQUETA_NIVEL = { ok: 'OK', bajo: 'Bajo', critico: 'Crítico' }

// Método de reposición del sector.
const ESTILOS_METODO = {
  PAR: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
  CARRO_INTERCAMBIO: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  PEDIDO: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
}
const ETIQUETA_METODO = { PAR: 'Par', CARRO_INTERCAMBIO: 'Carro', PEDIDO: 'Pedido' }

// Roles de usuario.
const ESTILOS_ROL = {
  ADMIN: 'bg-indigo-100 text-indigo-700',
  SUPERVISOR: 'bg-sky-100 text-sky-700',
  OPERARIO: 'bg-slate-100 text-slate-600',
}
const ETIQUETA_ROL = { ADMIN: 'Admin', SUPERVISOR: 'Supervisor', OPERARIO: 'Operario' }

// Tonos genéricos para conteos / aging.
const ESTILOS_TONO = {
  slate: 'bg-slate-100 text-slate-600',
  teal: 'bg-teal-100 text-teal-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  rose: 'bg-rose-100 text-rose-700',
  sky: 'bg-sky-100 text-sky-700',
}

const BASE = 'inline-flex items-center gap-1.5 rounded-full text-xs font-medium whitespace-nowrap'

export default function Badge({ estado, nivel, metodo, rol, tono, children, className = '' }) {
  let clase = ESTILOS_TONO.slate
  let texto = children
  let dot = null

  if (estado != null) {
    clase = ESTILOS_ESTADO[estado] || ESTILOS_TONO.slate
    texto = texto ?? (ETIQUETAS_ESTADO[estado] || estado)
  } else if (nivel != null) {
    clase = ESTILOS_NIVEL[nivel] || ESTILOS_NIVEL.ok
    texto = texto ?? (ETIQUETA_NIVEL[nivel] || nivel)
    dot = <span className={`h-1.5 w-1.5 rounded-full ${PUNTO_NIVEL[nivel] || PUNTO_NIVEL.ok}`} />
  } else if (metodo != null) {
    clase = ESTILOS_METODO[metodo] || ESTILOS_TONO.slate
    texto = texto ?? (ETIQUETA_METODO[metodo] || metodo)
  } else if (rol != null) {
    clase = ESTILOS_ROL[rol] || ESTILOS_TONO.slate
    texto = texto ?? (ETIQUETA_ROL[rol] || rol)
  } else if (tono != null) {
    clase = ESTILOS_TONO[tono] || ESTILOS_TONO.slate
  }

  return (
    <span className={`${BASE} px-2.5 py-0.5 ${clase} ${className}`}>
      {dot}
      {texto}
    </span>
  )
}

// Export auxiliar para leyendas del semáforo.
export const NIVEL_META = { PUNTO_NIVEL, ETIQUETA_NIVEL }
