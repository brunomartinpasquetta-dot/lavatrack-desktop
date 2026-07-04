import { NavLink } from 'react-router-dom'

// Íconos SVG inline propios (sin librerías externas).
const iconos = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  remitos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M8 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M8 11h8M8 15h5" strokeLinecap="round" />
    </svg>
  ),
  nuevo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" strokeLinecap="round" />
    </svg>
  ),
  stock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  mermas: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M3 3v18h18" strokeLinecap="round" />
      <path d="M7 14l3-4 3 3 4-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  reposicion: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M21 12a9 9 0 1 1-3-6.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 4v4h-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ajustes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <circle cx="12" cy="12" r="3" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
}

// Logo LavaTrack: gota (prenda) en teal.
function Logo() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 text-teal-600" fill="currentColor">
      <path d="M12 2.5c-.35 0-.68.18-.86.48C9.9 5.1 5.5 10.2 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10.2 14.1 5.1 12.86 2.98A1 1 0 0 0 12 2.5Zm-2.2 12.2a.9.9 0 0 1 .9.9 1.4 1.4 0 0 0 1.4 1.4.9.9 0 0 1 0 1.8 3.2 3.2 0 0 1-3.2-3.2.9.9 0 0 1 .9-.9Z" />
    </svg>
  )
}

const links = [
  { to: '/dashboard', label: 'Dashboard', icono: iconos.dashboard },
  { to: '/remitos', label: 'Remitos', icono: iconos.remitos, end: true },
  { to: '/remitos/nuevo', label: 'Nuevo envío', icono: iconos.nuevo },
  { to: '/reposicion', label: 'Reposición del día', icono: iconos.reposicion },
  { to: '/stock', label: 'Stock', icono: iconos.stock },
  { to: '/mermas', label: 'Mermas', icono: iconos.mermas },
  { to: '/ajustes', label: 'Ajustes', icono: iconos.ajustes },
]

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-100">
        <Logo />
        <div>
          <p className="text-lg font-semibold leading-none text-slate-800">LavaTrack</p>
          <p className="mt-0.5 text-[11px] leading-tight text-slate-400">Gestión de Ropa Hospitalaria</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            {l.icono}
            <span>{l.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 text-[11px] text-slate-400 border-t border-slate-100">
        Demo · Clínica privada
      </div>
    </aside>
  )
}
