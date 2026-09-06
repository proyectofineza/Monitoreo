import React from 'react';

export default function Badge({ className = 'badge-neutral', children, pulse = false }) {
  return (
    <span className={`badge ${className} ${pulse ? 'pulse-red' : ''}`}>
      <span className={`badge-dot bg-current ${pulse ? 'animate-pulse' : ''}`} />
      {children}
    </span>
  );
}
