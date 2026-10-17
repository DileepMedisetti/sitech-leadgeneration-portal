
import React from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({ title = 'No records found', message = 'There are no items matching your criteria.', action, icon: Icon = Inbox }) {
  return (
    <div
      style={{
        padding: '48px 24px',
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
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: 'var(--bg-app)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
        }}
      >
        <Icon size={24} color="var(--text-muted)" />
      </div>

      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
        {title}
      </h3>

      <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '400px', marginBottom: action ? '20px' : 0 }}>
        {message}
      </p>

      {action && <div>{action}</div>}
    </div>
  );
}
