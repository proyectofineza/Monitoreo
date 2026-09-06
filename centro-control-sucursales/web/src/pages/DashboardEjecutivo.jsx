import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell, PieChart, Pie,
} from 'recharts';
import { supabase } from '../lib/supabaseClient.js';
import Kpi from '../components/Kpi.jsx';
import Badge from '../components/Badge.jsx';
import { scoreColor, SEVERITY_LABEL, SEVERITY_BADGE, fmtRelative } from '../lib/format.js';

const SEV_COLORS = { baja: '#8b96a8', media: '#ffc736', alta: '#ff8a3d', critica: '#ff5468' };

function dayKey(d) {
  return d.toISOString().slice(0, 10);
}
function dayLabel(k) {
  const d = new Date(k + 'T00:00:00');
  return d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' });
}

const tooltipStyle = {
  contentStyle: { background: '#161d29', border: '1px solid #232c3a', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#8b96a8' },
  itemStyle: { color: '#e8ecf2' },
};

// Etiqueta de porcentaje dentro de cada porción de la torta/dona.
function renderDonutLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }) {
  if (!percent) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#0a0e14" fontSize={11} fontWeight={700} textAnchor="middle" dominantBaseline="central">
      {`${Math.round(percent * 100)}%`}
    </text>
  );
}

export default function DashboardEjecutivo() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [todayChecks, setTodayChecks] = useState([]);
  const [scores, setScores] = useState([]);
  const [incidents14, setIncidents14] = useState([]);
  const [criticalRecent, setCriticalRecent] = useState([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since14 = new Date(Date.now() - 13 * 86400000).toISOString();
      const [{ data: br }, { data: today }, { data: sc }, { data: inc14 }, { data: crit }] = await Promise.all([
        supabase.from('branches').select('id, active'),
        supabase.from('branch_today_check').select('branch_id, status, finished_at'),
        supabase.from('branch_scores').select('*, branches(code, name, city)'),
        supabase.from('incidents').select('occurred_at, severity').is('deleted_at', null).gte('occurred_at', since14),
        supabase.from('incidents_detailed').select('*').eq('severity', 'critica').order('occurred_at', { ascending: false }).limit(6),
      ]);
      setBranches(br || []);
      setTodayChecks(today || []);
      setScores((sc || []).filter((s) => s.branches));
      setIncidents14(inc14 || []);
      setCriticalRecent(crit || []);
      setLoading(false);
    })();
  }, []);

  const activeBranches = branches.filter((b) => b.active).length;
  const verifiedToday = todayChecks.filter((c) => c.finished_at).length;
  const pctToday = activeBranches ? Math.round((verifiedToday / activeBranches) * 100) : 0;

  const avgScore = scores.length ? Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length) : null;
  const totalIncidents30 = scores.reduce((s, r) => s + r.total_incidents, 0);
  const totalCritical30 = scores.reduce((s, r) => s + r.critical_incidents, 0);

  const dailySeries = useMemo(() => {
    const map = {};
    for (let i = 13; i >= 0; i--) {
      const k = dayKey(new Date(Date.now() - i * 86400000));
      map[k] = 0;
    }
    incidents14.forEach((i) => {
      const k = i.occurred_at.slice(0, 10);
      if (k in map) map[k] += 1;
    });
    return Object.entries(map).map(([k, v]) => ({ date: dayLabel(k), incidencias: v }));
  }, [incidents14]);

  const sevBreakdown = useMemo(() => {
    const counts = { baja: 0, media: 0, alta: 0, critica: 0 };
    incidents14.forEach((i) => (counts[i.severity] += 1));
    return Object.entries(counts).map(([sev, count]) => ({ sev, label: SEVERITY_LABEL[sev], count }));
  }, [incidents14]);

  const bottom5 = useMemo(() => [...scores].sort((a, b) => a.score - b.score).slice(0, 5), [scores]);

  const estadoRed = useMemo(() => {
    const counts = { buen_estado: 0, atencion: 0, critico: 0 };
    scores.forEach((s) => {
      if (s.score >= 80) counts.buen_estado += 1;
      else if (s.score >= 60) counts.atencion += 1;
      else counts.critico += 1;
    });
    return [
      { name: 'Buen estado', value: counts.buen_estado, color: '#22e2a0' },
      { name: 'Atención', value: counts.atencion, color: '#ff8a3d' },
      { name: 'Requiere atención', value: counts.critico, color: '#ff5468' },
    ];
  }, [scores]);

  if (loading) return <div className="text-text3 text-sm py-10 text-center">Cargando…</div>;

  return (
    <div>
      <div className="mb-5">
        <div className="text-[11px] text-brand uppercase tracking-widest font-semibold mb-1">Dashboard</div>
        <h1 className="text-[22px] font-bold tracking-tight">Vista ejecutiva de la red</h1>
      </div>

      <div className="grid grid-cols-5 gap-3 mb-4">
        <Kpi label="Sucursales activas" value={activeBranches} sub={`${branches.length} en total`} />
        <Kpi label="Verificadas hoy" value={`${verifiedToday}/${activeBranches}`} sub={`${pctToday}% de cobertura`} color={pctToday >= 80 ? '#22e2a0' : pctToday >= 50 ? '#ffc736' : '#ff5468'} />
        <Kpi label="Score promedio red" value={avgScore ?? '—'} color={avgScore != null ? scoreColor(avgScore) : undefined} />
        <Kpi label="Incidencias (histórico)" value={totalIncidents30} color="#ffc736" />
        <Kpi label="Críticas (histórico)" value={totalCritical30} color="#ff5468" />
      </div>

      <div className="grid grid-cols-[1.15fr_.85fr_.85fr] gap-4 mb-4">
        <div className="card">
          <div className="text-sm font-semibold mb-1">Incidencias registradas — últimos 14 días</div>
          <div className="text-[11.5px] text-text3 mb-3">Todas las sucursales</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dailySeries} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5b6bff" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#5b6bff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1a212c" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#5a6474', fontSize: 10.5 }} axisLine={{ stroke: '#232c3a' }} tickLine={false} />
              <YAxis tick={{ fill: '#5a6474', fontSize: 10.5 }} axisLine={false} tickLine={false} allowDecimals={false} width={26} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="incidencias" stroke="#5b6bff" strokeWidth={2} fill="url(#incGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="text-sm font-semibold mb-1">Por gravedad</div>
          <div className="text-[11.5px] text-text3 mb-3">Últimos 14 días</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sevBreakdown} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#1a212c" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#5a6474', fontSize: 10.5 }} axisLine={{ stroke: '#232c3a' }} tickLine={false} />
              <YAxis tick={{ fill: '#5a6474', fontSize: 10.5 }} axisLine={false} tickLine={false} allowDecimals={false} width={26} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {sevBreakdown.map((s) => (
                  <Cell key={s.sev} fill={SEV_COLORS[s.sev]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="text-sm font-semibold mb-1">Estado de la red</div>
          <div className="text-[11.5px] text-text3 mb-3">Sucursales según su Score actual</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={estadoRed} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={3} label={renderDonutLabel} labelLine={false}>
                {estadoRed.map((e) => (
                  <Cell key={e.name} fill={e.color} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-3 text-[11px] text-text3 mt-1 flex-wrap">
            <LegendDot color="#22e2a0" label={`Buen estado (${estadoRed[0].value})`} />
            <LegendDot color="#ff8a3d" label={`Atención (${estadoRed[1].value})`} />
            <LegendDot color="#ff5468" label={`Requiere atención (${estadoRed[2].value})`} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <div className="text-sm font-semibold mb-1">⚠️ Sucursales que requieren atención</div>
          <div className="text-[11.5px] text-text3 mb-3">Las 5 de menor score en la red</div>
          {bottom5.map((r) => (
            <div key={r.branch_id} className="flex justify-between items-center py-2.5 border-b border-bordersoft last:border-none text-[12.8px] cursor-pointer" onClick={() => navigate(`/score/${r.branch_id}`)}>
              <span>Suc. {r.branches.code} — {r.branches.name}, {r.branches.city}</span>
              <span className="font-mono font-bold" style={{ color: scoreColor(r.score) }}>{r.score}</span>
            </div>
          ))}
          {bottom5.length === 0 && <div className="text-text3 text-sm py-4 text-center">Sin datos suficientes.</div>}
        </div>

        <div className="card">
          <div className="text-sm font-semibold mb-1">Incidencias críticas recientes</div>
          <div className="text-[11.5px] text-text3 mb-3">Últimos 6 eventos de gravedad crítica</div>
          {criticalRecent.map((h) => (
            <div key={h.id} className="flex justify-between items-center py-2.5 border-b border-bordersoft last:border-none text-[12.8px]">
              <div>
                <div>{h.type_label} — {h.branch_name}</div>
                <div className="text-text3 text-[11px] mt-0.5">{fmtRelative(h.occurred_at)} · {h.branch_city}</div>
              </div>
              <Badge className={SEVERITY_BADGE.critica}>{SEVERITY_LABEL.critica}</Badge>
            </div>
          ))}
          {criticalRecent.length === 0 && <div className="text-text3 text-sm py-4 text-center">Sin incidencias críticas recientes.</div>}
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full flex-none" style={{ background: color }} />
      {label}
    </div>
  );
}
