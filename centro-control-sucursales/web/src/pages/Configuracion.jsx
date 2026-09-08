import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import Badge from '../components/Badge.jsx';
import { IconPlus } from '../components/icons.jsx';

const DEFAULT_FORMULA = {
  base: 100, baja: 2, media: 5, alta: 10, critica: 20,
  recurrencia_penalizacion: 6, recurrencia_umbral_dias: 30,
};

const FORMULA_FIELDS = [
  { key: 'base', label: 'Puntaje base', help: 'Score inicial de toda sucursal sin incidencias.' },
  { key: 'baja', label: 'Descuento — incidencia baja', help: 'Puntos que resta cada incidencia de gravedad baja.' },
  { key: 'media', label: 'Descuento — incidencia media', help: 'Puntos que resta cada incidencia de gravedad media.' },
  { key: 'alta', label: 'Descuento — incidencia alta', help: 'Puntos que resta cada incidencia de gravedad alta.' },
  { key: 'critica', label: 'Descuento — incidencia crítica', help: 'Puntos que resta cada incidencia de gravedad crítica.' },
  { key: 'recurrencia_umbral_dias', label: 'Ventana de recurrencia (días)', help: 'Período hacia atrás que se considera para calcular el score.' },
  { key: 'recurrencia_penalizacion', label: 'Penalización por recurrencia', help: 'Puntos extra que se restan si hay demasiadas incidencias en la ventana.' },
];

const EMPTY_TYPE = { code: '', label: '', is_personnel: true };

export default function Configuracion() {
  const [formula, setFormula] = useState(DEFAULT_FORMULA);
  const [savingFormula, setSavingFormula] = useState(false);
  const [formulaMsg, setFormulaMsg] = useState('');
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newType, setNewType] = useState(EMPTY_TYPE);
  const [showNewType, setShowNewType] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: t }] = await Promise.all([
      supabase.from('settings').select('value').eq('key', 'score_formula').single(),
      supabase.from('incident_types').select('*').order('sort_order'),
    ]);
    if (s?.value) setFormula({ ...DEFAULT_FORMULA, ...s.value });
    setTypes(t || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const saveFormula = async () => {
    setSavingFormula(true);
    setFormulaMsg('');
    const payload = Object.fromEntries(FORMULA_FIELDS.map((f) => [f.key, Number(formula[f.key])]));
    const { error } = await supabase.from('settings').update({ value: payload, updated_at: new Date().toISOString() }).eq('key', 'score_formula');
    setSavingFormula(false);
    setFormulaMsg(error ? 'Error al guardar: ' + error.message : 'Fórmula guardada. Se aplicará en los próximos recálculos de score.');
  };

  const toggleTypeActive = async (t) => {
    const { error } = await supabase.from('incident_types').update({ active: !t.active }).eq('id', t.id);
    if (error) alert('No se pudo actualizar: ' + error.message);
    else load();
  };

  const addType = async () => {
    if (!newType.code.trim() || !newType.label.trim()) {
      alert('Código y etiqueta son obligatorios.');
      return;
    }
    const maxSort = types.reduce((m, t) => Math.max(m, t.sort_order), 0);
    const { error } = await supabase.from('incident_types').insert({
      code: newType.code.trim().toLowerCase().replace(/\s+/g, '_'),
      label: newType.label.trim(),
      is_personnel: newType.is_personnel,
      sort_order: maxSort + 1,
    });
    if (error) {
      alert('No se pudo crear el tipo: ' + error.message);
      return;
    }
    setNewType(EMPTY_TYPE);
    setShowNewType(false);
    load();
  };

  return (
    <div>
      <div className="mb-4">
        <div className="text-[11px] text-brand uppercase tracking-widest font-semibold mb-1">Administración</div>
        <h1 className="text-[22px] font-bold tracking-tight">Configuración</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4 items-start">
        <div className="card">
          <div className="text-sm font-semibold mb-1">Fórmula de cálculo del Score</div>
          <div className="text-[11.5px] text-text3 mb-4">
            Score = base − Σ(descuentos por gravedad) − penalización por recurrencia, dentro de la ventana configurada.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {FORMULA_FIELDS.map((f) => (
              <div key={f.key}>
                <div className="text-[11.5px] font-medium mb-1">{f.label}</div>
                <input
                  type="number"
                  className="input"
                  value={formula[f.key]}
                  onChange={(e) => setFormula({ ...formula, [f.key]: e.target.value })}
                />
                <div className="text-[10.5px] text-text3 mt-1 leading-snug">{f.help}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button className="btn btn-primary" disabled={savingFormula} onClick={saveFormula}>
              {savingFormula ? 'Guardando…' : 'Guardar fórmula'}
            </button>
            {formulaMsg && <span className="text-[12px] text-text2">{formulaMsg}</span>}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-semibold">Catálogo de tipos de incidencia</div>
            <button className="text-brand text-[11.5px] hover:underline flex items-center gap-1" onClick={() => setShowNewType((v) => !v)}>
              <IconPlus /> Nuevo tipo
            </button>
          </div>
          <div className="text-[11.5px] text-text3 mb-3">Usado en el formulario de registro de incidencias</div>

          {showNewType && (
            <div className="bg-surface2 border border-border rounded-lg p-3 mb-3 flex flex-col gap-2">
              <input className="input !text-[12px]" placeholder="Etiqueta (ej: Empleado sin uniforme)" value={newType.label} onChange={(e) => setNewType({ ...newType, label: e.target.value })} />
              <input className="input !text-[12px]" placeholder="Código único (ej: sin_uniforme)" value={newType.code} onChange={(e) => setNewType({ ...newType, code: e.target.value })} />
              <label className="flex items-center gap-2 text-[12px] text-text2">
                <input type="checkbox" checked={newType.is_personnel} onChange={(e) => setNewType({ ...newType, is_personnel: e.target.checked })} />
                Es incidencia de personal (RRHH)
              </label>
              <div className="flex gap-2">
                <button className="btn btn-primary !py-1.5 !text-[12px]" onClick={addType}>Crear</button>
                <button className="btn btn-ghost !py-1.5 !text-[12px]" onClick={() => setShowNewType(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {loading && <div className="text-text3 text-sm py-4 text-center">Cargando…</div>}
          {!loading && types.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-bordersoft last:border-none text-[12.5px]">
              <div>
                <div>{t.label}</div>
                <div className="text-text3 text-[11px] mt-0.5 font-mono">{t.code} {t.is_personnel ? '· personal' : '· operativa'}</div>
              </div>
              <div className="flex items-center gap-2.5">
                <Badge className={t.active ? 'badge-green' : 'badge-neutral'}>{t.active ? 'Activo' : 'Inactivo'}</Badge>
                <button className="text-[11.5px] text-brand hover:underline" onClick={() => toggleTypeActive(t)}>
                  {t.active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
