import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import Badge from '../components/Badge.jsx';
import { fmtDateTime } from '../lib/format.js';
import { IconSearch } from '../components/icons.jsx';

const TABLES = [
  { id: 'todas', label: 'Todas' },
  { id: 'branches', label: 'Sucursales' },
  { id: 'incidents', label: 'Incidencias' },
  { id: 'branch_checks', label: 'Verificaciones' },
  { id: 'incident_types', label: 'Tipos de incidencia' },
  { id: 'employees', label: 'Empleados' },
  { id: 'settings', label: 'Configuración' },
];

const ACTION_BADGE = { INSERT: 'badge-green', UPDATE: 'badge-amber', DELETE: 'badge-red' };
const ACTION_LABEL = { INSERT: 'Creación', UPDATE: 'Edición', DELETE: 'Eliminación' };

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export default function Auditoria() {
  const [logs, setLogs] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState('todas');
  const [dateFrom, setDateFrom] = useState(isoDate(new Date(Date.now() - 13 * 86400000)));
  const [dateTo, setDateTo] = useState(isoDate(new Date()));
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from('audit_logs').select('*').order('changed_at', { ascending: false }).limit(300);
    if (dateFrom) q = q.gte('changed_at', `${dateFrom}T00:00:00`);
    if (dateTo) q = q.lte('changed_at', `${dateTo}T23:59:59`);
    if (table !== 'todas') q = q.eq('table_name', table);
    const [{ data: rows }, { data: profs }] = await Promise.all([q, supabase.from('profiles').select('id, full_name')]);
    setLogs(rows || []);
    const pMap = {};
    (profs || []).forEach((p) => (pMap[p.id] = p.full_name));
    setProfilesMap(pMap);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => `${l.table_name} ${l.record_id} ${l.action}`.toLowerCase().includes(q));
  }, [logs, search]);

  return (
    <div>
      <div className="mb-4">
        <div className="text-[11px] text-brand uppercase tracking-widest font-semibold mb-1">Administración</div>
        <h1 className="text-[22px] font-bold tracking-tight">Auditoría</h1>
      </div>

      <div className="card mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Desde"><input type="date" className="input !w-[150px]" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></Field>
          <Field label="Hasta"><input type="date" className="input !w-[150px]" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></Field>
          <Field label="Buscar">
            <div className="relative">
              <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text3" />
              <input className="input !pl-8 !w-[220px]" placeholder="Tabla o ID de registro…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </Field>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mt-3.5 pt-3.5 border-t border-bordersoft">
          <span className="text-[11.5px] text-text3 mr-1">Tabla</span>
          {TABLES.map((t) => (
            <div
              key={t.id}
              onClick={() => setTable(t.id)}
              className={`px-3 py-1 rounded-full text-[11.5px] font-semibold border cursor-pointer ${table === t.id ? 'bg-brandsoft border-brand text-brand' : 'bg-surface border-border text-text2'}`}
            >
              {t.label}
            </div>
          ))}
        </div>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="datatable">
          <thead><tr><th>Fecha</th><th>Tabla</th><th>Acción</th><th>Registro</th><th>Usuario</th><th></th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="text-center text-text3 py-8">Cargando…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} className="text-center text-text3 py-8">Sin eventos para este filtro.</td></tr>}
            {!loading && filtered.map((l) => (
              <React.Fragment key={l.id}>
                <tr>
                  <td className="font-mono text-text3">{fmtDateTime(l.changed_at)}</td>
                  <td className="font-mono">{l.table_name}</td>
                  <td><Badge className={ACTION_BADGE[l.action] || 'badge-neutral'}>{ACTION_LABEL[l.action] || l.action}</Badge></td>
                  <td className="font-mono text-text3 text-[11px]">{l.record_id.slice(0, 8)}…</td>
                  <td>{profilesMap[l.changed_by] || 'Sistema'}</td>
                  <td className="text-right">
                    <button className="text-brand text-[11.5px] hover:underline" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                      {expanded === l.id ? 'Ocultar' : 'Ver detalle'}
                    </button>
                  </td>
                </tr>
                {expanded === l.id && (
                  <tr>
                    <td colSpan={6} className="bg-surface2 !py-3.5">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-[10.5px] text-text3 uppercase tracking-wide mb-1.5">Antes</div>
                          <pre className="bg-bg border border-border rounded-lg p-3 text-[11px] text-text2 overflow-auto max-h-56">
                            {l.old_data ? JSON.stringify(l.old_data, null, 2) : '—'}
                          </pre>
                        </div>
                        <div>
                          <div className="text-[10.5px] text-text3 uppercase tracking-wide mb-1.5">Después</div>
                          <pre className="bg-bg border border-border rounded-lg p-3 text-[11px] text-text2 overflow-auto max-h-56">
                            {l.new_data ? JSON.stringify(l.new_data, null, 2) : '—'}
                          </pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 text-[11.5px] text-text3">Mostrando {filtered.length} de {filtered.length} eventos{filtered.length >= 300 ? ' (puede haber más — acotá el rango de fechas)' : ''}</div>
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
