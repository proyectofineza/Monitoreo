import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

export default function ProtectedRoute({ roles, children }) {
  const { session, role, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-text3 text-sm">Cargando…</div>;
  }
  if (!session) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(role)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center px-6">
        <div>
          <div className="text-lg font-semibold mb-2">Acceso restringido</div>
          <div className="text-text2 text-sm">Tu rol ({role || '—'}) no tiene acceso a esta sección.</div>
        </div>
      </div>
    );
  }
  return children;
}
