import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';
import { useAuth } from '../lib/auth.jsx';
import { useIncidentTypes, useEmployees } from '../hooks/useLookups.js';
import { fmtDuration, SEVERITY_LABEL, SEVERITY_WEIGHT, SEVERITY_BADGE } from '../lib/format.js';
import Badge from '../components/Badge.jsx';
import { IconAlert, IconCheck } from '../components/icons.jsx';

const SEVERITIES = ['baja', 'media', 'alta', 'critica'];

export default function Verificacion() {
  const { branchId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const types = useIncidentTypes();
  const employees = useEmployees(branchId);

  const [branch, setBranch] = useState(null);
  const [check, setCheck] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [phase, setPhase] = useState('review'); // review | form | confirm_sin | done
  const [doneSummary, setDoneSummary] = useState(null);

  const [formTipo, setFormTipo] = useState(null);
  const [formGravedad, setFormGravedad] = useState(null);
  const [formEmpleado, setFormEmpleado] = useState('');
  const [formObs, setFormObs] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: b } = await supabase.from('branches').select('*').eq('id', branchId).single();
      const { data: c } = await supabase
        .from('branch_checks')
        .select('*')
        .eq('branch_id', branchId)
        .eq('operator_id', profile.id)
        .is('finished_at', null)
        .maybeSingle();
      if (!alive) return;
      setBranch(b || null);
      setCheck(c || null);
      if (c) {
        const { data: incs } = await supabase
          .from('incidents_detailed')
          .select('*')
          .eq('check_id', c.id)
          .order('created_at');
        if (alive) setIncidents(incs || []);
      } else {
        setErrorMsg('No hay una verificación abierta para esta sucursal a tu nombre.');
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  const gravedadMax = useMemo(() => {
    if (incidents.length === 0) return null;
    return incidents.reduce((max, i) => (SEVERITY_WEIGHT[i.severity] > SEVERITY_WEIGHT[max] ? i.severity : max), incidents[0].severity);
  }, [incidents]);

  const openForm = () => {
    setFormTipo(null);
    setFormGravedad(null);
    setFormEmpleado('');
    setFormObs('');
    setPhase('form');
  };

  const saveIncidencia = async () => {
    if (!formTipo || !formGravedad) return;
    setSaving(true);
    const payload = {
      check_id: check.id,
      branch_id: branchId,
      type_id: formTipo,
      severity: formGravedad,
      observation: formObs || null,
      created_by: profile.id,
    };
    if (formEmpleado) payload.employee_name_freeform = formEmpleado;
    const { error } = await supabase.from('incidents').insert(payload);
    setSaving(false);
    if (error) {
      alert('No se pudo guardar la incidencia: ' + error.message);
      return;
    }
    const { data: incs } = await supabase.from('incidents_detailed').select('*').eq('check_id', check.id).order('created_at');
    setIncidents(incs || []);
    setPhase('review');
  };

  const finish = async (status) => {
    setSaving(true);
    const startedAt = new Date(check.started_at).getTime();
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    const { data, error } = await supabase
      .from('branch_checks')
      .update({ finished_at: new Date().toISOString(), status, duration_seconds: durationSeconds })
      .eq('id', check.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      alert('No se pudo finalizar la verificación: ' + error.message);
      return;
    }
    const { data: scoreRow } = await supabase.from('branch_scores').select('score').eq('branch_id', branchId).single();
    setDoneSummary({
      resultado: status === 'verificada' ? 'SIN INCIDENCIAS' : 'CON INCIDENCIAS',
      incidencias: incidents.length,
      gravedad: gravedadMax ? SEVERITY_LABEL[gravedadMax] : '—',
      duracion: fmtDuration(data.duration_seconds),
      score: scoreRow?.score ?? '—',
    });
    setPhase('done');
  };

  if (loading) return <div className="text-text3 text-sm py-10 text-center">Cargando…</div>;

  if (errorMsg) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="text-lg font-semibold mb-2">No se puede continuar</div>
        <p className="text-text2 text-sm mb-5">{errorMsg}</p>
        <Link to="/monitoreo" className="btn btn-primary">← Volver a Monitoreo</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card flex items-center justify-between mb-4">
        <div>
          <div className="font-mono text-brand text-xs font-semibold tracking-wide">SUCURSAL {branch.code}</div>
          <div className="text-xl font-bold mt-0.5">{branch.name}</div>
          <div className="text-xs text-text3">{branch.city}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-text3 mb-1">Inicio: <span className="font-mono text-text2">{new Date(check.started_at).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}</span></div>
          <Badge className="badge-amber">EN REVISIÓN</Badge>
        </div>
      </div>

      {phase === 'review' && (
        <>
          {incidents.length > 0 && (
            <div className="card mb-4">
              <div className="font-semibold text-sm mb-1">Incidencias registradas en esta verificación</div>
              <div className="text-xs text-text3 mb-3">{incidents.length} incidencia(s) · Gravedad máxima: {SEVERITY_LABEL[gravedadMax]}</div>
              <div className="flex flex-col gap-2">
                {incidents.map((inc, idx) => (
                  <div key={inc.id} className="flex items-center gap-2.5 bg-surface2 border border-border rounded-lg px-3 py-2.5">
                    <div className="w-5 h-5 rounded-full bg-surface3 text-text2 text-[10.5px] font-bold flex items-center justify-center flex-none">{idx + 1}</div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{inc.type_label} — {SEVERITY_LABEL[inc.severity]}</div>
                      <div className="text-[11.5px] text-text3">{inc.observation || 'Sin observación adicional'}</div>
                    </div>
                    <Badge className={SEVERITY_BADGE[inc.severity]}>{SEVERITY_LABEL[inc.severity]}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3.5 mb-4">
            {incidents.length > 0 ? (
              <button onClick={() => finish('con_incidencia')} disabled={saving} className="col-span-2 rounded-[14px] border-[1.5px] border-green/40 bg-greensoft text-green py-6 flex flex-col items-center gap-2.5 font-bold text-[14.5px]">
                <IconCheck width={26} height={26} /> FINALIZAR VERIFICACIÓN
              </button>
            ) : (
              <button onClick={() => setPhase('confirm_sin')} className="rounded-[14px] border-[1.5px] border-green/40 bg-greensoft text-green py-6 flex flex-col items-center gap-2.5 font-bold text-[14.5px]">
                <IconCheck width={26} height={26} /> SIN INCIDENCIAS
              </button>
            )}
            <button onClick={openForm} className={`rounded-[14px] border-[1.5px] border-orange/40 bg-orangesoft text-orange py-6 flex flex-col items-center gap-2.5 font-bold text-[14.5px] ${incidents.length > 0 ? '' : ''}`}>
              <IconAlert width={26} height={26} /> {incidents.length > 0 ? 'AGREGAR OTRA INCIDENCIA' : 'REGISTRAR INCIDENCIA'}
            </button>
          </div>
        </>
      )}

      {phase === 'form' && (
        <div className="card mb-4">
          <div className="font-semibold text-sm mb-1">Registrar incidencia</div>
          <div className="text-xs text-text3 mb-4">Sucursal {branch.code} · {new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}</div>

          <div className="mb-4">
            <span className="block text-[11px] font-bold text-text2 uppercase tracking-wide mb-2">Tipo</span>
            <div className="flex flex-wrap gap-2">
              {types.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setFormTipo(t.id)}
                  className={`px-3.5 py-2 rounded-[9px] text-[12.8px] font-semibold border cursor-pointer ${formTipo === t.id ? 'bg-brandsoft border-brand text-brand' : 'bg-surface2 border-border text-text2'}`}
                >
                  {t.label}
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <span className="block text-[11px] font-bold text-text2 uppercase tracking-wide mb-2">Gravedad</span>
            <div className="flex flex-wrap gap-2">
              {SEVERITIES.map((s) => (
                <div
                  key={s}
                  onClick={() => setFormGravedad(s)}
                  className={`px-3.5 py-2 rounded-[9px] text-[12.8px] font-semibold border cursor-pointer ${formGravedad === s ? SEVERITY_BADGE[s] + ' border-current' : 'bg-surface2 border-border text-text2'}`}
                >
                  {SEVERITY_LABEL[s]}
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <span className="block text-[11px] font-bold text-text2 uppercase tracking-wide mb-2">Empleado involucrado (opcional)</span>
            <input list="empleados-list" className="input" placeholder="Nombre del empleado…" value={formEmpleado} onChange={(e) => setFormEmpleado(e.target.value)} />
            <datalist id="empleados-list">
              {employees.map((e) => (<option key={e.id} value={e.full_name} />))}
            </datalist>
          </div>

          <div className="mb-4">
            <span className="block text-[11px] font-bold text-text2 uppercase tracking-wide mb-2">Observación</span>
            <textarea className="input min-h-[80px] resize-none" placeholder="Detalle lo observado…" value={formObs} onChange={(e) => setFormObs(e.target.value)} />
          </div>

          <div className="flex gap-2.5 justify-end">
            <button className="btn btn-ghost" onClick={() => setPhase('review')}>Cancelar</button>
            <button className={`btn ${formTipo && formGravedad ? 'btn-primary' : 'btn-disabled'}`} disabled={!formTipo || !formGravedad || saving} onClick={saveIncidencia}>
              {saving ? 'Guardando…' : 'Guardar incidencia'}
            </button>
          </div>
        </div>
      )}

      {phase === 'confirm_sin' && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-10">
          <div className="card w-[380px]">
            <div className="font-bold text-[15.5px] mb-2">Confirmar verificación</div>
            <p className="text-[13px] text-text2 leading-relaxed mb-5">
              ¿Confirmás que la sucursal <b className="text-text">{branch.code} — {branch.name}</b> fue verificada <b className="text-green">sin incidencias</b>?
            </p>
            <div className="flex gap-2.5 justify-end">
              <button className="btn btn-ghost" onClick={() => setPhase('review')}>Cancelar</button>
              <button className="btn btn-primary" disabled={saving} onClick={() => finish('verificada')}>{saving ? 'Confirmando…' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      {phase === 'done' && doneSummary && (
        <div className="card flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-greensoft flex items-center justify-center mb-2">
            <IconCheck width={28} height={28} className="text-green" />
          </div>
          <h2 className="text-lg font-semibold mt-1 mb-1">Verificación registrada</h2>
          <p className="text-[13px] text-text2 mb-5">Sucursal {branch.code} — {branch.name}</p>
          <div className="w-full text-left text-sm">
            <SummaryRow label="Resultado" value={doneSummary.resultado} />
            <SummaryRow label="Incidencias" value={doneSummary.incidencias} />
            <SummaryRow label="Gravedad máxima" value={doneSummary.gravedad} />
            <SummaryRow label="Duración" value={doneSummary.duracion} />
            <SummaryRow label="Score actualizado" value={doneSummary.score} />
          </div>
          <button className="btn btn-primary w-full mt-5" onClick={() => navigate('/monitoreo')}>Volver a Monitoreo →</button>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-bordersoft last:border-none">
      <span className="text-text3">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}
