import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import NotificationsBell from './NotificationsBell.jsx';

export default function Layout() {
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <main className="flex-1 min-w-0 px-8 py-6">
        <div className="flex justify-end mb-2">
          <NotificationsBell />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
