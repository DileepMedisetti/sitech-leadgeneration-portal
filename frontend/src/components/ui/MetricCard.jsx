import React from 'react';

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}) {
  const iconColor = color || 'var(--primary)';

  return (
    <div
      className="card"
      style={{
        padding: '20px 22px',
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        backgroundColor: '#ffffff',
        boxShadow: 'var(--shadow-xs)',
        transition: 'all var(--transition-fast)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </span>
        {Icon && (
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary-light)',
              border: '1px solid var(--primary-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={18} color={iconColor} strokeWidth={2.2} />
          </div>
        )}
      </div>

      <div>
        <div
          style={{
            fontSize: '26px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
          }}
        >
          {value}
        </div>

        {subtitle && (
          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              marginTop: '5px',
              lineHeight: 1.35,
              fontWeight: 500,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
