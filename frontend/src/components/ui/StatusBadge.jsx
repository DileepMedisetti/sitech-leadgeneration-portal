
import React from 'react';

export default function StatusBadge({ status }) {
  const normalized = (status || 'unknown').toLowerCase();
  
  let badgeClass = 'badge-neutral';
  if (['qualified', 'completed', 'success'].includes(normalized)) {
    badgeClass = 'badge-success';
  } else if (['needs_review', 'pending', 'warning'].includes(normalized)) {
    badgeClass = 'badge-warning';
  } else if (['rejected', 'failed', 'danger'].includes(normalized)) {
    badgeClass = 'badge-danger';
  } else if (['running', 'processed', 'info'].includes(normalized)) {
    badgeClass = 'badge-info';
  }

  const label = normalized.replace('_', ' ');

  return (
    <span className={`badge ${badgeClass}`}>
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: 'currentColor',
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  );
}
