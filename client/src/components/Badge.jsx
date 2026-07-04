// Badge de estado de remito. Mapea cada estado a los colores del contrato.

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

export default function Badge({ estado, children, className = '' }) {
  const clase = ESTILOS_ESTADO[estado] || 'bg-slate-100 text-slate-700'
  const texto = children || ETIQUETAS_ESTADO[estado] || estado
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${clase} ${className}`}
    >
      {texto}
    </span>
  )
}
