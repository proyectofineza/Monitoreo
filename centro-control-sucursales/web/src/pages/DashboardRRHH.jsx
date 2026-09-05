import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { supabase } from '../lib/supabaseClient.js';
import Kpi from '../components/Kpi.jsx';
import Badge from '../components/Badge.jsx';
import { SEVERITY_LABEL, SEVERITY_BADGE, fmtDateTime } from '../lib/format.js';

const tooltipStyle = {
  contentStyle: { background: '#161d29', border: '1px solid #232c3a', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#8b96a8' },
  itemStyle: { color: '#e8ecf2' },
};

export default function DashboardRRHH() {
  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - 44 * 86400000).toISOString();
      const { data } = await supabase
        .from('incidents_detailed')
        .select('*')
        .eq('is_personnel', true)
        .gte('occurred_at', since)
        .order('occurred_at', { ascending: false })
        .limit(300);
      setIncidents(data || []);
      setLoading(false);
    })();
  }, []);

  const abiertas = incidents.filter((i) => i.status === 'abierta').length;
  const criticas = incidents.filter((i) => i.severity === 'critica').length;

  const employeeCounts = useMemo(() => {
    const map = {};
    incidents.forEach((i) => {
      const key = i.employee_name || i.employee_name_freeform || 'Sin identificar';
      if (!map[key]) map[key] = { name: key, count: 0, branch: i.branch_name };
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [incidents]);

  const recurrentes = employeeCounts.filter((e) => e.count > 1 && e.name !== 'Sin identificar');

  const byType = useMemo(() => {
    const map = {};
    incidents.forEach((i) => {
      map[i.type_label] = (map[i.type_label] || 0) + 1;
    });
    return Object.entries(map)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [incidents]);

  if (loading) return <div className="text-text3 text-sm py-10 text-center">Cargando…</div>;

  return (
    <div>
      <div className="mb-5">
        <div className="text-[11px] text-brand uppercase tracking-widest font-semibold mb-1">Dashboard</div>
        <h1 className="text-[22px] font-bold tracking-tight">Incidencias de personal — RRHH</h1>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <Kpi label="Incidencias de personal" value={incidents.length} sub="Últimos 45 días" />
        <Kpi label="Abiertas" value={abiertas} color="#fbbf24" />
        <Kpi label="Críticas" value={criticas} color="#f87171" />
        <Kpi label="Empleados recurrentes" value={recurrentes.length} sub="Más de 1 incidencia" color={recurrentes.length > 0 ? '#f87171' : '#34d399'} />
      </div>

      <div className="grid grid-cols-[1fr_1.3fr] gap-4 mb-4">
        <div className="card">
          <div className="text-sm font-semibold mb-1">Incidencias por tipo</div>
          <div className="text-[11.5px] text-text3 mb-3">Últimos 45 días — solo personal</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byType} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#1a212c" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#5a6474', fontSize: 10.5 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={{ fill: '#8b96a8', fontSize: 11 }} axisLine={false} tickLine={false} width={130} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill="#4f8cff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="text-sm font-semibold mb-1">⚠️ Empleados con incidencias recurrentes</div>
          <div className="text-[11.5px] text-text3 mb-3">Más de una incidencia registrada en el período</div>
          {recurrentes.length === 0 && <div className="text-text3 text-sm py-4 text-center">Sin recurrencias detectadas.</div>}
          {recurrentes.slice(0, 8).map((e) => (
            <div key={e.name} className="flex justify-between items-center py-2.5 border-b border-bordersoft last:border-none text-[12.8px]">
              <div>
                <div>{e.name}</div>
                <div className="text-text3 text-[11px] mt-0.5">{e.branch}</div>
              </div>
              <span className="font-mono font-bold text-red">{e.count}×</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="px-4 pt-3.5 pb-2.5 text-sm font-semibold">Incidencias de personal recientes</div>
        <table className="datatable">
          <thead><tr><th>Fecha</th><th>Sucursal</th><th>Empleado</th><th>Tipo</th><th>Gravedad</th><th>Estado</th></tr></thead>
          <tbody>
            {incidents.length === 0 && <tr><td colSpan={6} className="text-center text-text3 py-8">Sin incidencias de personal registradas.</td></tr>}
            {incidents.slice(0, 30).map((i) => (
              <tr key={i.id}>
                <td className="font-mono text-text3">{fmtDateTime(i.occurred_at)}</td>
                <td>{i.branch_name}</td>
                <td>{i.employee_name || i.employee_name_freeform || '—'}</td>
                <td>{i.type_label}</td>
                <td><Badge className={SEVERITY_BADGE[i.severity]}>{SEVERITY_LABEL[i.severity]}</Badge></td>
                <td className="text-text3 capitalize">{i.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2.5 text-[11.5px] text-text3">Mostrando {Math.min(30, incidents.length)} de {incidents.length}</div>
      </div>
    </div>
  );
}
