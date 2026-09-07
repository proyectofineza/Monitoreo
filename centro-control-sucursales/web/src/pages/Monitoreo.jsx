import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/auth.jsx';
import { STATUS_LABEL, fmtRelative, SEVERITY_WEIGHT } from '../lib/format.js';
import { IconSearch } from '../components/icons.jsx';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

// Colores del panal — mismos códigos de color que se usan en el resto de la app
// para cada estado (ver STATUS_BADGE en lib/format.js).
const STATUS_FILL = {
  pendiente: '#ff5468',
  en_revision: '#ffc736',
  verificada: '#22e2a0',
  con_incidencia: '#ff8a3d',
};

// Tamaño de cada celda hexagonal y geometría del panal.
const HEX_W = 96;
const HEX_H = 110;
const GAP = 7;
const OVERLAP = HEX_H * 0.25;
const STEP = HEX_H - OVERLAP;
const COL_OFFSET = STEP / 2;

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
        lastLabel: today ? null : last ? fmtRelative(last.finished_at) : 'Sin registro',
        operatorName: today ? profilesMap[today.operator_id] : null,
        startedAt: today ? today.started_at : null,
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
  const canOpenScore = role === 'admin' || role === 'supervisor';

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
        <div className="ml-auto flex gap-3.5 text-[11px] text-text3 flex-wrap">
          <LegendDot color={STATUS_FILL.pendiente} label="Pendiente" />
          <LegendDot color={STATUS_FILL.en_revision} label="En revisión" />
          <LegendDot color={STATUS_FILL.verificada} label="Verificada" />
          <LegendDot color={STATUS_FILL.con_incidencia} label="Con incidencia" />
        </div>
      </div>

      <div className="card">
        {loading && <div className="text-center text-text3 py-10 text-sm">Cargando…</div>}
        {!loading && filtered.length === 0 && (
          <div className="text-center text-text3 py-10 text-sm">No hay sucursales para este filtro.</div>
        )}
        {!loading && filtered.length > 0 && (
          <HoneycombGrid
            rows={filtered}
            tab={tab}
            canOperate={canOperate}
            canOpenScore={canOpenScore}
            onOperate={(r) => startCheck(r.branch.id, r.check?.check_id)}
            onOpenScore={(r) => navigate(`/score/${r.branch.id}`)}
          />
        )}
        <div className="flex justify-between px-1 pt-3 mt-1 border-t border-bordersoft text-[11.5px] text-text3">
          <span>Mostrando {filtered.length} de {filtered.length} sucursales{estado !== 'todas' || search ? ' (filtradas)' : ''}</span>
          <span>Red completa: {branches.length} sucursales</span>
        </div>
      </div>
    </div>
  );
}

function HoneycombGrid({ rows, tab, canOperate, canOpenScore, onOperate, onOpenScore }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setWidth(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const numColumns = Math.max(1, Math.floor((width + GAP) / (HEX_W + GAP)) || 1);

  const columns = useMemo(() => {
    const cols = Array.from({ length: numColumns }, () => []);
    rows.forEach((r, i) => cols[i % numColumns].push(r));
    return cols;
  }, [rows, numColumns]);

  const clickable = tab === 'pendientes' ? canOperate : canOpenScore;

  return (
    <div ref={containerRef} className="flex justify-center" style={{ gap: GAP }}>
      {columns.map((col, ci) => (
        <div key={ci} style={{ width: HEX_W }}>
          {col.map((r, ri) => (
            <HexCell
              key={r.branch.id}
              r={r}
              tab={tab}
              clickable={clickable}
              marginTop={ri === 0 ? (ci % 2 === 1 ? COL_OFFSET : 0) : -OVERLAP}
              onClick={() => {
                if (!clickable) return;
                if (tab === 'pendientes') onOperate(r);
                else onOpenScore(r);
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function HexCell({ r, tab, clickable, marginTop, onClick }) {
  const [hover, setHover] = useState(false);
  const fill = STATUS_FILL[r.status];

  return (
    <div
      className={`relative ${r.status === 'pendiente' ? 'animate-breathe' : ''}`}
      style={{
        width: HEX_W,
        height: HEX_H,
        marginTop,
        clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
        background: fill,
        cursor: clickable ? 'pointer' : 'default',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      <div className="w-full h-full flex flex-col items-center justify-center px-2.5 transition-transform duration-150" style={{ transform: hover ? 'scale(1.08)' : 'scale(1)' }}>
        <span className="font-mono font-bold text-[13px] leading-none" style={{ color: '#0a0e14' }}>
          {r.branch.code}
        </span>
        <span className="text-[8.5px] font-semibold leading-tight text-center mt-1 truncate max-w-full" style={{ color: 'rgba(10,14,20,.72)' }}>
          {r.branch.city}
        </span>
      </div>

      {hover && (
        <div
          className="absolute z-20 bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 bg-surface2 border border-border rounded-lg px-3 py-2 text-[11.5px] whitespace-nowrap shadow-lg pointer-events-none"
          style={{ color: '#e8ecf2' }}
        >
          <div className="font-semibold mb-0.5">Suc. {r.branch.code} — {r.branch.name}</div>
          <div className="text-text3 mb-1">{r.branch.city}</div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: fill }} />
            <span>{STATUS_LABEL[r.status]}</span>
          </div>
          {tab === 'pendientes' ? (
            <div className="text-text3 mt-0.5">Última revisión: {r.lastLabel ?? '—'}</div>
          ) : (
            <>
              <div className="text-text3 mt-0.5">Operador: {r.operatorName || '—'}</div>
              <div className="text-text3">Incidencias: {r.incInfo.count}</div>
              <div className="text-text3">
                Hora inicio: {r.startedAt ? new Date(r.startedAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }) : '—'}
              </div>
            </>
          )}
          {clickable && (
            <div className="text-brand font-semibold mt-1">{tab === 'pendientes' ? (r.status === 'en_revision' ? 'Click para continuar →' : 'Click para iniciar revisión →') : 'Click para ver ficha →'}</div>
          )}
        </div>
      )}
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

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full flex-none" style={{ background: color }} />
      {label}
    </div>
  );
}
