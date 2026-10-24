import React, { useEffect, useRef, useState } from 'react';
import { LogOut, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function LogoutConfirmModal({
  isOpen,
  onClose,
  onNavigate,
}) {
  const { logout } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const modalRef = useRef(null);
  const cancelBtnRef = useRef(null);

  // Focus cancel button on mount and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    if (cancelBtnRef.current) {
      cancelBtnRef.current.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleConfirmLogout = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await logout();
      onClose();
      if (onNavigate) {
        onNavigate('login');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Logout failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="drawer-backdrop"
      style={{
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
          padding: '24px',
          position: 'relative',
          animation: 'scaleIn 150ms ease-out',
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          aria-label="Cancel and close dialog"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
          }}
        >
          <X size={18} />
        </button>

        {/* Modal Header & Icon */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '20px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '14px',
            }}
          >
            <LogOut size={22} color="#dc2626" />
          </div>

          <h3
            id="logout-dialog-title"
            style={{
              fontSize: '18px',
              fontWeight: 800,
              color: 'var(--text-primary, #0f172a)',
              margin: '0 0 6px 0',
              letterSpacing: '-0.02em',
            }}
          >
            Sign out?
          </h3>

          <p
            style={{
              fontSize: '13.5px',
              color: 'var(--text-secondary, #475569)',
              margin: 0,
              lineHeight: 1.5,
              maxWidth: '320px',
            }}
          >
            Are you sure you want to sign out of your Sitech Series workspace?
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: '10px 12px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#991b1b',
              fontSize: '12px',
              marginBottom: '16px',
              textAlign: 'center',
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Modal Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="btn btn-secondary"
            style={{
              height: '40px',
              fontSize: '13.5px',
              fontWeight: 600,
              justifyContent: 'center',
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmLogout}
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{
              height: '40px',
              fontSize: '13.5px',
              fontWeight: 700,
              backgroundColor: '#dc2626',
              borderColor: '#b91c1c',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Signing out...</span>
              </>
            ) : (
              <span>Sign out</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
