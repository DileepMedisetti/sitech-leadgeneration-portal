
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, totalPages, totalItems, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: '#ffffff',
        fontSize: '13px',
        color: 'var(--text-secondary)',
      }}
    >
      <div>
        Showing page <span style={{ fontWeight: 600 }}>{page}</span> of{' '}
        <span style={{ fontWeight: 600 }}>{totalPages}</span> ({totalItems} total)
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="btn btn-secondary btn-sm"
        >
          <ChevronLeft size={14} />
          <span>Previous</span>
        </button>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="btn btn-secondary btn-sm"
        >
          <span>Next</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
