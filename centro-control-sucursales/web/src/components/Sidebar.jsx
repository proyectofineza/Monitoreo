import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { ROLE_LABEL } from '../lib/format.js';
import {
  IconDashboard, IconCamera, IconBuilding, IconAlert, IconClipboard,
  IconTrophy, IconMap, IconReport, IconUsers, IconAudit, IconSettings,
} from './icons.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', Icon: IconDashboard, roles: ['admin', 'supervisor', 'monitoreo', 'rrhh'] },
  { to: '/monitoreo', label: 'Monitoreo', Icon: IconCamera, roles: ['admin', 'supervisor', 'monitoreo'] },
  { to: '/sucursales', label: 'Sucursales', Icon: IconBuilding, roles: ['admin', 'supervisor'] },
  { to: '/incidencias', label: 'Incidencias', Icon: IconAlert, roles: ['admin', 'supervisor'] },
  { to: '/historial', label: 'Verificaciones', Icon: IconClipboard, roles: ['admin', 'supervisor', 'monitoreo'] },
  { to: '/ranking', label: 'Score / Ranking', Icon: IconTrophy, roles: ['admin', 'supervisor'] },
  { to: '/mapa', label: 'Mapa', Icon: IconMap, roles: ['admin', 'supervisor'] },
  { to: '/reportes', label: 'Reportes', Icon: IconReport, roles: ['admin', 'supervisor'] },
];

const NAV_ADMIN = [
  { to: '/usuarios', label: 'Usuarios', Icon: IconUsers, roles: ['admin'] },
  { to: '/auditoria', label: 'Auditoría', Icon: IconAudit, roles: ['admin'] },
  { to: '/configuracion', label: 'Configuración', Icon: IconSettings, roles: ['admin'] },
];

export default function Sidebar() {
  const { profile, role, signOut } = useAuth();
  const visible = NAV.filter((n) => n.roles.includes(role));
  const visibleAdmin = NAV_ADMIN.filter((n) => n.roles.includes(role));

  return (
    <aside className="w-[232px] flex-none bg-surface border-r border-border p-3 flex flex-col h-screen sticky top-0">
      <div className="flex items-center gap-2.5 px-2 pb-4 pt-1.5">
        <div className="w-[30px] h-[30px] rounded-lg bg-gradient-to-br from-brand to-[#2f5fd6] flex items-center justify-center flex-none">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M4 16 L9 8 L13 13 L20 5" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div className="text-[13px] font-semibold">FINEZA</div>
          <div className="text-[10.5px] text-text3">Centro de Control</div>
        </div>
      </div>

      <nav className="flex flex-col gap-px">
        {visible.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `navitem ${isActive ? 'active' : ''}`}>
            <Icon /> {label}
          </NavLink>
        ))}
        {visibleAdmin.length > 0 && (
          <>
            <div className="text-[10px] text-text3 uppercase tracking-wide px-2.5 pt-3.5 pb-1.5">Administración</div>
            {visibleAdmin.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `navitem ${isActive ? 'active' : ''}`}>
                <Icon /> {label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-2 p-2.5 border-t border-border mt-2">
        <div className="w-7 h-7 rounded-full bg-surface3 flex items-center justify-center text-[11px] font-semibold text-text2 flex-none">
          {(profile?.full_name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold truncate">{profile?.full_name || '…'}</div>
          <div className="text-[10.5px] text-text3">{ROLE_LABEL[role] || '—'}</div>
        </div>
        <button
          onClick={signOut}
          title="Cerrar sesión"
          className="ml-auto text-text3 hover:text-text2 p-1"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" />
            <path d="M9 12h11m0 0-3.5-3.5M20 12l-3.5 3.5" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
