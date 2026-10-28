import React, { useState, useEffect } from 'react';
import { X, Check, RotateCcw, Columns, Lock } from 'lucide-react';

import { ALL_COLUMNS, DEFAULT_VISIBLE_COLUMNS, STORAGE_KEY } from '../campaignColumnConstants';

export default function CustomizeColumnsDrawer({ isOpen, onClose, visibleColumns, onApply }) {
  const [draft, setDraft] = useState(visibleColumns);

  useEffect(() => {
    if (isOpen) {
      setDraft(visibleColumns);
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen, visibleColumns]);

  if (!isOpen) return null;

  const handleToggle = (colId, isRequired) => {
    if (isRequired) return; // cannot toggle required columns
    setDraft((prev) =>
      prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId]
    );
  };

  const handleReset = () => {
    setDraft(DEFAULT_VISIBLE_COLUMNS);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // ignore storage error
    }
    onApply(draft);
    onClose();
  };

  const categories = ['Campaign Information', 'Delivery Metrics', 'Engagement Metrics', 'Spam & Inbox Metrics'];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(2px)',
        transition: 'opacity 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'clamp(320px, 62vw, 820px)',
          maxWidth: '100%',
          height: '100%',
          backgroundColor: '#ffffff',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10000,
          animation: 'slideInRight 0.25s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '20px 28px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Columns size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                Customize Table Columns
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Select and reorder visible columns for your campaign workspace.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '16px',
                backgroundColor: '#f1f5f9',
                color: '#334155',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {draft.length} of {ALL_COLUMNS.length} visible
            </span>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#64748b',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Close drawer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Drawer Scrollable Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            backgroundColor: '#f8fafc',
          }}
        >
          {categories.map((category) => {
            const cols = ALL_COLUMNS.filter((c) => c.category === category);
            return (
              <div
                key={category}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px 20px',
                }}
              >
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: '#64748b',
                    marginBottom: '12px',
                  }}
                >
                  {category}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '10px',
                  }}
                >
                  {cols.map((col) => {
                    const isChecked = draft.includes(col.id);
                    return (
                      <label
                        key={col.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid',
                          borderColor: isChecked ? '#bfdbfe' : '#e2e8f0',
                          backgroundColor: isChecked ? '#f8faff' : '#ffffff',
                          cursor: col.required ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s ease',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={col.required}
                          onChange={() => handleToggle(col.id, col.required)}
                          style={{
                            width: '16px',
                            height: '16px',
                            accentColor: '#2563eb',
                            cursor: col.required ? 'not-allowed' : 'pointer',
                          }}
                        />
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: isChecked ? 600 : 500,
                            color: col.required ? '#64748b' : '#1e293b',
                            flex: 1,
                          }}
                        >
                          {col.label}
                        </span>
                        {col.required && (
                          <span title="Required column" style={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                            <Lock size={13} />
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Drawer Footer Actions */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            onClick={handleReset}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#64748b',
              backgroundColor: 'transparent',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} /> Reset to Defaults
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#475569',
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: '#2563eb',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
              }}
            >
              <Check size={15} /> Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
