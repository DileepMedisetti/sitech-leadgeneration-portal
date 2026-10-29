import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function DeleteBounceModal({
  isOpen,
  record,
  onClose,
  onConfirm,
  isDeleting,
}) {
  if (!isOpen || !record) return null;

  return (
    <div className="ct-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-bounce-title">
      <div className="ct-modal-card">
        <div className="ct-modal-header">
          <div className="ct-modal-icon-danger">
            <AlertTriangle size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 id="delete-bounce-title" className="ct-modal-title">Remove Bounced Email</h3>
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
            Are you sure you want to remove <strong>{record.email}</strong> ({record.recipient_name}) from this active bounced mails listing?
          </p>

          <div className="ct-modal-invariant-box">
            <strong style={{ color: '#0f172a' }}>Important Data Preservation Rule:</strong>
            <div style={{ marginTop: '4px', color: '#475569' }}>
              Removing this record cleans up the visible table. In accordance with system policy,
              the campaign's <strong>historical bounce count, bounce rate, and suppression protection</strong> will remain permanently unchanged.
            </div>
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
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Removing...' : 'Remove From List'}
          </button>
        </div>
      </div>
    </div>
  );
}

