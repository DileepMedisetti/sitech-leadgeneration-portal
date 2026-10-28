import React, { useState } from 'react';
import { AlertOctagon, X } from 'lucide-react';

export default function DeleteAllBouncesModal({
  isOpen,
  totalCount,
  onClose,
  onConfirm,
  isDeleting,
}) {
  const [confirmationText, setConfirmationText] = useState('');

  if (!isOpen) return null;

  const isConfirmed = confirmationText.trim().toUpperCase() === 'DELETE';

  const handleConfirm = () => {
    if (isConfirmed && !isDeleting) {
      onConfirm();
    }
  };

  return (
    <div className="ct-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-all-bounces-title">
      <div className="ct-modal-card">
        <div className="ct-modal-header">
          <div className="ct-modal-icon-danger">
            <AlertOctagon size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 id="delete-all-bounces-title" className="ct-modal-title">Clear All Bounced Mails</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
            disabled={isDeleting}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="ct-modal-body">
          <p style={{ margin: '0 0 10px 0' }}>
            You are about to remove all <strong>{totalCount}</strong> active bounced mail record(s) from this view.
          </p>

          <div className="ct-modal-invariant-box" style={{ borderColor: '#fed7aa', backgroundColor: '#fff7ed' }}>
            <strong style={{ color: '#9a3412' }}>Historical Invariant Guarantee:</strong>
            <div style={{ marginTop: '4px', color: '#7c2d12' }}>
              Clearing all listing records does <strong>NOT</strong> reduce or alter the campaign's historical bounce rate or historical bounce count.
              Authoritative reporting and mailbox suppression standards remain 100% intact.
            </div>
          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Type <strong>DELETE</strong> to confirm:
            </label>
            <input
              type="text"
              className="ct-search-input"
              style={{ paddingLeft: '12px' }}
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="DELETE"
              disabled={isDeleting}
              autoFocus
            />
          </div>
        </div>

        <div className="ct-modal-footer">
          <button
            type="button"
            className="ct-btn ct-btn-secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ct-btn ct-btn-danger"
            onClick={handleConfirm}
            disabled={!isConfirmed || isDeleting}
          >
            {isDeleting ? 'Clearing Records...' : 'Clear All Records'}
          </button>
        </div>
      </div>
    </div>
  );
}

