import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { scoreColor, scoreLabel, scoreBadgeClass, SEVERITY_LABEL, SEVERITY_BADGE, fmtDateTime } from '../lib/format.js';
import Badge from '../components/Badge.jsx';

export default function Score() {
  const { branchId } = useParams();
  const [branch, setBranch] = useState(null);
  const [score, setScore] = useState(null);
  const [history, setHistory] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [avg, setAvg] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: b }, { data: s }, { data: hist }, { data: incs }, { data: allScores }, { data: settings }] = await Promise.all([
        supabase.from('branches').select('*').eq('id', branchId).single(),
        supabase.from('branch_scores').select('*').eq('branch_id', branchId).maybeSingle(),
        supabase.from('score_history').select('*').eq('branch_id', branchId).order('recorded_at', { ascending: true }).limit(40),
        supabase.from('incidents_detailed').select('*').eq('branch_id', branchId).order('occurred_at', { ascending: false }).limit(8),
        supabase.from('branch_scores').select('score'),
        supabase.from('settings').select('value').eq('key', 'score_formula').single(),
      ]);
      setBranch(b || null);
      setScore(s || null);
      setHistory(hist || []);
      setIncidents(incs || []);
      if (allScores?.length) setAvg(Math.round(allScores.reduce((sum, r) => sum + r.score, 0) / allScores.length));

      const formula = settings?.value || { baja: 2, media: 5, alta: 10, critica: 20, recurrencia_umbral_dias: 30, recurrencia_penalizacion: 6 };
      const since = new Date(Date.now() - (formula.recurrencia_umbral_dias || 30) * 86400000).toISOString();
      const { data: recent } = await supabase.from('incidents').select('severity').eq('branch_id', branchId).is('deleted_at', null).gte('occurred_at', since);
      const counts = { baja: 0, media: 0, alta: 0, critica: 0 };
      (recent || []).forEach((i) => (counts[i.severity] += 1));
      setBreakdown({
        counts,
        pts: {
          baja: counts.baja * (formula.baja ?? 2),
          media: counts.media * (formula.media ?? 5),
          alta: counts.alta * (formula.alta ?? 10),
          critica: counts.critica * (formula.critica ?? 20),
        },
        recurrencia: (recent || []).length > 5 ? (formula.recurrencia_penalizacion ?? 6) : 0,
      });
      setLoading(false);
    })();
  }, [branchId]);

  if (loading) return <div className="text-text3 text-sm py-10 text-center">Cargando…</div>;
  if (!branch) return <div className="text-text3 text-sm py-10 text-center">Sucursal no encontrada.</div>;

  const s = score?.score ?? 100;
  const color = scoreColor(s);
  const circumference = 2 * Math.PI * 54;
  const dash = `${(s / 100 * circumference).toFixed(1)} ${circumference.toFixed(1)}`;

  const min = Math.min(...history.map((h) => h.score), s);
  const max = Math.max(...history.map((h) => h.score), s);
  const norm = (v) => 108 - ((v - min) / Math.max(1, max - min)) * 84;
  const points = history.length > 1
    ? history.map((h, i) => `${(i * (400 / (history.length - 1))).toFixed(0)},${norm(h.score).toFixed(1)}`).join(' ')
    : `0,${norm(s)} 400,${norm(s)}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] text-brand uppercase tracking-widest font-semibold mb-1">Score / Ranking</div>
          <h1 className="text-[22px] font-bold tracking-tight">Ficha de sucursal</h1>
        </div>
        <Link to="/ranking" className="text-brand text-[12.5px] hover:underline">← Volver al ranking</Link>
      </div>

      <div className="grid grid-cols-[.9fr_1.4fr_1fr] gap-4 mb-4 items-stretch">
        <div className="card flex flex-col items-center text-center">
          <svg width="130" height="130" viewBox="0 0 130 130">
            <circle cx="65" cy="65" r="54" fill="none" stroke="#1c2430" strokeWidth="12" />
            <circle cx="65" cy="65" r="54" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={dash} transform="rotate(-90 65 65)" />
            <text x="65" y="60" textAnchor="middle" fontSize="34" fontWeight="700" fill="#e8ecf2" fontFamily="IBM Plex Mono, monospace">{s}</text>
            <text x="65" y="80" textAnchor="middle" fontSize="10.5" fill="#5a6474">de 100</text>
          </svg>
          <div className="text-[11.5px] text-text3 mt-0.5">{branch.name} — {branch.city}</div>
          <div className="mt-3"><Badge className={scoreBadgeClass(s)}>{scoreLabel(s)}</Badge></div>
          <div className="grid grid-cols-3 gap-2.5 mt-4 w-full">
            <Stat label="Verific." value={score?.total_checks ?? 0} />
            <Stat label="Incid." value={score?.total_incidents ?? 0} color="#fbbf24" />
            <Stat label="Críticas" value={score?.critical_incidents ?? 0} color="#f87171" />
          </div>
        </div>

        <div className="card">
          <div className="text-sm font-semibold mb-1">Evolución del Score</div>
          <div className="text-[11.5px] text-text3 mb-3">Últimos {history.length} puntos registrados</div>
          <svg viewBox="0 0 400 130" width="100%" height="150" preserveAspectRatio="none">
            <line x1="0" y1="32" x2="400" y2="32" stroke="#232c3a" strokeDasharray="3,4" />
            <line x1="0" y1="98" x2="400" y2="98" stroke="#232c3a" strokeDasharray="3,4" />
            <polyline points={points} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="text-sm font-semibold mt-2 mb-2">Comparación vs. promedio de la empresa</div>
          <div className="flex items-center justify-center gap-6">
            <div className="text-center"><div className="text-2xl font-bold font-mono" style={{ color }}>{s}</div><div className="text-[10.5px] text-text3 mt-0.5">Esta sucursal</div></div>
            <div className="text-text3 text-xs">vs.</div>
            <div className="text-center"><div className="text-2xl font-bold font-mono">{avg ?? '—'}</div><div className="text-[10.5px] text-text3 mt-0.5">Promedio general</div></div>
          </div>
        </div>

        <div className="card">
          <div className="text-sm font-semibold mb-1">Cálculo del Score</div>
          <div className="text-[11.5px] text-text3 mb-3">Fórmula configurable — ventana de recurrencia</div>
          {breakdown && (
            <>
              <FormulaRow label="Base inicial" value="100" />
              <FormulaRow label={`Incidencias bajas (${breakdown.counts.baja})`} value={`-${breakdown.pts.baja}`} />
              <FormulaRow label={`Incidencias medias (${breakdown.counts.media})`} value={`-${breakdown.pts.media}`} />
              <FormulaRow label={`Incidencias altas (${breakdown.counts.alta})`} value={`-${breakdown.pts.alta}`} />
              <FormulaRow label={`Incidencias críticas (${breakdown.counts.critica})`} value={`-${breakdown.pts.critica}`} />
              <FormulaRow label="Recurrencia" value={`-${breakdown.recurrencia}`} />
              <div className="flex justify-between pt-3 mt-1 border-t border-border">
                <span className="font-semibold">Score final</span>
                <span className="font-mono font-bold text-[15px]" style={{ color }}>{s}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="text-sm font-semibold mb-1">Historial de incidencias — {branch.name}</div>
        <div className="text-[11.5px] text-text3 mb-3">Origen del Score actual</div>
        {incidents.length === 0 && <div className="text-text3 text-sm py-4 text-center">Sin incidencias registradas.</div>}
        {incidents.map((h) => (
          <div key={h.id} className="flex justify-between items-center py-2.5 border-b border-bordersoft last:border-none text-[12.8px]">
            <div>
              <div>{h.type_label}</div>
              <div className="text-text3 text-[11px] mt-0.5">{fmtDateTime(h.occurred_at)} · {h.operator_name || '—'}</div>
            </div>
            <Badge className={SEVERITY_BADGE[h.severity]}>{SEVERITY_LABEL[h.severity]}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="bg-surface2 border border-border rounded-[9px] p-2.5 text-center">
      <div className="font-mono text-[17px] font-bold" style={color ? { color } : undefined}>{value}</div>
      <div className="text-[9.5px] text-text3 uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}

function FormulaRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-bordersoft text-[12.5px]">
      <span className="text-text2">{label}</span>
      <span className="font-mono text-red">{value}</span>
    </div>
  );
}
