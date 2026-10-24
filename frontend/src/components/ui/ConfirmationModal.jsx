import React, { useEffect, useRef, useCallback } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Check,
  Info,
  X,
  RefreshCw,
  Trash2,
} from 'lucide-react';

/**
 * Enterprise-grade accessible confirmation & feedback modal.
 * Fully centered horizontally and vertically in the viewport with a translucent backdrop.
 *
 * Supported Types:
 * - 'warning': Amber warning badge (e.g. unsaved changes, departure warning)
 * - 'danger' | 'error': Red alert/trash badge (e.g. permanent deletion, critical failure)
 * - 'success': Green checkmark badge (e.g. action verified, published)
 * - 'info': Blue information badge (e.g. status details, guidelines)
 */
export default function ConfirmationModal({
  isOpen,
  title,
  message,
  type = 'warning', // 'warning' | 'danger' | 'error' | 'success' | 'info'
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  onClose,
  confirmVariant, // 'danger' | 'primary' | 'warning' (defaults based on type)
  isLoading = false,
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  autoFocus = 'cancel', // 'cancel' | 'confirm' | 'none'
  icon,
  children,
}) {
  const modalCardRef = useRef(null);
  const cancelBtnRef = useRef(null);
  const confirmBtnRef = useRef(null);
  const previousActiveElementRef = useRef(null);

  const handleDismiss = useCallback(() => {
    if (onCancel) {
      onCancel();
    } else if (onClose) {
      onClose();
    }
  }, [onCancel, onClose]);

  const handleConfirmClick = useCallback((e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    if (isLoading) return;
    if (typeof onConfirm === 'function') {
      onConfirm(); // Crucial: pure function invocation without passing event
    } else {
      handleDismiss();
    }
  }, [isLoading, onConfirm, handleDismiss]);

  const handleCancelClick = useCallback((e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    if (isLoading) return;
    handleDismiss(); // Crucial: pure function invocation without passing event
  }, [isLoading, handleDismiss]);

  // Determine effective confirm button visual variant
  const effectiveConfirmVariant =
    confirmVariant ||
    (type === 'danger' || type === 'error'
      ? 'danger'
      : type === 'warning'
      ? 'danger'
      : 'primary');

  // Remember active element before modal open to restore on close
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement;
    } else if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
      try {
        previousActiveElementRef.current.focus();
      } catch (e) {
        // Ignore focus restore errors if trigger was unmounted
      }
    }
  }, [isOpen]);

  // Focus management on mount
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (cancelLabel && autoFocus === 'cancel' && cancelBtnRef.current) {
        cancelBtnRef.current.focus();
      } else if (confirmBtnRef.current && (autoFocus === 'confirm' || !cancelLabel)) {
        confirmBtnRef.current.focus();
      } else if (modalCardRef.current) {
        modalCardRef.current.focus();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isOpen, cancelLabel, autoFocus]);

  // Escape key and keyboard focus trapping
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && closeOnEscape && !isLoading) {
        e.preventDefault();
        handleCancelClick(e);
        return;
      }

      // Trap focus inside modal
      if (e.key === 'Tab' && modalCardRef.current) {
        const focusable = modalCardRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, isLoading, handleDismiss]);

  if (!isOpen) return null;

  // Icon badge configuration based on variant
  const getBadgeConfig = () => {
    if (icon) {
      return {
        bg: '#F1F5F9',
        border: '#E2E8F0',
        content: icon,
      };
    }

    switch (type) {
      case 'danger':
      case 'error':
        return {
          bg: '#FEE2E2', // red-100
          border: '#FECACA', // red-200
          content: <AlertCircle size={26} color="#DC2626" strokeWidth={2.2} />,
        };
      case 'success':
        return {
          bg: '#D1FAE5', // emerald-100
          border: '#A7F3D0', // emerald-200
          content: <Check size={26} color="#059669" strokeWidth={2.5} />,
        };
      case 'info':
        return {
          bg: '#DBEAFE', // blue-100
          border: '#BFDBFE', // blue-200
          content: <Info size={26} color="#2563EB" strokeWidth={2.2} />,
        };
      case 'warning':
      default:
        return {
          bg: '#FEF3C7', // amber-100
          border: '#FDE68A', // amber-200
          content: <AlertTriangle size={26} color="#D97706" strokeWidth={2.2} />,
        };
    }
  };

  const badge = getBadgeConfig();

  const getConfirmButtonStyle = () => {
    const base = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '10px 18px',
      fontSize: '13.5px',
      fontWeight: 600,
      borderRadius: '8px',
      border: 'none',
      cursor: isLoading ? 'not-allowed' : 'pointer',
      transition: 'all 150ms ease-in-out',
      minWidth: cancelLabel ? '120px' : '140px',
      opacity: isLoading ? 0.75 : 1,
    };

    if (effectiveConfirmVariant === 'danger') {
      return {
        ...base,
        backgroundColor: '#DC2626',
        color: '#FFFFFF',
        boxShadow: '0 1px 2px rgba(220, 38, 38, 0.2)',
      };
    }

    if (effectiveConfirmVariant === 'warning') {
      return {
        ...base,
        backgroundColor: '#D97706',
        color: '#FFFFFF',
        boxShadow: '0 1px 2px rgba(217, 119, 6, 0.2)',
      };
    }

    return {
      ...base,
      backgroundColor: '#4361EE',
      color: '#FFFFFF',
      boxShadow: '0 1px 2px rgba(67, 97, 238, 0.25)',
    };
  };

  return (
    <div
      className="drawer-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && closeOnBackdrop && !isLoading) {
          handleCancelClick(e);
        }
      }}
    >
      <div
        ref={modalCardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        aria-describedby={message ? 'confirmation-dialog-desc' : undefined}
        tabIndex={-1}
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          padding: '28px 24px 24px 24px',
          position: 'relative',
          animation: 'scaleIn 160ms cubic-bezier(0.16, 1, 0.3, 1)',
          outline: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Optional top-right close icon */}
        {showCloseButton && !isLoading && (
          <button
            type="button"
            onClick={handleCancelClick}
            aria-label="Close dialog"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              transition: 'background-color 120ms ease, color 120ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F1F5F9';
              e.currentTarget.style.color = '#0F172A';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#94A3B8';
            }}
          >
            <X size={18} />
          </button>
        )}

        {/* Circular Icon Badge */}
        <div
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '50%',
            backgroundColor: badge.bg,
            border: `1px solid ${badge.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            flexShrink: 0,
          }}
        >
          {badge.content}
        </div>

        {/* Heading */}
        <h3
          id="confirmation-dialog-title"
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: '#0F172A',
            margin: '0 0 8px 0',
            letterSpacing: '-0.02em',
            lineHeight: 1.3,
          }}
        >
          {title}
        </h3>

        {/* Description / Message */}
        {message && (
          <div
            id="confirmation-dialog-desc"
            style={{
              fontSize: '13.5px',
              color: '#475569',
              margin: '0 0 22px 0',
              lineHeight: 1.55,
              maxWidth: '380px',
            }}
          >
            {message}
          </div>
        )}

        {/* Optional Custom Slot Content */}
        {children && (
          <div style={{ width: '100%', marginBottom: '20px', textAlign: 'left' }}>
            {children}
          </div>
        )}

        {/* Action Button Group */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            width: '100%',
            marginTop: message || children ? '0' : '8px',
            flexWrap: 'wrap',
          }}
        >
          {/* Cancel / Secondary Action (Omitted in single-action alerts) */}
          {cancelLabel && (
            <button
              ref={cancelBtnRef}
              type="button"
              onClick={handleCancelClick}
              disabled={isLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 18px',
                fontSize: '13.5px',
                fontWeight: 600,
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                color: '#334155',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 120ms ease-in-out',
                minWidth: '120px',
                opacity: isLoading ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isLoading) e.currentTarget.style.backgroundColor = '#F8FAFC';
              }}
              onMouseLeave={(e) => {
                if (!isLoading) e.currentTarget.style.backgroundColor = '#FFFFFF';
              }}
            >
              {cancelLabel}
            </button>
          )}

          {/* Confirm / Primary Action */}
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={handleConfirmClick}
            disabled={isLoading}
            style={getConfirmButtonStyle()}
            onMouseEnter={(e) => {
              if (isLoading) return;
              if (effectiveConfirmVariant === 'danger') {
                e.currentTarget.style.backgroundColor = '#B91C1C';
              } else if (effectiveConfirmVariant === 'warning') {
                e.currentTarget.style.backgroundColor = '#B45309';
              } else {
                e.currentTarget.style.backgroundColor = '#3651D4';
              }
            }}
            onMouseLeave={(e) => {
              if (isLoading) return;
              if (effectiveConfirmVariant === 'danger') {
                e.currentTarget.style.backgroundColor = '#DC2626';
              } else if (effectiveConfirmVariant === 'warning') {
                e.currentTarget.style.backgroundColor = '#D97706';
              } else {
                e.currentTarget.style.backgroundColor = '#4361EE';
              }
            }}
          >
            {isLoading && <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
