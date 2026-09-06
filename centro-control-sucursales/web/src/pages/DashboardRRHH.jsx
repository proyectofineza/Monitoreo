import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import { supabase } from '../lib/supabaseClient.js';
import Kpi from '../components/Kpi.jsx';
import Badge from '../components/Badge.jsx';
import { fmtRelative } from '../lib/format.js';
import { IconSearch } from '../components/icons.jsx';

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function dayLabel(k) {
  const d = new Date(k + 'T00:00:00');
  return d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' });
}

const tooltipStyle = {
  contentStyle: { background: '#161d29', border: '1px solid #232c3a', borderRadius: 12, fontSize: 12 },
  labelStyle: { color: '#8b96a8' },
  itemStyle: { color: '#e8ecf2' },
};

export default function DashboardRRHH() {
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState([]);
  const [checks, setChecks] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [lastMap, setLastMap] = useState({});

  const [dateFrom, setDateFrom] = useState(isoDate(new Date(Date.now() - 6 * 86400000)));
  const [dateTo, setDateTo] = useState(isoDate(new Date()));
  const [cityFilter, setCityFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const [{ data: br }, { data: ch }, { data: inc }, { data: last }] = await Promise.all([
      supabase.from('branches').select('id, code, name, city').eq('active', true).order('code'),
      supabase.from('branch_checks').select('branch_id, started_at, finished_at').gte('started_at', `${dateFrom}T00:00:00`).lte('started_at', `${dateTo}T23:59:59`),
      supabase.from('incidents').select('branch_id, severity, occurred_at').is('deleted_at', null).gte('occurred_at', `${dateFrom}T00:00:00`).lte('occurred_at', `${dateTo}T23:59:59`),
      supabase.from('branch_last_check').select('*'),
    ]);
    setBranches(br || []);
    setChecks(ch || []);
    setIncidents(inc || []);
    const lMap = {};
    (last || []).forEach((c) => (lMap[c.branch_id] = c));
    setLastMap(lMap);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const cities = useMemo(() => [...new Set(branches.map((b) => b.city))].filter(Boolean).sort(), [branches]);

  const rows = useMemo(() => {
    const checkedSet = new Set();
    checks.forEach((c) => {
      if (c.finished_at) checkedSet.add(c.branch_id);
    });
    const incByBranch = {};
    incidents.forEach((i) => {
      incByBranch[i.branch_id] = (incByBranch[i.branch_id] || 0) + 1;
    });
    return branches
      .filter((b) => (cityFilter ? b.city === cityFilter : true))
      .filter((b) => {
        const q = search.trim().toLowerCase();
        return q ? `${b.code} ${b.name} ${b.city}`.toLowerCase().includes(q) : true;
      })
      .map((b) => ({
        branch: b,
        controlada: checkedSet.has(b.id),
        incidencias: incByBranch[b.id] || 0,
      }));
  }, [branches, checks, incidents, cityFilter, search]);

  const total = rows.length;
  const controladas = rows.filter((r) => r.controlada).length;
  const pendientes = total - controladas;
  const conIncidencia = rows.filter((r) => r.incidencias > 0).length;

  const estadoPie = useMemo(
    () => [
      { name: 'Controladas', value: controladas, color: '#22e2a0' },
      { name: 'Pendientes', value: pendientes, color: '#ff5468' },
    ],
    [controladas, pendientes]
  );

  const incPie = useMemo(
    () => [
      { name: 'Con incidencia', value: conIncidencia, color: '#ffc736' },
      { name: 'Sin incidencia', value: Math.max(0, total - conIncidencia), color: '#22e2a0' },
    ],
    [conIncidencia, total]
  );

  const byCity = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      const city = r.branch.city || 'Sin ciudad';
      if (!map[city]) map[city] = { city, controladas: 0, pendientes: 0 };
      if (r.controlada) map[city].controladas += 1;
      else map[city].pendientes += 1;
    });
    return Object.values(map).sort((a, b) => b.controladas + b.pendientes - (a.controladas + a.pendientes));
  }, [rows]);

  const dailySeries = useMemo(() => {
    const from = new Date(`${dateFrom}T00:00:00`);
    const to = new Date(`${dateTo}T00:00:00`);
    const days = Math.max(1, Math.min(60, Math.round((to - from) / 86400000) + 1));
    const map = {};
    for (let i = 0; i < days; i++) {
      const k = isoDate(new Date(from.getTime() + i * 86400000));
      map[k] = new Set();
    }
    checks.forEach((c) => {
      if (!c.finished_at) return;
      const k = c.started_at.slice(0, 10);
      if (map[k]) map[k].add(c.branch_id);
    });
    return Object.entries(map).map(([k, set]) => ({ date: dayLabel(k), controladas: set.size }));
  }, [checks, dateFrom, dateTo]);

  if (loading) return <div className="text-text3 text-sm py-10 text-center">Cargando…</div>;

  return (
    <div>
      <div className="mb-5">
        <div className="text-[11px] text-brand uppercase tracking-widest font-semibold mb-1">Dashboard</div>
        <h1 className="text-[22px] font-bold tracking-tight">RRHH — Cobertura de sucursales</h1>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <Kpi label="Sucursales" value={total} sub="En el filtro actual" />
        <Kpi label="Controladas" value={controladas} color="#22e2a0" />
        <Kpi label="Pendientes" value={pendientes} color={pendientes > 0 ? '#ff5468' : '#22e2a0'} pulse={pendientes > 0} />
        <Kpi label="Con incidencia" value={conIncidencia} color="#ffc736" />
      </div>

      <div className="card mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Desde">
            <input type="date" className="input !w-[150px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </Field>
          <Field label="Hasta">
            <input type="date" className="input !w-[150px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </Field>
          <Field label="Ciudad">
            <select className="input !w-[180px]" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              <option value="">Todas</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Buscar sucursal">
            <div className="relative">
              <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text3" />
              <input className="input !pl-8 !w-[220px]" placeholder="Código, nombre o ciudad…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="card">
          <div className="text-sm font-semibold mb-1">Estado de control</div>
          <div className="text-[11.5px] text-text3 mb-2">Controladas vs. pendientes</div>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={estadoPie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={3}>
                {estadoPie.map((e) => (
                  <Cell key={e.name} fill={e.color} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 text-[11.5px] text-text3 mt-1 flex-wrap">
            <LegendDot color="#22e2a0" label={`Controladas (${controladas})`} />
            <LegendDot color="#ff5468" label={`Pendientes (${pendientes})`} />
          </div>
        </div>

        <div className="card">
          <div className="text-sm font-semibold mb-1">Incidencias</div>
          <div className="text-[11.5px] text-text3 mb-2">Con vs. sin incidencia</div>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={incPie} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={3}>
                {incPie.map((e) => (
                  <Cell key={e.name} fill={e.color} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 text-[11.5px] text-text3 mt-1 flex-wrap">
            <LegendDot color="#ffc736" label={`Con incidencia (${conIncidencia})`} />
            <LegendDot color="#22e2a0" label={`Sin incidencia (${Math.max(0, total - conIncidencia)})`} />
          </div>
        </div>

        <div className="card">
          <div className="text-sm font-semibold mb-1">Cobertura diaria</div>
          <div className="text-[11.5px] text-text3 mb-2">Sucursales controladas por día</div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={dailySeries} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="rrhhGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5b6bff" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#5b6bff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1a212c" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#5a6474', fontSize: 10.5 }} axisLine={{ stroke: '#232c3a' }} tickLine={false} />
              <YAxis tick={{ fill: '#5a6474', fontSize: 10.5 }} axisLine={false} tickLine={false} allowDecimals={false} width={26} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="controladas" stroke="#5b6bff" strokeWidth={2} fill="url(#rrhhGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card mb-4">
        <div className="text-sm font-semibold mb-1">Por ciudad</div>
        <div className="text-[11.5px] text-text3 mb-3">Controladas vs. pendientes por ciudad</div>
        <ResponsiveContainer width="100%" height={Math.max(180, byCity.length * 34)}>
          <BarChart data={byCity} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="#1a212c" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#5a6474', fontSize: 10.5 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="city" tick={{ fill: '#8b96a8', fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="controladas" stackId="a" fill="#22e2a0" />
            <Bar dataKey="pendientes" stackId="a" fill="#ff5468" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="px-4 pt-3.5 pb-2.5 text-sm font-semibold">Detalle por sucursal</div>
        <table className="datatable">
          <thead>
            <tr>
              <th>Código</th><th>Sucursal</th><th>Ciudad</th><th>Estado</th><th>Incidencias</th><th>Última verificación</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="text-center text-text3 py-8">Sin sucursales para este filtro.</td></tr>
            )}
            {rows.slice(0, 80).map((r) => (
              <tr key={r.branch.id}>
                <td className="font-mono text-text2">{r.branch.code}</td>
                <td>{r.branch.name}</td>
                <td className="text-text3">{r.branch.city}</td>
                <td>
                  <Badge className={r.controlada ? 'badge-green' : 'badge-red'} pulse={!r.controlada}>
                    {r.controlada ? 'Controlada' : 'Pendiente'}
                  </Badge>
                </td>
                <td>
                  {r.incidencias > 0 ? <Badge className="badge-amber">{r.incidencias}</Badge> : <span className="text-text3">—</span>}
                </td>
                <td className="font-mono text-text3">{lastMap[r.branch.id] ? fmtRelative(lastMap[r.branch.id].finished_at) : 'Sin registro'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2.5 text-[11.5px] text-text3">Mostrando {Math.min(80, rows.length)} de {rows.length} sucursales</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[10.5px] text-text3 uppercase tracking-wide mb-1">{label}</div>
      {children}
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: color }} />
      {label}
    </div>
  );
}
