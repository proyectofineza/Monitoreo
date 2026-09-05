import React from 'react';

export default function Kpi({ label, value, sub, color }) {
  return (
    <div className="card !p-4">
      <div className="text-[10.5px] text-text3 uppercase tracking-wide">{label}</div>
      <div className="text-[25px] font-semibold font-mono mt-1.5 leading-none" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-text3 mt-1.5">{sub}</div>}
    </div>
  );
}
