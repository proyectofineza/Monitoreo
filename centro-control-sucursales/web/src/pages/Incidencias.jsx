import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/auth.jsx';
import Badge from '../components/Badge.jsx';
import Kpi from '../components/Kpi.jsx';
import { SEVERITY_LABEL, SEVERITY_BADGE, fmtDateTime, downloadCsv } from '../lib/format.js';
import { IconSearch, IconReport } from '../components/icons.jsx';

const SEV_COLORS = { baja: '#8b96a8', media: '#ffc736', alta: '#ff8a3d', critica: '#ff5468' };
const tooltipStyle = {
  contentStyle: { background: '#161d29', border: '1px solid #232c3a', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#8b96a8' },
  itemStyle: { color: '#e8ecf2' },
};

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

const ESTADOS = [
  { id: 'todas', label: 'Todas' },
  { id: 'abierta', label: 'Abiertas' },
  { id: 'cerrada', label: 'Solucionadas' },
];
// 'abierta'/'cerrada' son los valores que guarda la base — acá solo se
// ajustan las etiquetas que ve el usuario.
const STATUS_DISPLAY = {
  abierta: { label: 'Abierta', badge: 'badge-amber' },
  cerrada: { label: 'Solucionada', badge: 'badge-green' },
};
const GRAVEDADES = [
  { id: 'todas', label: 'Todas' },
  { id: 'baja', label: 'Baja' },
  { id: 'media', label: 'Media' },
  { id: 'alta', label: 'Alta' },
  { id: 'critica', label: 'Crítica' },
];
const ORIGENES = [
  { id: 'todas', label: 'Todas' },
  { id: 'personal', label: 'De personal' },
  { id: 'operativa', label: 'Operativas' },
];

export default function Incidencias() {
  const { role } = useAuth();
  const [branches, setBranches] = useState([]);
  const [types, setTypes] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState(isoDate(new Date(Date.now() - 29 * 86400000)));
  const [dateTo, setDateTo] = useState(isoDate(new Date()));
  const [branchId, setBranchId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [estado, setEstado] = useState('todas');
  const [gravedad, setGravedad] = useState('todas');
  const [origen, setOrigen] = useState('todas');
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('branches').select('id, code, name, city').order('code').then(({ data }) => setBranches(data || []));
    supabase.from('incident_types').select('*').eq('active', true).order('sort_order').then(({ data }) => setTypes(data || []));
  }, []);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('incidents_detailed').select('*').order('occurred_at', { ascending: false }).limit(500);
    if (dateFrom) q = q.gte('occurred_at', `${dateFrom}T00:00:00`);
    if (dateTo) q = q.lte('occurred_at', `${dateTo}T23:59:59`);
    if (branchId) q = q.eq('branch_id', branchId);
    if (typeId) q = q.eq('type_id', typeId);
    if (estado !== 'todas') q = q.eq('status', estado);
    if (gravedad !== 'todas') q = q.eq('severity', gravedad);
    if (origen === 'personal') q = q.eq('is_personnel', true);
    if (origen === 'operativa') q = q.eq('is_personnel', false);
    const { data, error } = await q;
    setRows(error ? [] : data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, branchId, typeId, estado, gravedad, origen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.branch_code} ${r.branch_name} ${r.branch_city} ${r.type_label}`.toLowerCase().includes(q));
  }, [rows, search]);

  const closeIncident = async (id) => {
    if (!window.confirm('¿Confirmás que esta incidencia ya fue solucionada?')) return;
    const { error } = await supabase.from('incidents').update({ status: 'cerrada' }).eq('id', id);
    if (error) {
      alert('No se pudo marcar como solucionada: ' + error.message);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'cerrada' } : r)));
  };

  const abiertas = filtered.filter((r) => r.status === 'abierta').length;
  const criticas = filtered.filter((r) => r.severity === 'critica').length;
  const branchesInvolved = new Set(filtered.map((r) => r.branch_id)).size;
  const avgPerBranch = branchesInvolved ? (filtered.length / branchesInvolved).toFixed(1) : '0';

  const sevData = useMemo(() => {
    const counts = { baja: 0, media: 0, alta: 0, critica: 0 };
    filtered.forEach((r) => (counts[r.severity] += 1));
    return Object.entries(counts).map(([sev, value]) => ({ sev, name: SEVERITY_LABEL[sev], value }));
  }, [filtered]);

  const typeData = useMemo(() => {
    const map = {};
    filtered.forEach((r) => (map[r.type_label] = (map[r.type_label] || 0) + 1));
    return Object.entries(map).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [filtered]);

  const exportRows = () =>
    filtered.map((r) => ({
      Fecha: fmtDateTime(r.occurred_at),
      Sucursal: `${r.branch_code} — ${r.branch_name}`,
      Ciudad: r.branch_city,
      Tipo: r.type_label,
      Gravedad: SEVERITY_LABEL[r.severity],
      Estado: r.status,
      Empleado: r.employee_name || r.employee_name_freeform || '',
      Operador: r.operator_name || '',
      Observacion: r.observation || '',
    }));

  const handleExportCsv = () => downloadCsv(`incidencias_${dateFrom}_${dateTo}.csv`, exportRows());

  return (
    <div>
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="text-[11px] text-brand uppercase tracking-widest font-semibold mb-1">Incidencias</div>
          <h1 className="text-[22px] font-bold tracking-tight">Dashboard de incidencias</h1>
        </div>
        <button className="btn btn-ghost !text-[12px]" onClick={handleExportCsv}>
          <IconReport /> Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <Kpi label="Incidencias (filtro actual)" value={filtered.length} />
        <Kpi label="Abiertas" value={abiertas} color="#ffc736" />
        <Kpi label="Críticas" value={criticas} color="#ff5468" />
        <Kpi label="Promedio por sucursal" value={avgPerBranch} sub={`${branchesInvolved} sucursales afectadas`} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="card">
          <div className="text-sm font-semibold mb-1">Por gravedad</div>
          <div className="text-[11.5px] text-text3 mb-3">Distribución del período filtrado</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={sevData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2}>
                {sevData.map((s) => (
                  <Cell key={s.sev} fill={SEV_COLORS[s.sev]} stroke="none" />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11.5, color: '#8b96a8' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="text-sm font-semibold mb-1">Por tipo de incidencia</div>
          <div className="text-[11.5px] text-text3 mb-3">Top 8 del período filtrado</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={typeData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#1a212c" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#5a6474', fontSize: 10.5 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ fill: '#8b96a8', fontSize: 11 }} axisLine={false} tickLine={false} width={130} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill="#5b6bff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Desde"><input type="date" className="input !w-[150px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></Field>
          <Field label="Hasta"><input type="date" className="input !w-[150px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></Field>
          <Field label="Sucursal">
            <select className="input !w-[190px]" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Todas</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.code} — {b.name}</option>)}
            </select>
          </Field>
          <Field label="Tipo">
            <select className="input !w-[190px]" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">Todos</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Buscar">
            <div className="relative">
              <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text3" />
              <input className="input !pl-8 !w-[190px]" placeholder="Sucursal, ciudad, tipo…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </Field>
        </div>
        <div className="flex flex-wrap gap-4 mt-3.5 pt-3.5 border-t border-bordersoft">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11.5px] text-text3 mr-1">Estado</span>
            {ESTADOS.map((e) => <Chip key={e.id} active={estado === e.id} onClick={() => setEstado(e.id)} label={e.label} />)}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11.5px] text-text3 mr-1">Gravedad</span>
            {GRAVEDADES.map((g) => <Chip key={g.id} active={gravedad === g.id} onClick={() => setGravedad(g.id)} label={g.label} />)}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11.5px] text-text3 mr-1">Origen</span>
            {ORIGENES.map((o) => <Chip key={o.id} active={origen === o.id} onClick={() => setOrigen(o.id)} label={o.label} />)}
          </div>
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <table className="datatable">
          <thead>
            <tr><th>Fecha</th><th>Sucursal</th><th>Tipo</th><th>Gravedad</th><th>Empleado</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="text-center text-text3 py-8">Cargando…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="text-center text-text3 py-8">No hay incidencias para este filtro.</td></tr>}
            {!loading && filtered.slice(0, 60).map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-text3">{fmtDateTime(r.occurred_at)}</td>
                <td>{r.branch_code} — {r.branch_name}</td>
                <td>{r.type_label}</td>
                <td><Badge className={SEVERITY_BADGE[r.severity]}>{SEVERITY_LABEL[r.severity]}</Badge></td>
                <td className="text-text3">{r.employee_name || r.employee_name_freeform || '—'}</td>
                <td><Badge className={STATUS_DISPLAY[r.status]?.badge}>{STATUS_DISPLAY[r.status]?.label || r.status}</Badge></td>
                <td className="text-right flex items-center justify-end gap-2.5">
                  <Link to={`/score/${r.branch_id}`} className="text-brand text-[11.5px] hover:underline">Sucursal</Link>
                  {(role === 'admin' || role === 'supervisor') && r.status === 'abierta' && (
                    <button className="text-[11.5px] text-green hover:underline font-semibold" onClick={() => closeIncident(r.id)}>✓ Marcar solucionada</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between px-4 py-2.5 text-[11.5px] text-text3">
          <span>Mostrando {Math.min(60, filtered.length)} de {filtered.length} incidencias</span>
          <span>Rango: {dateFrom} → {dateTo}</span>
        </div>
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

function Chip({ active, onClick, label }) {
  return (
    <div
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-[11.5px] font-semibold border cursor-pointer ${
        active ? 'bg-brandsoft border-brand text-brand' : 'bg-surface border-border text-text2'
      }`}
    >
      {label}
    </div>
  );
}
