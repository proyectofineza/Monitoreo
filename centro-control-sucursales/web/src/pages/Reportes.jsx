import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { scoreColor, downloadCsv } from '../lib/format.js';
import { IconSearch, IconReport } from '../components/icons.jsx';

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  return isoDate(d);
}

export default function Reportes() {
  const [branches, setBranches] = useState([]);
  const [checks, setChecks] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [scoresMap, setScoresMap] = useState({});
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState(startOfMonth());
  const [dateTo, setDateTo] = useState(isoDate(new Date()));
  const [cityFilter, setCityFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const [{ data: br }, { data: ch }, { data: inc }, { data: sc }] = await Promise.all([
      supabase.from('branches').select('id, code, name, city, active').eq('active', true).order('code'),
      supabase.from('branch_checks').select('branch_id, finished_at').gte('started_at', `${dateFrom}T00:00:00`).lte('started_at', `${dateTo}T23:59:59`),
      supabase.from('incidents').select('branch_id, severity').is('deleted_at', null).gte('occurred_at', `${dateFrom}T00:00:00`).lte('occurred_at', `${dateTo}T23:59:59`),
      supabase.from('branch_scores').select('branch_id, score'),
    ]);
    setBranches(br || []);
    setChecks(ch || []);
    setIncidents(inc || []);
    const sMap = {};
    (sc || []).forEach((s) => (sMap[s.branch_id] = s.score));
    setScoresMap(sMap);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const cities = useMemo(() => [...new Set(branches.map((b) => b.city))].sort(), [branches]);

  const summary = useMemo(() => {
    const checksByBranch = {};
    checks.forEach((c) => {
      if (!checksByBranch[c.branch_id]) checksByBranch[c.branch_id] = { total: 0, finished: 0 };
      checksByBranch[c.branch_id].total += 1;
      if (c.finished_at) checksByBranch[c.branch_id].finished += 1;
    });
    const incByBranch = {};
    incidents.forEach((i) => {
      if (!incByBranch[i.branch_id]) incByBranch[i.branch_id] = { baja: 0, media: 0, alta: 0, critica: 0, total: 0 };
      incByBranch[i.branch_id][i.severity] += 1;
      incByBranch[i.branch_id].total += 1;
    });
    return branches
      .map((b) => ({
        branch: b,
        checks: checksByBranch[b.id] || { total: 0, finished: 0 },
        inc: incByBranch[b.id] || { baja: 0, media: 0, alta: 0, critica: 0, total: 0 },
        score: scoresMap[b.id] ?? 100,
      }))
      .filter((r) => (cityFilter ? r.branch.city === cityFilter : true))
      .filter((r) => {
        const q = search.trim().toLowerCase();
        return q ? `${r.branch.code} ${r.branch.name} ${r.branch.city}`.toLowerCase().includes(q) : true;
      })
      .sort((a, b) => b.inc.total - a.inc.total);
  }, [branches, checks, incidents, scoresMap, cityFilter, search]);

  const totals = useMemo(
    () =>
      summary.reduce(
        (acc, r) => ({
          checks: acc.checks + r.checks.total,
          incidents: acc.incidents + r.inc.total,
          critical: acc.critical + r.inc.critica,
          scoreSum: acc.scoreSum + r.score,
        }),
        { checks: 0, incidents: 0, critical: 0, scoreSum: 0 }
      ),
    [summary]
  );
  const avgScore = summary.length ? Math.round(totals.scoreSum / summary.length) : 0;

  const exportRows = () =>
    summary.map((r) => ({
      Codigo: r.branch.code,
      Sucursal: r.branch.name,
      Ciudad: r.branch.city,
      Verificaciones: r.checks.total,
      VerificacionesCompletas: r.checks.finished,
      IncidenciasTotales: r.inc.total,
      Baja: r.inc.baja,
      Media: r.inc.media,
      Alta: r.inc.alta,
      Critica: r.inc.critica,
      ScoreActual: r.score,
    }));

  const handleExportCsv = () => downloadCsv(`reporte_${dateFrom}_${dateTo}.csv`, exportRows());
  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    XLSX.writeFile(wb, `reporte_${dateFrom}_${dateTo}.xlsx`);
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="text-[11px] text-brand uppercase tracking-widest font-semibold mb-1">Reportes</div>
          <h1 className="text-[22px] font-bold tracking-tight">Reporte consolidado por sucursal</h1>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost !text-[12px]" onClick={handleExportCsv}><IconReport /> CSV</button>
          <button className="btn btn-primary !text-[12px]" onClick={handleExportExcel}><IconReport /> Excel</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <SummaryCard label="Sucursales en el reporte" value={summary.length} />
        <SummaryCard label="Verificaciones" value={totals.checks} />
        <SummaryCard label="Incidencias" value={totals.incidents} color="#ffc736" />
        <SummaryCard label="Score promedio" value={avgScore} color={scoreColor(avgScore)} />
      </div>

      <div className="card mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Desde"><input type="date" className="input !w-[150px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></Field>
          <Field label="Hasta"><input type="date" className="input !w-[150px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></Field>
          <Field label="Ciudad">
            <select className="input !w-[180px]" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              <option value="">Todas</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Buscar">
            <div className="relative">
              <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text3" />
              <input className="input !pl-8 !w-[200px]" placeholder="Código, nombre o ciudad…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </Field>
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="datatable">
          <thead>
            <tr><th>Código</th><th>Sucursal</th><th>Ciudad</th><th>Verif.</th><th>Incid.</th><th>Baja</th><th>Media</th><th>Alta</th><th>Crítica</th><th>Score</th><th></th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={11} className="text-center text-text3 py-8">Cargando…</td></tr>}
            {!loading && summary.length === 0 && <tr><td colSpan={11} className="text-center text-text3 py-8">Sin datos para este período.</td></tr>}
            {!loading && summary.map((r) => (
              <tr key={r.branch.id}>
                <td className="font-mono text-text2">{r.branch.code}</td>
                <td>{r.branch.name}</td>
                <td className="text-text3">{r.branch.city}</td>
                <td className="font-mono">{r.checks.total}</td>
                <td className="font-mono">{r.inc.total}</td>
                <td className="font-mono text-text3">{r.inc.baja}</td>
                <td className="font-mono text-amber">{r.inc.media}</td>
                <td className="font-mono text-orange">{r.inc.alta}</td>
                <td className="font-mono text-red">{r.inc.critica}</td>
                <td className="font-mono font-bold" style={{ color: scoreColor(r.score) }}>{r.score}</td>
                <td className="text-right"><Link to={`/score/${r.branch.id}`} className="text-brand text-[11.5px] hover:underline">Ver ficha</Link></td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
        <div className="flex justify-between px-4 py-2.5 text-[11.5px] text-text3">
          <span>Mostrando {summary.length} de {summary.length} sucursales</span>
          <span>Rango: {dateFrom} → {dateTo}</span>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  return (
    <div className="card !py-3">
      <div className="font-mono text-[22px] font-bold" style={color ? { color } : undefined}>{value}</div>
      <div className="text-[11px] text-text3 uppercase tracking-wide mt-0.5">{label}</div>
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
