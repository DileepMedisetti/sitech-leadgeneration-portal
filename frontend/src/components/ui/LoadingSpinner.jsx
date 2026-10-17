
import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ text = 'Loading data...' }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        color: 'var(--text-muted)',
        gap: '12px',
      }}
    >
      <Loader2
        size={28}
        color="var(--primary)"
        style={{
          animation: 'spin 1s linear infinite',
        }}
      />
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <span style={{ fontSize: '13px', fontWeight: 500 }}>{text}</span>
    </div>
  );
}
