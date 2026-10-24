import React, { useEffect, useRef } from 'react';
import {
  Check,
  X,
  Clock,
  Lock,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

/**
 * Centered Feedback Popup Modal for Authentication flows
 * Priority 5 Requirement:
 * - Professional centered modal with dark overlay backdrop
 * - Refined white card
 * - Circular icon badge
 * - Clear heading, message, and prominent action button
 * - Keyboard (Escape) & focus accessible
 */
export default function AuthFeedbackModal({
  isOpen,
  type, // 'otp_sent' | 'not_registered' | 'delivery_failed' | 'login_success' | 'incorrect' | 'expired' | 'locked' | 'server_error'
  title,
  message,
  destinationEmail,
  remainingAttempts,
  lockoutRemainingSeconds,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  onClose,
  isLoading = false,
}) {
  const actionButtonRef = useRef(null);

  // Auto-focus primary action button on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        actionButtonRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (type !== 'locked' && !isLoading && onClose) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, type, isLoading, onClose]);

  if (!isOpen) return null;

  const formatLockoutDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '24 hours';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} hour(s) ${minutes} minute(s)`;
    }
    return `${minutes} minute(s)`;
  };

  const getModalConfig = () => {
    switch (type) {
      // 1. Successful OTP Request
      case 'otp_sent':
        return {
          badgeBg: '#10B981', // emerald-500
          badgeIcon: <Check size={28} color="#ffffff" strokeWidth={3} />,
          badgeRing: 'rgba(16, 185, 129, 0.15)',
          defaultTitle: 'Verification code sent',
          defaultMessage: destinationEmail
            ? `We've sent a six-digit verification code to ${destinationEmail}.`
            : "We've sent a six-digit verification code to your registered email address.",
          defaultActionLabel: 'Continue',
          buttonBg: '#4361EE',
          buttonHoverBg: '#3651D4',
        };

      // 2. Unregistered Email Address (Priority 1 & 5)
      case 'not_registered':
        return {
          badgeBg: '#EF4444', // red-500
          badgeIcon: <X size={28} color="#ffffff" strokeWidth={3} />,
          badgeRing: 'rgba(239, 68, 68, 0.15)',
          defaultTitle: 'Email not registered',
          defaultMessage:
            'This email address is not registered with Sitech Series. Please check your email or contact your administrator.',
          defaultActionLabel: 'Try again',
          buttonBg: '#4361EE',
          buttonHoverBg: '#3651D4',
        };

      // 2b. Global Email In Use Conflict (Additional Master Requirement)
      case 'email_in_use':
        return {
          badgeBg: '#EF4444', // red-500
          badgeIcon: <X size={28} color="#ffffff" strokeWidth={3} />,
          badgeRing: 'rgba(239, 68, 68, 0.15)',
          defaultTitle: 'Email already in use',
          defaultMessage:
            'This email address is already in use by another account. Please use a different email address.',
          defaultActionLabel: 'Try Another Email',
          buttonBg: '#4361EE',
          buttonHoverBg: '#3651D4',
        };

      // 2c. Account Restored
      case 'account_restored':
        return {
          badgeBg: '#10B981', // emerald-500
          badgeIcon: <Check size={28} color="#ffffff" strokeWidth={3} />,
          badgeRing: 'rgba(16, 185, 129, 0.15)',
          defaultTitle: 'Account restored',
          defaultMessage:
            'The email account has been restored and is available in your Email Accounts page.',
          defaultActionLabel: 'View Email Accounts',
          buttonBg: '#10B981',
          buttonHoverBg: '#059669',
        };

      // 2d. Permanent Delete Confirmation
      case 'confirm_delete':
        return {
          badgeBg: '#DC2626', // red-600
          badgeIcon: <AlertTriangle size={28} color="#ffffff" strokeWidth={2.6} />,
          badgeRing: 'rgba(220, 38, 38, 0.18)',
          defaultTitle: 'Permanently delete this email account?',
          defaultMessage:
            'This action cannot be undone. The email account will be permanently removed from your connected accounts.',
          defaultActionLabel: 'Permanently Delete',
          buttonBg: '#DC2626',
          buttonHoverBg: '#B91C1C',
        };

      // 3. OTP Delivery Failure
      case 'delivery_failed':
        return {
          badgeBg: '#EF4444',
          badgeIcon: <X size={28} color="#ffffff" strokeWidth={3} />,
          badgeRing: 'rgba(239, 68, 68, 0.15)',
          defaultTitle: 'Verification email not sent',
          defaultMessage: "We couldn't send your verification code. Please try again later.",
          defaultActionLabel: 'Try again',
          buttonBg: '#4361EE',
          buttonHoverBg: '#3651D4',
        };

      // 4. Successful Login / Session Established
      case 'login_success':
        return {
          badgeBg: '#10B981',
          badgeIcon: <Check size={28} color="#ffffff" strokeWidth={3} />,
          badgeRing: 'rgba(16, 185, 129, 0.15)',
          defaultTitle: 'Login successful',
          defaultMessage:
            'Your email has been verified. Welcome to your Sitech Series workspace.',
          defaultActionLabel: 'Enter Workspace',
          buttonBg: '#10B981',
          buttonHoverBg: '#059669',
        };

      // 5. Incorrect 6-digit OTP
      case 'incorrect':
        return {
          badgeBg: '#EF4444',
          badgeIcon: <X size={28} color="#ffffff" strokeWidth={3} />,
          badgeRing: 'rgba(239, 68, 68, 0.15)',
          defaultTitle: 'Verification failed',
          defaultMessage:
            remainingAttempts !== undefined && remainingAttempts !== null
              ? `Incorrect verification code. ${remainingAttempts} attempt(s) remaining.`
              : 'The verification code entered does not match. Please verify and try again.',
          defaultActionLabel: 'Try again',
          buttonBg: '#4361EE',
          buttonHoverBg: '#3651D4',
        };

      // 6. Expired OTP
      case 'expired':
        return {
          badgeBg: '#F59E0B', // amber-500
          badgeIcon: <Clock size={28} color="#ffffff" strokeWidth={2.8} />,
          badgeRing: 'rgba(245, 158, 11, 0.15)',
          defaultTitle: 'Code expired',
          defaultMessage: 'The verification code has expired. Please request a new code.',
          defaultActionLabel: 'Request New Code',
          buttonBg: '#4361EE',
          buttonHoverBg: '#3651D4',
        };

      // 7. Account Locked (5 failed attempts)
      case 'locked':
        return {
          badgeBg: '#DC2626', // red-600
          badgeIcon: <Lock size={26} color="#ffffff" strokeWidth={2.6} />,
          badgeRing: 'rgba(220, 38, 38, 0.18)',
          defaultTitle: 'Too many attempts',
          defaultMessage:
            lockoutRemainingSeconds
              ? `Maximum verification attempts exceeded. Account is locked for ${formatLockoutDuration(lockoutRemainingSeconds)}.`
              : 'Maximum verification attempts exceeded. Account is locked for 24 hours.',
          defaultActionLabel: 'Close',
          buttonBg: '#64748B',
          buttonHoverBg: '#475569',
        };

      // 8. Inactive Account
      case 'inactive':
        return {
          badgeBg: '#EF4444',
          badgeIcon: <AlertTriangle size={28} color="#ffffff" strokeWidth={2.6} />,
          badgeRing: 'rgba(239, 68, 68, 0.15)',
          defaultTitle: 'Account inactive',
          defaultMessage:
            'This account is inactive. Please contact your workspace administrator.',
          defaultActionLabel: 'Understood',
          buttonBg: '#4361EE',
          buttonHoverBg: '#3651D4',
        };

      // 9. Generic / Server / Network Error
      case 'server_error':
      default:
        return {
          badgeBg: '#EF4444',
          badgeIcon: <X size={28} color="#ffffff" strokeWidth={3} />,
          badgeRing: 'rgba(239, 68, 68, 0.15)',
          defaultTitle: 'Unable to complete your request',
          defaultMessage:
            message || "We couldn't connect to the server. Please check your connection and try again.",
          defaultActionLabel: 'Try again',
          buttonBg: '#4361EE',
          buttonHoverBg: '#3651D4',
        };
    }
  };

  const config = getModalConfig();
  const finalTitle = title || config.defaultTitle;
  const finalMessage = message || config.defaultMessage;
  const finalActionLabel = actionLabel || config.defaultActionLabel;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && type !== 'locked' && !isLoading && onClose) {
      onClose();
    }
  };

  const handlePrimaryClick = () => {
    if (onAction) {
      onAction();
    } else if (onClose) {
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      aria-describedby="auth-modal-desc"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(16, 24, 43, 0.65)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'authFadeIn 180ms ease-out forwards',
      }}
    >
      <style>{`
        @keyframes authFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes authPopIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '430px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          boxShadow: '0 24px 48px -12px rgba(16, 24, 43, 0.28), 0 8px 16px -4px rgba(16, 24, 43, 0.08)',
          padding: 'clamp(24px, 4vh, 32px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          boxSizing: 'border-box',
          animation: 'authPopIn 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        {/* Top Circular Badge */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: config.badgeBg,
            boxShadow: `0 0 0 8px ${config.badgeRing}, 0 6px 14px ${config.badgeBg}33`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          {config.badgeIcon}
        </div>

        {/* Modal Heading */}
        <h3
          id="auth-modal-title"
          style={{
            fontSize: '20px',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: '#10182B',
            margin: '0 0 10px 0',
            lineHeight: 1.3,
          }}
        >
          {finalTitle}
        </h3>

        {/* Modal Message */}
        <p
          id="auth-modal-desc"
          style={{
            fontSize: '14px',
            color: '#667085',
            lineHeight: 1.55,
            margin: '0 0 24px 0',
            maxWidth: '360px',
            wordBreak: 'break-word',
          }}
        >
          {finalMessage}
        </p>

        {/* Action Button(s) */}
        {secondaryActionLabel ? (
          <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
            <button
              type="button"
              onClick={onSecondaryAction || onClose}
              disabled={isLoading}
              style={{
                flex: 1,
                height: '46px',
                borderRadius: '10px',
                backgroundColor: '#F1F5F9',
                color: '#475569',
                fontSize: '14px',
                fontWeight: 700,
                border: '1px solid #CBD5E1',
                cursor: 'pointer',
                transition: 'background-color 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#E2E8F0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#F1F5F9';
              }}
            >
              {secondaryActionLabel}
            </button>
            <button
              ref={actionButtonRef}
              type="button"
              onClick={handlePrimaryClick}
              disabled={isLoading}
              style={{
                flex: 1,
                height: '46px',
                borderRadius: '10px',
                backgroundColor: config.buttonBg,
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 700,
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: `0 4px 12px ${config.buttonBg}40`,
                transition: 'background-color 160ms ease',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = config.buttonHoverBg;
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = config.buttonBg;
                }
              }}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={17} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Processing...</span>
                </>
              ) : (
                <span>{finalActionLabel}</span>
              )}
            </button>
          </div>
        ) : (
          <button
            ref={actionButtonRef}
            type="button"
            onClick={handlePrimaryClick}
            disabled={isLoading}
            style={{
              width: '100%',
              height: '46px',
              borderRadius: '10px',
              backgroundColor: config.buttonBg,
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 700,
              letterSpacing: '0.01em',
              border: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.75 : 1,
              boxShadow: `0 4px 12px ${config.buttonBg}40`,
              transition: 'background-color 160ms ease, transform 120ms ease, box-shadow 160ms ease',
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = config.buttonHoverBg;
                e.currentTarget.style.boxShadow = `0 6px 16px ${config.buttonBg}50`;
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = config.buttonBg;
                e.currentTarget.style.boxShadow = `0 4px 12px ${config.buttonBg}40`;
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
            onMouseDown={(e) => {
              if (!isLoading) {
                e.currentTarget.style.transform = 'scale(0.99)';
              }
            }}
            onMouseUp={(e) => {
              if (!isLoading) {
                e.currentTarget.style.transform = 'scale(1)';
              }
            }}
          >
            {isLoading ? (
              <>
                <RefreshCw size={17} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>{finalActionLabel}</span>
                {type === 'otp_sent' || type === 'login_success' ? (
                  <ArrowRight size={17} />
                ) : null}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
