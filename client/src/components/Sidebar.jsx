import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { get } from '../api.js'
import Badge from './Badge.jsx'
import { useAuth } from '../context/AuthContext.jsx'

// Íconos SVG inline propios (sin librerías externas).
const sv = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[18px] w-[18px]">
    {p}
  </svg>
)
const iconos = {
  dashboard: sv(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>),
  reposicion: sv(<><path d="M21 12a9 9 0 1 1-3-6.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 4v4h-4" strokeLinecap="round" strokeLinejoin="round" /></>),
  envios: sv(<><path d="M3 7l9-4 9 4-9 4-9-4Z" strokeLinejoin="round" /><path d="M3 7v10l9 4 9-4V7" strokeLinejoin="round" /><path d="M12 11v10" /></>),
  retornos: sv(<><path d="M9 14 4 9l5-5" strokeLinecap="round" strokeLinejoin="round" /><path d="M4 9h11a5 5 0 0 1 5 5v1" strokeLinecap="round" strokeLinejoin="round" /></>),
  reproceso: sv(<><path d="M21 2v6h-6" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 22v-6h6" strokeLinecap="round" strokeLinejoin="round" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" strokeLinecap="round" strokeLinejoin="round" /></>),
  bajas: sv(<><path d="M3 6h18" strokeLinecap="round" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" strokeLinecap="round" strokeLinejoin="round" /><path d="M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14" strokeLinejoin="round" /><path d="M10 11v5M14 11v5" strokeLinecap="round" /></>),
  stock: sv(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>),
  mermas: sv(<><path d="M3 3v18h18" strokeLinecap="round" /><path d="M7 14l3-4 3 3 4-6" strokeLinecap="round" strokeLinejoin="round" /></>),
  reportes: sv(<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" /></>),
  sectores: sv(<><path d="M3 21h18M5 21V7l7-4 7 4v14" strokeLinejoin="round" /><path d="M9 21v-5h6v5" /></>),
  prendas: sv(<><path d="M7 4l5 3 5-3 3 4-3 2v10H7V10L4 8l3-4Z" strokeLinejoin="round" /></>),
  transportistas: sv(<><rect x="1" y="6" width="14" height="10" rx="1" /><path d="M15 9h4l3 3v4h-7" strokeLinejoin="round" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>),
  inventario: sv(<><path d="M9 3h6a1 1 0 0 1 1 1v2H8V4a1 1 0 0 1 1-1Z" strokeLinejoin="round" /><rect x="4" y="6" width="16" height="15" rx="2" /><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" /></>),
  presets: sv(<><rect x="3" y="4" width="18" height="4" rx="1" /><rect x="3" y="10" width="18" height="4" rx="1" /><rect x="3" y="16" width="18" height="4" rx="1" /></>),
  identificadas: sv(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 9v6M10 9v6M13 9v6M17 9v6" strokeLinecap="round" /></>),
  ajustes: sv(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" strokeLinecap="round" strokeLinejoin="round" /></>),
  usuarios: sv(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" strokeLinecap="round" strokeLinejoin="round" /></>),
  salir: sv(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" /><path d="M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" /></>),
}

function Logo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-teal-600" fill="currentColor">
      <path d="M12 2.5c-.35 0-.68.18-.86.48C9.9 5.1 5.5 10.2 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10.2 14.1 5.1 12.86 2.98A1 1 0 0 0 12 2.5Zm-2.2 12.2a.9.9 0 0 1 .9.9 1.4 1.4 0 0 0 1.4 1.4.9.9 0 0 1 0 1.8 3.2 3.2 0 0 1-3.2-3.2.9.9 0 0 1 .9-.9Z" />
    </svg>
  )
}

// Estructura de navegación por grupos operativos (estilo linen management).
const grupos = [
  {
    titulo: 'Operación',
    items: [
      { to: '/dashboard', label: 'Panel general', icono: iconos.dashboard },
      { to: '/reposicion', label: 'Reposición del día', icono: iconos.reposicion },
      { to: '/remitos', label: 'Envíos a lavandería', icono: iconos.envios, end: true },
      { to: '/retornos', label: 'Retornos y conciliación', icono: iconos.retornos, badge: 'pendientes' },
      { to: '/reproceso', label: 'Reproceso', icono: iconos.reproceso },
    ],
  },
  {
    titulo: 'Control',
    items: [
      { to: '/stock', label: 'Stock por sector', icono: iconos.stock },
      { to: '/mermas', label: 'Mermas y calidad', icono: iconos.mermas },
      { to: '/bajas', label: 'Bajas de prendas', icono: iconos.bajas },
      { to: '/inventario', label: 'Inventario cíclico', icono: iconos.inventario },
      { to: '/prendas-identificadas', label: 'Prendas identificadas', icono: iconos.identificadas },
      { to: '/reportes', label: 'Reportes', icono: iconos.reportes },
    ],
  },
  {
    titulo: 'Maestros',
    items: [
      { to: '/sectores', label: 'Sectores', icono: iconos.sectores },
      { to: '/tipos-prenda', label: 'Tipos de prenda', icono: iconos.prendas },
      { to: '/presets', label: 'Presets de carga', icono: iconos.presets },
      { label: 'Transportistas', icono: iconos.transportistas, disabled: 'Fase 1' },
    ],
  },
  {
    titulo: 'Sistema',
    items: [
      { to: '/usuarios', label: 'Usuarios', icono: iconos.usuarios, rol: 'ADMIN' },
      { to: '/ajustes', label: 'Ajustes', icono: iconos.ajustes, rol: 'ADMIN' },
    ],
  },
]

const claseLink = ({ isActive }) =>
  `group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
  }`

export default function Sidebar() {
  const { usuario, logout, rolAlMenos } = useAuth()
  const [pendientes, setPendientes] = useState(0)

  // Gating por rol (UX): ocultamos ítems y grupos que el rol no puede usar.
  // La seguridad real la valida el servidor; esto sólo evita fricción.
  const gruposVisibles = grupos
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.rol || rolAlMenos(it.rol)) }))
    .filter((g) => g.items.length > 0)

  // Contador de envíos ENVIADO sin retorno (badge en "Retornos").
  useEffect(() => {
    let vivo = true
    const cargar = () =>
      get('/remitos?estado=ENVIADO')
        .then((r) => vivo && setPendientes(Array.isArray(r) ? r.length : 0))
        .catch(() => {})
    cargar()
    const t = setInterval(cargar, 30000)
    return () => { vivo = false; clearInterval(t) }
  }, [])

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
        <Logo />
        <div>
          <p className="text-lg font-semibold leading-none text-slate-800">LavaTrack</p>
          <p className="mt-0.5 text-[11px] leading-tight text-slate-400">Gestión de Ropa Hospitalaria</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {gruposVisibles.map((g) => (
          <div key={g.titulo} className="mb-3">
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {g.titulo}
            </p>
            <div className="space-y-0.5">
              {g.items.map((it) => {
                if (it.disabled) {
                  return (
                    <div
                      key={it.label}
                      title={it.disabled}
                      className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-300"
                    >
                      {it.icono}
                      <span>{it.label}</span>
                      <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-400">
                        {it.disabled}
                      </span>
                    </div>
                  )
                }
                return (
                  <NavLink key={it.to} to={it.to} end={it.end} className={claseLink}>
                    {it.icono}
                    <span className="flex-1">{it.label}</span>
                    {it.badge === 'pendientes' && pendientes > 0 && (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-700">
                        {pendientes}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-100 px-3 py-3">
        {usuario && (
          <div className="mb-2 flex items-center gap-2 px-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-700">{usuario.nombre}</p>
              <div className="mt-0.5">
                <Badge rol={usuario.rol} />
              </div>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
        >
          {iconos.salir}
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}
