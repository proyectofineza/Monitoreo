import React, { useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/auth.jsx';
import { useBranches } from '../hooks/useLookups.js';
import Badge from '../components/Badge.jsx';
import { downloadCsv } from '../lib/format.js';
import { IconSearch, IconPlus } from '../components/icons.jsx';

const EMPTY_FORM = {
  id: null, code: '', name: '', address: '', city: '', department: 'Central',
  lat: '', lng: '', open_time: '08:00', close_time: '18:00', camera_count: 4, active: true,
};

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const delim = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const splitLine = (line) => line.split(delim).map((c) => c.trim().replace(/^"|"$/g, ''));
  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    const row = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ''));
    return row;
  });
}

export default function Sucursales() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const { branches, loading, reload } = useBranches();
  const fileInputRef = useRef(null);

  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  const cities = useMemo(() => [...new Set(branches.map((b) => b.city))].sort(), [branches]);

  const filtered = useMemo(() => {
    let list = branches;
    if (cityFilter) list = list.filter((b) => b.city === cityFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((b) => `${b.code} ${b.name} ${b.city}`.toLowerCase().includes(q));
    return list;
  }, [branches, cityFilter, search]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };
  const openEdit = (b) => {
    setForm({
      id: b.id, code: b.code, name: b.name, address: b.address || '', city: b.city,
      department: b.department || '', lat: b.lat ?? '', lng: b.lng ?? '',
      open_time: b.open_time || '08:00', close_time: b.close_time || '18:00',
      camera_count: b.camera_count ?? 0, active: b.active,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.city.trim()) {
      alert('Código, nombre y ciudad son obligatorios.');
      return;
    }
    setSaving(true);
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      address: form.address.trim() || null,
      city: form.city.trim(),
      department: form.department.trim() || null,
      lat: form.lat === '' ? null : Number(form.lat),
      lng: form.lng === '' ? null : Number(form.lng),
      open_time: form.open_time || null,
      close_time: form.close_time || null,
      camera_count: Number(form.camera_count) || 0,
      active: form.active,
    };
    const q = form.id
      ? supabase.from('branches').update(payload).eq('id', form.id)
      : supabase.from('branches').insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) {
      alert('No se pudo guardar la sucursal: ' + error.message);
      return;
    }
    setShowForm(false);
    reload();
  };

  const toggleActive = async (b) => {
    const { error } = await supabase.from('branches').update({ active: !b.active }).eq('id', b.id);
    if (error) alert('No se pudo actualizar: ' + error.message);
    else reload();
  };

  const deleteBranch = async (b) => {
    const ok = window.confirm(
      `¿Eliminar definitivamente la sucursal "Suc. ${b.code} — ${b.name}"?\n\nEsta acción no se puede deshacer.`
    );
    if (!ok) return;
    const { error } = await supabase.from('branches').delete().eq('id', b.id);
    if (error) {
      if (error.code === '23503') {
        alert(
          'No se puede eliminar esta sucursal porque ya tiene verificaciones, incidencias o historial de Score asociado.\n\n' +
            'Para retirarla de circulación sin perder ese historial, usá "Desactivar" en su lugar.'
        );
      } else {
        alert('No se pudo eliminar la sucursal: ' + error.message);
      }
      return;
    }
    reload();
  };

  const downloadTemplate = () => {
    downloadCsv('plantilla_sucursales.csv', [{
      code: '151', name: 'Ejemplo Centro', address: 'Av. España 123', city: 'Asunción',
      department: 'Central', lat: '-25.30', lng: '-57.63', open_time: '08:00', close_time: '18:00', camera_count: '4',
    }]);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text)
      .filter((r) => r.code && r.name && r.city)
      .map((r) => ({
        code: r.code, name: r.name, address: r.address || null, city: r.city,
        department: r.department || null,
        lat: r.lat ? Number(r.lat) : null, lng: r.lng ? Number(r.lng) : null,
        open_time: r.open_time || '08:00', close_time: r.close_time || '18:00',
        camera_count: r.camera_count ? Number(r.camera_count) : 0,
      }));
    if (rows.length === 0) {
      setImportMsg('El archivo no tiene filas válidas (se requieren columnas code, name, city).');
      return;
    }
    const { error } = await supabase.from('branches').upsert(rows, { onConflict: 'code' });
    if (error) {
      setImportMsg('Error al importar: ' + error.message);
      return;
    }
    setImportMsg(`Se importaron/actualizaron ${rows.length} sucursales.`);
    reload();
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="text-[11px] text-brand uppercase tracking-widest font-semibold mb-1">Administración</div>
          <h1 className="text-[22px] font-bold tracking-tight">Sucursales</h1>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button className="btn btn-ghost !text-[12px]" onClick={downloadTemplate}>Plantilla CSV</button>
            <button className="btn btn-ghost !text-[12px]" onClick={() => fileInputRef.current?.click()}>Importar CSV</button>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile} />
            <button className="btn btn-primary !text-[12px]" onClick={openNew}><IconPlus /> Nueva sucursal</button>
          </div>
        )}
      </div>

      {importMsg && (
        <div className="card mb-4 !py-2.5 text-[12.5px] text-text2 flex justify-between items-center">
          <span>{importMsg}</span>
          <button className="text-text3 hover:text-text" onClick={() => setImportMsg('')}>✕</button>
        </div>
      )}

      {showForm && isAdmin && (
        <div className="card mb-4">
          <div className="text-sm font-semibold mb-3.5">{form.id ? 'Editar sucursal' : 'Nueva sucursal'}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <LabeledInput label="Código" value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
            <LabeledInput label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} className="col-span-2" />
            <LabeledInput label="Ciudad" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            <LabeledInput label="Dirección" value={form.address} onChange={(v) => setForm({ ...form, address: v })} className="col-span-2" />
            <LabeledInput label="Departamento" value={form.department} onChange={(v) => setForm({ ...form, department: v })} />
            <LabeledInput label="Cámaras" type="number" value={form.camera_count} onChange={(v) => setForm({ ...form, camera_count: v })} />
            <LabeledInput label="Latitud" value={form.lat} onChange={(v) => setForm({ ...form, lat: v })} />
            <LabeledInput label="Longitud" value={form.lng} onChange={(v) => setForm({ ...form, lng: v })} />
            <LabeledInput label="Apertura" type="time" value={form.open_time} onChange={(v) => setForm({ ...form, open_time: v })} />
            <LabeledInput label="Cierre" type="time" value={form.close_time} onChange={(v) => setForm({ ...form, close_time: v })} />
            <label className="flex items-center gap-2 text-[12.5px] text-text2 mt-5">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Activa
            </label>
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar sucursal'}</button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-[320px]">
          <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text3" />
          <input className="input !pl-8" placeholder="Buscar por código, nombre o ciudad…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input !w-[180px]" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
          <option value="">Todas las ciudades</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="datatable">
          <thead>
            <tr><th>Código</th><th>Sucursal</th><th>Ciudad</th><th>Cámaras</th><th>Horario</th><th>Estado</th>{isAdmin && <th></th>}</tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="text-center text-text3 py-8">Cargando…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="text-center text-text3 py-8">No hay sucursales para este filtro.</td></tr>}
            {!loading && filtered.map((b) => (
              <tr key={b.id}>
                <td className="font-mono text-text2">{b.code}</td>
                <td>{b.name}</td>
                <td className="text-text3">{b.city}</td>
                <td className="font-mono">{b.camera_count}</td>
                <td className="font-mono text-text3">{b.open_time?.slice(0, 5)}–{b.close_time?.slice(0, 5)}</td>
                <td><Badge className={b.active ? 'badge-green' : 'badge-neutral'}>{b.active ? 'Activa' : 'Inactiva'}</Badge></td>
                {isAdmin && (
                  <td className="text-right whitespace-nowrap">
                    <button className="text-brand text-[11.5px] hover:underline mr-3" onClick={() => openEdit(b)}>Editar</button>
                    <button className="text-[11.5px] hover:underline mr-3" onClick={() => toggleActive(b)}>{b.active ? 'Desactivar' : 'Activar'}</button>
                    <button className="text-red text-[11.5px] hover:underline" onClick={() => deleteBranch(b)}>Eliminar</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          </table>
        </div>
        <div className="flex justify-between px-4 py-2.5 text-[11.5px] text-text3">
          <span>Mostrando {filtered.length} de {filtered.length} sucursales{cityFilter || search ? ' (filtradas)' : ''}</span>
          <span>Red completa: {branches.length} sucursales</span>
        </div>
      </div>
    </div>
  );
}

function LabeledInput({ label, value, onChange, type = 'text', className = '' }) {
  return (
    <div className={className}>
      <div className="text-[10.5px] text-text3 uppercase tracking-wide mb-1">{label}</div>
      <input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
