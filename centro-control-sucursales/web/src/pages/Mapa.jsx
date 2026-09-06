import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabaseClient.js';
import { scoreColor, scoreLabel } from '../lib/format.js';

const ESTADOS = [
  { id: 'todas', label: 'Todas' },
  { id: 'buen_estado', label: 'Buen estado' },
  { id: 'atencion', label: 'Atención' },
  { id: 'critico', label: 'Requiere atención' },
];

function estadoOf(score) {
  if (score >= 80) return 'buen_estado';
  if (score >= 60) return 'atencion';
  return 'critico';
}

export default function Mapa() {
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [scoresMap, setScoresMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('todas');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: br }, { data: sc }] = await Promise.all([
        supabase.from('branches').select('*').eq('active', true).not('lat', 'is', null).not('lng', 'is', null),
        supabase.from('branch_scores').select('*'),
      ]);
      setBranches(br || []);
      const sMap = {};
      (sc || []).forEach((s) => (sMap[s.branch_id] = s));
      setScoresMap(sMap);
      setLoading(false);
    })();
  }, []);

  const cities = useMemo(() => [...new Set(branches.map((b) => b.city))].sort(), [branches]);

  const filtered = useMemo(() => {
    let list = branches;
    if (cityFilter) list = list.filter((b) => b.city === cityFilter);
    if (estadoFilter !== 'todas') list = list.filter((b) => estadoOf(scoresMap[b.id]?.score ?? 100) === estadoFilter);
    return list;
  }, [branches, cityFilter, estadoFilter, scoresMap]);

  const center = useMemo(() => {
    if (filtered.length === 0) return [-25.3, -57.63];
    const lat = filtered.reduce((s, b) => s + b.lat, 0) / filtered.length;
    const lng = filtered.reduce((s, b) => s + b.lng, 0) / filtered.length;
    return [lat, lng];
  }, [filtered]);

  const counts = useMemo(() => {
    const c = { buen_estado: 0, atencion: 0, critico: 0 };
    branches.forEach((b) => (c[estadoOf(scoresMap[b.id]?.score ?? 100)] += 1));
    return c;
  }, [branches, scoresMap]);

  return (
    <div>
      <div className="mb-4">
        <div className="text-[11px] text-brand uppercase tracking-widest font-semibold mb-1">Mapa</div>
        <h1 className="text-[22px] font-bold tracking-tight">Mapa de sucursales</h1>
      </div>

      <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
        <select className="input !w-[190px]" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
          <option value="">Todas las ciudades</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex gap-1.5 flex-wrap">
          {ESTADOS.map((e) => (
            <div
              key={e.id}
              onClick={() => setEstadoFilter(e.id)}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border cursor-pointer ${estadoFilter === e.id ? 'bg-brandsoft border-brand text-brand' : 'bg-surface border-border text-text2'}`}
            >
              {e.label}
            </div>
          ))}
        </div>
        <div className="ml-auto flex gap-4 text-[11.5px] text-text3">
          <LegendDot color="#22e2a0" label={`Buen estado (${counts.buen_estado})`} />
          <LegendDot color="#ff8a3d" label={`Atención (${counts.atencion})`} />
          <LegendDot color="#ff5468" label={`Requiere atención (${counts.critico})`} />
        </div>
      </div>

      <div className="card !p-0 overflow-hidden" style={{ height: 560 }}>
        {loading ? (
          <div className="text-text3 text-sm py-10 text-center">Cargando mapa…</div>
        ) : (
          <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%', background: '#10161f' }} scrollWheelZoom>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            />
            {filtered.map((b) => {
              const score = scoresMap[b.id]?.score ?? 100;
              const color = scoreColor(score);
              return (
                <CircleMarker
                  key={b.id}
                  center={[b.lat, b.lng]}
                  radius={9}
                  pathOptions={{ color: '#0a0e14', weight: 1.5, fillColor: color, fillOpacity: 0.9 }}
                >
                  <Popup>
                    <div style={{ fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12.5, minWidth: 160 }}>
                      <div style={{ fontWeight: 700, marginBottom: 2 }}>Suc. {b.code} — {b.name}</div>
                      <div style={{ color: '#666', marginBottom: 6 }}>{b.city}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span>Score</span>
                        <span style={{ fontWeight: 700, color, fontFamily: 'IBM Plex Mono, monospace' }}>{score}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>{scoreLabel(score)}</div>
                      <button
                        onClick={() => navigate(`/score/${b.id}`)}
                        style={{ background: '#5b6bff', color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', width: '100%' }}
                      >
                        Ver ficha de sucursal
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        )}
      </div>
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
