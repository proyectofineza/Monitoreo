import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/auth.jsx';
import Badge from '../components/Badge.jsx';
import { STATUS_LABEL, STATUS_BADGE, fmtRelative, SEVERITY_WEIGHT } from '../lib/format.js';
import { IconSearch } from '../components/icons.jsx';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

export default function Monitoreo() {
  const navigate = useNavigate();
  const { profile, role } = useAuth();
  const [branches, setBranches] = useState([]);
  const [todayMap, setTodayMap] = useState({});
  const [lastMap, setLastMap] = useState({});
  const [profilesMap, setProfilesMap] = useState({});
  const [incByBranch, setIncByBranch] = useState({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pendientes');
  const [estado, setEstado] = useState('todas');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const [{ data: br }, { data: today }, { data: last }, { data: profs }, { data: inc }] = await Promise.all([
      supabase.from('branches').select('*').eq('active', true).order('code'),
      supabase.from('branch_today_check').select('*'),
      supabase.from('branch_last_check').select('*'),
      supabase.from('profiles').select('id, full_name'),
      supabase.from('incidents').select('branch_id, severity').gte('occurred_at', startOfToday()).is('deleted_at', null),
    ]);
    setBranches(br || []);
    const tMap = {};
    (today || []).forEach((c) => (tMap[c.branch_id] = c));
    setTodayMap(tMap);
    const lMap = {};
    (last || []).forEach((c) => (lMap[c.branch_id] = c));
    setLastMap(lMap);
    const pMap = {};
    (profs || []).forEach((p) => (pMap[p.id] = p.full_name));
    setProfilesMap(pMap);
    const iMap = {};
    (inc || []).forEach((i) => {
      if (!iMap[i.branch_id]) iMap[i.branch_id] = { count: 0, maxSeverity: null };
      iMap[i.branch_id].count += 1;
      if (!iMap[i.branch_id].maxSeverity || SEVERITY_WEIGHT[i.severity] > SEVERITY_WEIGHT[iMap[i.branch_id].maxSeverity]) {
        iMap[i.branch_id].maxSeverity = i.severity;
      }
    });
    setIncByBranch(iMap);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo(() => {
    return branches.map((b) => {
      const today = todayMap[b.id];
      const last = lastMap[b.id];
      let status = 'pendiente';
      if (today) status = today.finished_at ? today.status : 'en_revision';
      return {
        branch: b,
        status,
        check: today,
        lastLabel: today
          ? null
          : last
          ? fmtRelative(last.finished_at)
          : 'Sin registro',
        operatorName: today ? profilesMap[today.operator_id] : null,
        incInfo: incByBranch[b.id] || { count: 0, maxSeverity: null },
      };
    });
  }, [branches, todayMap, lastMap, profilesMap, incByBranch]);

  const base = useMemo(
    () => rows.filter((r) => (tab === 'pendientes' ? ['pendiente', 'en_revision'].includes(r.status) : ['verificada', 'con_incidencia'].includes(r.status))),
    [rows, tab]
  );

  const counts = useMemo(() => {
    const c = { todas: base.length };
    ['pendiente', 'en_revision', 'verificada', 'con_incidencia'].forEach((s) => {
      c[s] = base.filter((r) => r.status === s).length;
    });
    return c;
  }, [base]);

  const filtered = useMemo(() => {
    let list = base;
    if (estado !== 'todas') list = list.filter((r) => r.status === estado);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((r) => `${r.branch.code} ${r.branch.name} ${r.branch.city}`.toLowerCase().includes(q));
    return list;
  }, [base, estado, search]);

  const canOperate = role === 'monitoreo' || role === 'admin';

  const startCheck = async (branchId, existingCheckId) => {
    if (existingCheckId) {
      navigate(`/monitoreo/${branchId}`);
      return;
    }
    const { data, error } = await supabase
      .from('branch_checks')
      .insert({ branch_id: branchId, operator_id: profile.id })
      .select()
      .single();
    if (error) {
      alert('No se pudo iniciar la verificación: ' + error.message);
      return;
    }
    navigate(`/monitoreo/${branchId}`, { state: { checkId: data.id } });
  };

  const verifiedToday = rows.filter((r) => ['verificada', 'con_incidencia'].includes(r.status)).length;

  return (
    <div>
      <div className="flex items-end justify-between mb-5">
        <div>
          <div className="text-[11px] text-brand uppercase tracking-widest font-semibold mb-1">Monitoreo</div>
          <h1 className="text-[22px] font-bold tracking-tight">Sucursales</h1>
        </div>
        <div className="text-[12px] text-text3">
          {verifiedToday} / {branches.length} verificadas hoy · {branches.length ? Math.round((verifiedToday / branches.length) * 100) : 0}%
        </div>
      </div>

      <div className="flex gap-1 bg-surface border border-border rounded-[10px] p-1 w-fit mb-4">
        <div onClick={() => { setTab('pendientes'); setEstado('todas'); }} className={`px-4 py-2 rounded-[7px] text-[12.5px] font-semibold cursor-pointer ${tab === 'pendientes' ? 'bg-brand text-white' : 'text-text2'}`}>
          Pendientes
        </div>
        <div onClick={() => { setTab('historial'); setEstado('todas'); }} className={`px-4 py-2 rounded-[7px] text-[12.5px] font-semibold cursor-pointer ${tab === 'historial' ? 'bg-brand text-white' : 'text-text2'}`}>
          Historial de hoy
        </div>
      </div>

      <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-[320px]">
          <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text3" />
          <input className="input !pl-8" placeholder="Buscar por código, nombre o ciudad…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Chip active={estado === 'todas'} onClick={() => setEstado('todas')} label={`Todas ${counts.todas}`} />
          {tab === 'pendientes' && (
            <>
              <Chip active={estado === 'pendiente'} onClick={() => setEstado('pendiente')} label={`Pendiente ${counts.pendiente}`} />
              <Chip active={estado === 'en_revision'} onClick={() => setEstado('en_revision')} label={`En revisión ${counts.en_revision}`} />
            </>
          )}
          {tab === 'historial' && (
            <>
              <Chip active={estado === 'verificada'} onClick={() => setEstado('verificada')} label={`Verificada ${counts.verificada}`} />
              <Chip active={estado === 'con_incidencia'} onClick={() => setEstado('con_incidencia')} label={`Con incidencia ${counts.con_incidencia}`} />
            </>
          )}
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <table className="datatable">
          <thead>
            {tab === 'pendientes' ? (
              <tr><th>Código</th><th>Sucursal</th><th>Ciudad</th><th>Estado</th><th>Última revisión</th><th></th></tr>
            ) : (
              <tr><th>Código</th><th>Sucursal</th><th>Operador</th><th>Resultado</th><th>Incidencias</th><th>Hora inicio</th></tr>
            )}
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="text-center text-text3 py-8">Cargando…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center text-text3 py-8">No hay sucursales para este filtro.</td></tr>
            )}
            {!loading && filtered.slice(0, 40).map((r) => (
              <tr key={r.branch.id}>
                <td className="font-mono text-text2">{r.branch.code}</td>
                <td>{r.branch.name}</td>
                {tab === 'pendientes' ? (
                  <>
                    <td className="text-text3">{r.branch.city}</td>
                    <td><Badge className={STATUS_BADGE[r.status]} pulse={r.status === 'pendiente'}>{STATUS_LABEL[r.status]}</Badge></td>
                    <td className="font-mono text-text3">{r.lastLabel ?? '—'}</td>
                    <td className="text-right">
                      {canOperate && (
                        <button className="btn btn-primary !py-1.5 !px-3 !text-[11.5px]" onClick={() => startCheck(r.branch.id, r.check?.check_id)}>
                          {r.status === 'en_revision' ? 'Continuar' : 'Iniciar revisión'}
                        </button>
                      )}
                    </td>
                  </>
                ) : (
                  <>
                    <td>{r.operatorName || '—'}</td>
                    <td><Badge className={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</Badge></td>
                    <td className="font-mono">{r.incInfo.count}</td>
                    <td className="font-mono text-text3">{r.check ? new Date(r.check.started_at).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between px-4 py-2.5 text-[11.5px] text-text3">
          <span>Mostrando {Math.min(40, filtered.length)} de {filtered.length} sucursales</span>
          <span>Red completa: {branches.length} sucursales</span>
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, label }) {
  return (
    <div
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border cursor-pointer ${
        active ? 'bg-brandsoft border-brand text-brand' : 'bg-surface border-border text-text2'
      }`}
    >
      {label}
    </div>
  );
}
