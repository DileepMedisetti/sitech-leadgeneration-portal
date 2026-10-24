import React, { useState, useEffect } from 'react';
import { X, Search, ChevronUp, ChevronDown, RotateCcw, Columns } from 'lucide-react';
import { ALL_COLUMNS, DEFAULT_VISIBLE_COLUMNS } from '../columnConstants';

export default function ColumnSelectorModal({
  isOpen,
  onClose,
  visibleColumns,
  onSaveColumns,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState(visibleColumns);
  const [columnOrder, setColumnOrder] = useState(() => {
    // Current visible columns first in their order, followed by hidden columns
    const hidden = ALL_COLUMNS.map((c) => c.id).filter((id) => !visibleColumns.includes(id));
    return [...visibleColumns, ...hidden];
  });

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggle = (id) => {
    const colDef = ALL_COLUMNS.find((c) => c.id === id);
    if (colDef?.required) return; // Cannot toggle required columns

    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newOrder = [...columnOrder];
    const temp = newOrder[index - 1];
    newOrder[index - 1] = newOrder[index];
    newOrder[index] = temp;
    setColumnOrder(newOrder);
  };

  const handleMoveDown = (index) => {
    if (index === columnOrder.length - 1) return;
    const newOrder = [...columnOrder];
    const temp = newOrder[index + 1];
    newOrder[index + 1] = newOrder[index];
    newOrder[index] = temp;
    setColumnOrder(newOrder);
  };

  const handleResetToDefault = () => {
    setSelectedIds(DEFAULT_VISIBLE_COLUMNS);
    setColumnOrder(ALL_COLUMNS.map((c) => c.id));
  };

  const handleSave = () => {
    // Maintain ordered list of only selected columns
    const finalVisible = columnOrder.filter((id) => selectedIds.includes(id));
    onSaveColumns(finalVisible);
    onClose();
  };

  const filteredColumnOrder = columnOrder.filter((id) => {
    const col = ALL_COLUMNS.find((c) => c.id === id);
    if (!col) return false;
    return col.label.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div
      className="drawer-backdrop"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 110,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          boxShadow: 'var(--shadow-xl)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
        }}
        role="dialog"
        aria-labelledby="column-selector-title"
        aria-modal="true"
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Columns size={18} color="var(--text-primary)" />
            <h3 id="column-selector-title" style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
              Customize Columns
            </h3>
          </div>
          <button
            onClick={onClose}
            className="btn btn-sm btn-outline"
            style={{ padding: '4px', borderRadius: 'var(--radius-sm)' }}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              placeholder="Search columns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                fontSize: '12.5px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-subtle)',
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleResetToDefault}
            className="btn btn-sm btn-outline"
            style={{ fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Reset to default columns"
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        </div>

        {/* Column List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', maxHeight: '360px' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Check columns to display. Use arrows to adjust left-to-right order.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filteredColumnOrder.map((colId) => {
              const col = ALL_COLUMNS.find((c) => c.id === colId);
              if (!col) return null;
              const isSelected = selectedIds.includes(colId);
              const realIndex = columnOrder.indexOf(colId);

              return (
                <div
                  key={colId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: isSelected ? 'var(--bg-app)' : '#ffffff',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: col.required ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: isSelected ? 500 : 400,
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                      flex: 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={col.required}
                      onChange={() => handleToggle(colId)}
                      style={{ accentColor: 'var(--text-primary)', cursor: col.required ? 'not-allowed' : 'pointer' }}
                    />
                    <span>{col.label}</span>
                    {col.required && (
                      <span
                        style={{
                          fontSize: '10.5px',
                          color: 'var(--text-muted)',
                          backgroundColor: 'var(--bg-subtle)',
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-xs)',
                        }}
                      >
                        Required
                      </span>
                    )}
                  </label>

                  {/* Ordering arrows */}
                  <div style={{ display: 'flex', gap: '2px' }}>
                    <button
                      type="button"
                      disabled={realIndex === 0}
                      onClick={() => handleMoveUp(realIndex)}
                      className="btn btn-sm"
                      style={{
                        padding: '2px 4px',
                        border: 'none',
                        background: 'transparent',
                        opacity: realIndex === 0 ? 0.3 : 1,
                      }}
                      title="Move column up"
                      aria-label={`Move ${col.label} up`}
                    >
                      <ChevronUp size={15} />
                    </button>
                    <button
                      type="button"
                      disabled={realIndex === columnOrder.length - 1}
                      onClick={() => handleMoveDown(realIndex)}
                      className="btn btn-sm"
                      style={{
                        padding: '2px 4px',
                        border: 'none',
                        background: 'transparent',
                        opacity: realIndex === columnOrder.length - 1 ? 0.3 : 1,
                      }}
                      title="Move column down"
                      aria-label={`Move ${col.label} down`}
                    >
                      <ChevronDown size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            backgroundColor: 'var(--bg-app)',
          }}
        >
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="btn btn-primary">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
