import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import NotificationsBell from './NotificationsBell.jsx';

export default function Layout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Barra superior — solo aparece en celular/tablet chica (< md).
            En desktop el sidebar ya está siempre visible, así que no hace falta. */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-surface sticky top-0 z-30">
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Abrir menú"
            className="p-1.5 -ml-1.5 text-text2 hover:text-text"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <div className="text-[13px] font-semibold">Centro de Control</div>
        </div>

        <main className="flex-1 min-w-0 px-4 py-4 md:px-8 md:py-6">
          <div className="flex justify-end mb-2">
            <NotificationsBell />
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
