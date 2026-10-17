import React from 'react';

/**
 * Format raw database IDs into professional contextual labels.
 * E.g. formatEntityId('JOB', 1) => 'JOB-001'
 * E.g. formatEntityId('Job', 1, 3, ' ') => 'Job 001'
 */
export function formatEntityId(prefix, id, padLength = 3, separator = '-') {
  if (id === null || id === undefined || id === '') return '—';
  const padded = String(id).padStart(padLength, '0');
  return prefix ? `${prefix}${separator}${padded}` : padded;
}

export default function IdBadge({
  prefix,
  id,
  padLength = 3,
  separator = '-',
  className = '',
  style = {},
}) {
  if (id === null || id === undefined || id === '') {
    return <span className="id-badge-empty">—</span>;
  }

  const label = formatEntityId(prefix, id, padLength, separator);

  return (
    <span
      className={`id-badge ${className}`}
      title={`${prefix ? prefix.toUpperCase() : 'ID'} #${id}`}
      style={style}
    >
      {label}
    </span>
  );
}
