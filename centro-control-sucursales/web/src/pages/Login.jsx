import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { IconLogout } from '../components/icons.jsx';

export default function Login() {
  const { session, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) setError('Usuario o contraseña incorrectos.');
  };

  return (
    <div className="min-h-screen flex">
      <div className="flex-[1.15] hidden lg:flex flex-col justify-between p-14 border-r border-border"
        style={{
          background:
            'radial-gradient(900px 500px at 15% 10%, rgba(79,140,255,.16), transparent 60%), radial-gradient(700px 500px at 90% 90%, rgba(52,211,153,.08), transparent 60%), linear-gradient(180deg,#0c111a,#080b11)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-brand to-[#2f5fd6] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 16 L9 8 L13 13 L20 5" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="text-[15px] font-semibold tracking-wide">FINEZA S.A.</div>
            <div className="text-xs text-text2">Departamento de TI</div>
          </div>
        </div>
        <div className="max-w-[460px]">
          <div className="text-xs text-brand tracking-[0.14em] uppercase font-semibold mb-3.5">Centro de Control de Sucursales</div>
          <h1 className="text-[34px] leading-[1.18] font-bold tracking-tight mb-3.5">
            Monitoreo, verificación e incidencias de toda la red en un solo lugar.
          </h1>
          <p className="text-[14.5px] leading-relaxed text-text2">
            Operadores, supervisores, RRHH y gerencia acceden a la información que necesitan, con el nivel
            de detalle que corresponde a cada rol.
          </p>
        </div>
        <div className="text-[11.5px] text-text3">© 2026 FINEZA S.A. — Uso interno.</div>
      </div>

      <div className="flex-1 flex items-center justify-center p-10">
        <form onSubmit={submit} className="w-full max-w-[380px]">
          <h2 className="text-xl font-semibold mb-1.5">Ingresar</h2>
          <p className="text-[13.5px] text-text2 mb-6">Iniciá sesión con tu usuario de FINEZA.</p>

          <div className="mb-4">
            <span className="label block text-[11px] font-semibold text-text2 uppercase tracking-wide mb-1.5">Email</span>
            <input
              className="input"
              type="email"
              autoComplete="username"
              placeholder="usuario@fineza.demo"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="mb-2">
            <span className="label block text-[11px] font-semibold text-text2 uppercase tracking-wide mb-1.5">Contraseña</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="text-red text-[12.5px] mt-2">{error}</div>}

          <button type="submit" disabled={busy} className="btn btn-primary w-full mt-5">
            <IconLogout style={{ transform: 'scaleX(-1)' }} />
            {busy ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
