import React from 'react';

export default function Badge({ className = 'badge-neutral', children }) {
  return (
    <span className={`badge ${className}`}>
      <span className="badge-dot bg-current" />
      {children}
    </span>
  );
}
