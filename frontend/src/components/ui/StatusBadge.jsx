import React from 'react';

export default function StatusBadge({ status }) {
  const normalized = (status || 'unknown').toLowerCase();

  let badgeClass = 'badge-neutral';
  if (['qualified', 'completed', 'success', 'finished', 'sent'].includes(normalized)) {
    badgeClass = 'badge-success';
  } else if (['needs_review', 'pending', 'warning', 'scheduled', 'paused'].includes(normalized)) {
    badgeClass = 'badge-warning';
  } else if (['rejected', 'failed', 'danger', 'aborted'].includes(normalized)) {
    badgeClass = 'badge-danger';
  } else if (['running', 'processed', 'info', 'sending'].includes(normalized)) {
    badgeClass = 'badge-info';
  }

  const label = normalized.replace(/_/g, ' ');

  return (
    <span className={`badge ${badgeClass}`}>
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: 'currentColor',
          display: 'inline-block',
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}
