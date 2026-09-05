import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import Badge from '../components/Badge.jsx';
import {
  STATUS_LABEL, STATUS_BADGE, SEVERITY_LABEL, SEVERITY_BADGE, SEVERITY_WEIGHT,
  fmtDateTime, fmtDuration, downloadCsv,
} from '../lib/format.js';
import { IconSearch, IconReport } from '../components/icons.jsx';

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

const RESULTADOS = [
  { id: 'todas', label: 'Todas' },
  { id: 'en_revision', label: 'En revisión' },
  { id: 'verificada', label: 'Verificada' },
  { id: 'con_incidencia', label: 'Con incidencia' },
];

const GRAVEDADES = [
  { id: 'todas', label: 'Todas' },
  { id: 'baja', label: 'Baja' },
  { id: 'media', label: 'Media' },
  { id: 'alta', label: 'Alta' },
  { id: 'critica', label: 'Crítica' },
];

export default function Historial() {
  const [branches, setBranches] = useState([]);
  const [operators, setOperators] = useState([]);
  const [checks, setChecks] = useState([]);
  const [incByCheck, setIncByCheck] = useState({});
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState(isoDate(new Date(Date.now() - 13 * 86400000)));
  const [dateTo, setDateTo] = useState(isoDate(new Date()));
  const [branchId, setBranchId] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [resultado, setResultado] = useState('todas');
  const [gravedad, setGravedad] = useState('todas');
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('branches').select('id, code, name, city').order('code').then(({ data }) => setBranches(data || []));
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['monitoreo', 'admin'])
      .order('full_name')
      .then(({ data }) => setOperators(data || []));
  }, []);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from('branch_checks')
      .select('*, branches(code, name, city), profiles(full_name)')
      .order('started_at', { ascending: false })
      .limit(500);
    if (dateFrom) q = q.gte('started_at', `${dateFrom}T00:00:00`);
    if (dateTo) q = q.lte('started_at', `${dateTo}T23:59:59`);
    if (branchId) q = q.eq('branch_id', branchId);
    if (operatorId) q = q.eq('operator_id', operatorId);
    if (resultado !== 'todas') q = q.eq('status', resultado);

    let incQ = supabase.from('incidents').select('check_id, severity').is('deleted_at', null);
    if (dateFrom) incQ = incQ.gte('occurred_at', `${dateFrom}T00:00:00`);
    if (dateTo) incQ = incQ.lte('occurred_at', `${dateTo}T23:59:59`);
    if (branchId) incQ = incQ.eq('branch_id', branchId);

    const [{ data: rows, error }, { data: incs }] = await Promise.all([q, incQ]);
    if (error) {
      setChecks([]);
      setLoading(false);
      return;
    }
    const iMap = {};
    (incs || []).forEach((i) => {
      if (!iMap[i.check_id]) iMap[i.check_id] = { count: 0, maxSeverity: null };
      iMap[i.check_id].count += 1;
      if (!iMap[i.check_id].maxSeverity || SEVERITY_WEIGHT[i.severity] > SEVERITY_WEIGHT[iMap[i.check_id].maxSeverity]) {
        iMap[i.check_id].maxSeverity = i.severity;
      }
    });
    setIncByCheck(iMap);
    setChecks(rows || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, branchId, operatorId, resultado]);

  const filtered = useMemo(() => {
    let list = checks.map((c) => ({ ...c, inc: incByCheck[c.id] || { count: 0, maxSeverity: null } }));
    if (gravedad !== 'todas') list = list.filter((c) => c.inc.maxSeverity === gravedad);
    const q = search.trim().toLowerCase();
    if (q && list.length) {
      list = list.filter((c) => {
        const b = c.branches;
        return b && `${b.code} ${b.name} ${b.city}`.toLowerCase().includes(q);
      });
    }
    return list;
  }, [checks, incByCheck, gravedad, search]);

  const exportRows = () =>
    filtered.map((c) => ({
      Fecha: fmtDateTime(c.started_at),
      Sucursal: c.branches ? `${c.branches.code} — ${c.branches.name}` : '—',
      Ciudad: c.branches?.city || '—',
      Operador: c.profiles?.full_name || '—',
      Duracion: fmtDuration(c.duration_seconds),
      Resultado: STATUS_LABEL[c.status] || c.status,
      Incidencias: c.inc.count,
      GravedadMaxima: c.inc.maxSeverity ? SEVERITY_LABEL[c.inc.maxSeverity] : '—',
    }));

  const handleExportCsv = () => downloadCsv(`historial_${dateFrom}_${dateTo}.csv`, exportRows());

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Historial');
    XLSX.writeFile(wb, `historial_${dateFrom}_${dateTo}.xlsx`);
  };

  const totalIncidencias = filtered.reduce((sum, c) => sum + c.inc.count, 0);
  const totalCriticas = filtered.filter((c) => c.inc.maxSeverity === 'critica').length;

  return (
    <div>
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="text-[11px] text-brand uppercase tracking-widest font-semibold mb-1">Historial</div>
          <h1 className="text-[22px] font-bold tracking-tight">Historial de verificaciones</h1>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost !text-[12px]" onClick={handleExportCsv}>
            <IconReport /> Exportar CSV
          </button>
          <button className="btn btn-primary !text-[12px]" onClick={handleExportExcel}>
            <IconReport /> Exportar Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <Kpi label="Verificaciones" value={filtered.length} />
        <Kpi label="Con incidencia" value={filtered.filter((c) => c.status === 'con_incidencia').length} />
        <Kpi label="Incidencias totales" value={totalIncidencias} color="#fbbf24" />
        <Kpi label="Críticas" value={totalCriticas} color="#f87171" />
      </div>

      <div className="card mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Desde">
            <input type="date" className="input !w-[150px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </Field>
          <Field label="Hasta">
            <input type="date" className="input !w-[150px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </Field>
          <Field label="Sucursal">
            <select className="input !w-[200px]" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Todas las sucursales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Operador">
            <select className="input !w-[180px]" value={operatorId} onChange={(e) => setOperatorId(e.target.value)}>
              <option value="">Todos los operadores</option>
              {operators.map((o) => (
                <option key={o.id} value={o.id}>{o.full_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Buscar">
            <div className="relative">
              <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text3" />
              <input className="input !pl-8 !w-[200px]" placeholder="Código, nombre o ciudad…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </Field>
        </div>

        <div className="flex flex-wrap gap-4 mt-3.5 pt-3.5 border-t border-bordersoft">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11.5px] text-text3 mr-1">Resultado</span>
            {RESULTADOS.map((r) => (
              <Chip key={r.id} active={resultado === r.id} onClick={() => setResultado(r.id)} label={r.label} />
            ))}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11.5px] text-text3 mr-1">Gravedad</span>
            {GRAVEDADES.map((g) => (
              <Chip key={g.id} active={gravedad === g.id} onClick={() => setGravedad(g.id)} label={g.label} />
            ))}
          </div>
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <table className="datatable">
          <thead>
            <tr>
              <th>Fecha</th><th>Sucursal</th><th>Ciudad</th><th>Operador</th>
              <th>Duración</th><th>Resultado</th><th>Incidencias</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="text-center text-text3 py-8">Cargando…</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center text-text3 py-8">No hay verificaciones para este filtro.</td></tr>
            )}
            {!loading && filtered.slice(0, 60).map((c) => (
              <tr key={c.id}>
                <td className="font-mono text-text3">{fmtDateTime(c.started_at)}</td>
                <td>{c.branches ? `${c.branches.code} — ${c.branches.name}` : '—'}</td>
                <td className="text-text3">{c.branches?.city || '—'}</td>
                <td>{c.profiles?.full_name || '—'}</td>
                <td className="font-mono text-text3">{fmtDuration(c.duration_seconds)}</td>
                <td><Badge className={STATUS_BADGE[c.status]}>{STATUS_LABEL[c.status]}</Badge></td>
                <td>
                  {c.inc.count > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono">{c.inc.count}</span>
                      <Badge className={SEVERITY_BADGE[c.inc.maxSeverity]}>{SEVERITY_LABEL[c.inc.maxSeverity]}</Badge>
                    </div>
                  ) : (
                    <span className="text-text3">—</span>
                  )}
                </td>
                <td className="text-right">
                  {c.branch_id && <Link to={`/score/${c.branch_id}`} className="text-brand text-[11.5px] hover:underline">Ver sucursal</Link>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between px-4 py-2.5 text-[11.5px] text-text3">
          <span>Mostrando {Math.min(60, filtered.length)} de {filtered.length} verificaciones</span>
          <span>Rango: {dateFrom} → {dateTo}</span>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }) {
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
