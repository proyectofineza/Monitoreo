import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { scoreColor } from '../lib/format.js';

const SORTS = [
  { id: 'score_desc', label: 'Mejor score' },
  { id: 'score_asc', label: 'Peor score' },
  { id: 'incid', label: 'Más incidencias' },
  { id: 'criticas', label: 'Más críticas' },
  { id: 'deterioro', label: 'Mayor deterioro' },
  { id: 'mejora', label: 'Mayor mejora' },
];

export default function Ranking() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('score_desc');
  const [avg, setAvg] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: scores }, { data: trend }] = await Promise.all([
        supabase.from('branch_scores').select('*, branches(code, name, city)'),
        supabase.from('branch_score_latest').select('*'),
      ]);
      const trendMap = {};
      (trend || []).forEach((t) => (trendMap[t.branch_id] = t));
      const merged = (scores || [])
        .filter((s) => s.branches)
        .map((s) => {
          const t = trendMap[s.branch_id];
          const variacion = t && t.prev_score != null ? t.score - t.prev_score : 0;
          return { ...s, variacion };
        });
      setRows(merged);
      if (merged.length) setAvg(Math.round(merged.reduce((sum, r) => sum + r.score, 0) / merged.length));
      setLoading(false);
    })();
  }, []);

  const sorted = useMemo(() => {
    const list = [...rows];
    if (sort === 'score_desc') list.sort((a, b) => b.score - a.score);
    if (sort === 'score_asc') list.sort((a, b) => a.score - b.score);
    if (sort === 'incid') list.sort((a, b) => b.total_incidents - a.total_incidents);
    if (sort === 'criticas') list.sort((a, b) => b.critical_incidents - a.critical_incidents);
    if (sort === 'deterioro') list.sort((a, b) => a.variacion - b.variacion);
    if (sort === 'mejora') list.sort((a, b) => b.variacion - a.variacion);
    return list;
  }, [rows, sort]);

  const top10Problem = useMemo(() => [...rows].sort((a, b) => a.score - b.score).slice(0, 4), [rows]);

  return (
    <div>
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="text-[11px] text-brand uppercase tracking-widest font-semibold mb-1">Score / Ranking</div>
          <h1 className="text-[22px] font-bold tracking-tight">Ranking de cumplimiento</h1>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3.5 flex-wrap">
        <span className="text-[11.5px] text-text3 mr-1">Ordenar por</span>
        {SORTS.map((s) => (
          <div
            key={s.id}
            onClick={() => setSort(s.id)}
            className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border cursor-pointer ${sort === s.id ? 'bg-brandsoft border-brand text-brand' : 'bg-surface border-border text-text2'}`}
          >
            {s.label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="datatable">
            <thead>
              <tr><th>#</th><th>Sucursal</th><th>Ciudad</th><th>Score</th><th>Incid.</th><th>Críticas</th><th>Tendencia</th></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="text-center text-text3 py-8">Cargando…</td></tr>}
              {!loading && sorted.map((r, idx) => (
                <tr key={r.branch_id} className="cursor-pointer" onClick={() => navigate(`/score/${r.branch_id}`)}>
                  <td className={`font-mono ${idx < 3 ? 'text-amber' : 'text-text3'}`}>{idx + 1}</td>
                  <td>Suc. {r.branches.code} — {r.branches.name}</td>
                  <td className="text-text3">{r.branches.city}</td>
                  <td className="font-mono font-bold" style={{ color: scoreColor(r.score) }}>{r.score}</td>
                  <td className="font-mono">{r.total_incidents}</td>
                  <td className="font-mono text-red">{r.critical_incidents}</td>
                  <td className={`font-mono text-[12px] font-semibold ${r.variacion > 1 ? 'text-green' : r.variacion < -1 ? 'text-red' : 'text-text3'}`}>
                    {r.variacion > 1 ? '↑' : r.variacion < -1 ? '↓' : '→'} {r.variacion > 0 ? '+' : ''}{r.variacion}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="text-sm font-semibold mb-1">Score promedio de la red</div>
            <div className="flex items-baseline gap-2 mt-1">
              <div className="text-3xl font-bold font-mono">{avg ?? '—'}</div>
            </div>
            <div className="text-[11.5px] text-text3 mt-1">{rows.length} sucursales con score calculado</div>
          </div>
          <div className="card">
            <div className="text-sm font-semibold mb-1">⚠️ Sucursales que requieren atención</div>
            <div className="text-[11.5px] text-text3 mb-3">Las 4 de menor score</div>
            {top10Problem.map((r) => (
              <div key={r.branch_id} className="flex justify-between py-2 border-b border-bordersoft last:border-none text-[12.8px] cursor-pointer" onClick={() => navigate(`/score/${r.branch_id}`)}>
                <span>Suc. {r.branches.code} — {r.branches.city}</span>
                <span className="font-mono font-bold" style={{ color: scoreColor(r.score) }}>{r.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
