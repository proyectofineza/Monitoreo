import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import Kpi from '../components/Kpi.jsx';
import Badge from '../components/Badge.jsx';
import { scoreColor, fmtRelative } from '../lib/format.js';

export default function DashboardSupervisor() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [todayMap, setTodayMap] = useState({});
  const [lastMap, setLastMap] = useState({});
  const [profilesMap, setProfilesMap] = useState({});
  const [incidentsToday, setIncidentsToday] = useState([]);
  const [trend, setTrend] = useState([]);
  const [scoresMap, setScoresMap] = useState({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const [{ data: br }, { data: today }, { data: last }, { data: profs }, { data: incs }, { data: tr }, { data: sc }] = await Promise.all([
        supabase.from('branches').select('*').eq('active', true).order('code'),
        supabase.from('branch_today_check').select('*'),
        supabase.from('branch_last_check').select('*'),
        supabase.from('profiles').select('id, full_name, role'),
        supabase.from('incidents').select('branch_id, severity').gte('occurred_at', startOfDay.toISOString()).is('deleted_at', null),
        supabase.from('branch_score_latest').select('*, branches(code, name, city)'),
        supabase.from('branch_scores').select('branch_id, score'),
      ]);
      setBranches(br || []);
      const tMap = {};
      (today || []).forEach((c) => (tMap[c.branch_id] = c));
      setTodayMap(tMap);
      const lMap = {};
      (last || []).forEach((c) => (lMap[c.branch_id] = c));
      setLastMap(lMap);
      const pMap = {};
      (profs || []).forEach((p) => (pMap[p.id] = p));
      setProfilesMap(pMap);
      setIncidentsToday(incs || []);
      setTrend((tr || []).filter((t) => t.branches));
      const sMap = {};
      (sc || []).forEach((s) => (sMap[s.branch_id] = s.score));
      setScoresMap(sMap);
      setLoading(false);
    })();
  }, []);

  const pending = useMemo(
    () => branches.filter((b) => !todayMap[b.id] || !todayMap[b.id].finished_at),
    [branches, todayMap]
  );
  const verifiedToday = branches.length - pending.length;
  const pct = branches.length ? Math.round((verifiedToday / branches.length) * 100) : 0;

  const criticalToday = incidentsToday.filter((i) => i.severity === 'critica').length;

  const operatorStats = useMemo(() => {
    const stats = {};
    Object.values(todayMap).forEach((c) => {
      if (!c.finished_at) return;
      const name = profilesMap[c.operator_id]?.full_name || 'Operador';
      stats[name] = (stats[name] || 0) + 1;
    });
    return Object.entries(stats).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [todayMap, profilesMap]);

  const movers = useMemo(() => {
    const withVar = trend.map((t) => ({ ...t, variacion: t.prev_score != null ? t.score - t.prev_score : 0 }));
    const deterioro = [...withVar].filter((t) => t.variacion < 0).sort((a, b) => a.variacion - b.variacion).slice(0, 4);
    const mejora = [...withVar].filter((t) => t.variacion > 0).sort((a, b) => b.variacion - a.variacion).slice(0, 4);
    return { deterioro, mejora };
  }, [trend]);

  if (loading) return <div className="text-text3 text-sm py-10 text-center">Cargando…</div>;

  return (
    <div>
      <div className="mb-5">
        <div className="text-[11px] text-brand uppercase tracking-widest font-semibold mb-1">Dashboard</div>
        <h1 className="text-[22px] font-bold tracking-tight">Supervisión operativa</h1>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <Kpi label="Verificadas hoy" value={`${verifiedToday}/${branches.length}`} sub={`${pct}% de cobertura`} color={pct >= 80 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171'} />
        <Kpi label="Pendientes hoy" value={pending.length} color={pending.length > 0 ? '#f87171' : '#34d399'} />
        <Kpi label="Incidencias hoy" value={incidentsToday.length} color="#fbbf24" />
        <Kpi label="Críticas hoy" value={criticalToday} color="#f87171" />
      </div>

      <div className="grid grid-cols-[1.4fr_1fr] gap-4 mb-4">
        <div className="card !p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
            <div className="text-sm font-semibold">Sucursales pendientes de verificar</div>
            <Link to="/monitoreo" className="text-brand text-[11.5px] hover:underline">Ir a Monitoreo →</Link>
          </div>
          <table className="datatable">
            <thead><tr><th>Código</th><th>Sucursal</th><th>Ciudad</th><th>Score</th><th>Última revisión</th></tr></thead>
            <tbody>
              {pending.length === 0 && <tr><td colSpan={5} className="text-center text-text3 py-6">Todas las sucursales fueron verificadas hoy.</td></tr>}
              {pending.slice(0, 8).map((b) => (
                <tr key={b.id} className="cursor-pointer" onClick={() => navigate(`/score/${b.id}`)}>
                  <td className="font-mono text-text2">{b.code}</td>
                  <td>{b.name}</td>
                  <td className="text-text3">{b.city}</td>
                  <td className="font-mono font-bold" style={{ color: scoreColor(scoresMap[b.id] ?? 100) }}>{scoresMap[b.id] ?? '—'}</td>
                  <td className="font-mono text-text3">{lastMap[b.id] ? fmtRelative(lastMap[b.id].finished_at) : 'Sin registro'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pending.length > 8 && (
            <div className="px-4 py-2.5 text-[11.5px] text-text3">+{pending.length - 8} sucursales más pendientes</div>
          )}
        </div>

        <div className="card">
          <div className="text-sm font-semibold mb-1">Rendimiento del equipo — hoy</div>
          <div className="text-[11.5px] text-text3 mb-3">Verificaciones completadas por operador</div>
          {operatorStats.length === 0 && <div className="text-text3 text-sm py-4 text-center">Sin verificaciones completadas todavía.</div>}
          {operatorStats.map((o) => (
            <div key={o.name} className="flex items-center justify-between py-2.5 border-b border-bordersoft last:border-none text-[12.8px]">
              <span>{o.name}</span>
              <span className="font-mono font-bold text-brand">{o.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <div className="text-sm font-semibold mb-1">📉 Mayor deterioro</div>
          <div className="text-[11.5px] text-text3 mb-3">Sucursales cuyo score empeoró más recientemente</div>
          {movers.deterioro.length === 0 && <div className="text-text3 text-sm py-4 text-center">Sin variaciones negativas.</div>}
          {movers.deterioro.map((t) => (
            <div key={t.branch_id} className="flex justify-between py-2 border-b border-bordersoft last:border-none text-[12.8px] cursor-pointer" onClick={() => navigate(`/score/${t.branch_id}`)}>
              <span>Suc. {t.branches.code} — {t.branches.name}</span>
              <span className="font-mono font-bold text-red">{t.variacion}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="text-sm font-semibold mb-1">📈 Mayor mejora</div>
          <div className="text-[11.5px] text-text3 mb-3">Sucursales cuyo score mejoró más recientemente</div>
          {movers.mejora.length === 0 && <div className="text-text3 text-sm py-4 text-center">Sin variaciones positivas.</div>}
          {movers.mejora.map((t) => (
            <div key={t.branch_id} className="flex justify-between py-2 border-b border-bordersoft last:border-none text-[12.8px] cursor-pointer" onClick={() => navigate(`/score/${t.branch_id}`)}>
              <span>Suc. {t.branches.code} — {t.branches.name}</span>
              <span className="font-mono font-bold text-green">+{t.variacion}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
