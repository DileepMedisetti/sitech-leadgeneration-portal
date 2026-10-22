import React from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({
  title = 'No records found',
  message = 'There are no items matching your criteria.',
  action,
  icon: Icon = Inbox,
}) {
  return (
    <div
      style={{
        padding: '56px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 'var(--radius-lg)',
        border: '1px dashed var(--border-color)',
        margin: '16px 0',
      }}
    >
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          backgroundColor: 'var(--primary-light)',
          border: '1px solid var(--primary-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
        }}
      >
        <Icon size={24} color="var(--primary)" strokeWidth={1.8} />
      </div>

      <h3
        style={{
          fontSize: '16px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          margin: '0 0 6px 0',
          letterSpacing: '-0.2px',
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontSize: '13.5px',
          color: 'var(--text-muted)',
          maxWidth: '440px',
          margin: 0,
          marginBottom: action ? '20px' : 0,
          lineHeight: 1.5,
        }}
      >
        {message}
      </p>

      {action && <div>{action}</div>}
    </div>
  );
}
