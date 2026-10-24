import React from 'react';
import {
  Check,
  X,
  Clock,
  Lock,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

export default function AuthStatusCard({
  type, // 'otp_sent' | 'login_success' | 'success' | 'incorrect' | 'expired' | 'locked' | 'delivery_failed' | 'server_error' | 'invalid_email'
  title,
  message,
  destinationEmail,
  remainingAttempts,
  lockoutRemainingSeconds,
  onAction,
  actionLabel,
  isActionLoading,
}) {
  const getStatusConfig = () => {
    switch (type) {
      // 1. Successful OTP Request
      case 'otp_sent':
        return {
          variant: 'success',
          badgeType: 'check',
          badgeBg: '#10b981',
          bgColor: '#f0fdf4',
          borderColor: '#bbf7d0',
          titleColor: '#15803d',
          defaultTitle: 'Verification code sent',
          defaultMessage: destinationEmail
            ? `We've sent a six-digit verification code to ${destinationEmail}.`
            : "We've sent a six-digit verification code to your email address.",
          ariaRole: 'status',
          ariaLive: 'polite',
        };

      // 2. Successful OTP Verification / Session Established
      case 'login_success':
      case 'success':
        return {
          variant: 'success',
          badgeType: 'check',
          badgeBg: '#10b981',
          bgColor: '#f0fdf4',
          borderColor: '#bbf7d0',
          titleColor: '#15803d',
          defaultTitle: 'Login successful',
          defaultMessage: 'Your email has been verified. Welcome to your Sitech Series workspace.',
          ariaRole: 'status',
          ariaLive: 'polite',
        };

      // 3. Incorrect 6-digit OTP
      case 'incorrect':
        return {
          variant: 'error',
          badgeType: 'x',
          badgeBg: '#ef4444',
          bgColor: '#fef2f2',
          borderColor: '#fecaca',
          titleColor: '#b91c1c',
          defaultTitle: 'Verification failed',
          defaultMessage: 'The verification code is incorrect. Please check it and try again.',
          ariaRole: 'alert',
          ariaLive: 'assertive',
        };

      // 4. Expired OTP
      case 'expired':
        return {
          variant: 'warning',
          badgeType: 'clock',
          badgeBg: '#f59e0b',
          bgColor: '#fffbeb',
          borderColor: '#fde68a',
          titleColor: '#b45309',
          defaultTitle: 'Verification code expired',
          defaultMessage: 'The verification code has expired. Please request a new code.',
          ariaRole: 'alert',
          ariaLive: 'assertive',
        };

      // 5. Account Locked after 5 failed attempts
      case 'locked':
        return {
          variant: 'error',
          badgeType: 'lock',
          badgeBg: '#dc2626',
          bgColor: '#fef2f2',
          borderColor: '#f87171',
          titleColor: '#991b1b',
          defaultTitle: 'Account locked',
          defaultMessage: 'Maximum verification attempts exceeded. Account is locked for 24 hours.',
          ariaRole: 'alert',
          ariaLive: 'assertive',
        };

      // 6. Delivery Failure
      case 'delivery_failed':
        return {
          variant: 'error',
          badgeType: 'x',
          badgeBg: '#ef4444',
          bgColor: '#fef2f2',
          borderColor: '#fecaca',
          titleColor: '#b91c1c',
          defaultTitle: 'Email delivery failed',
          defaultMessage: "We couldn't send your verification code. Please check your address and try again later.",
          ariaRole: 'alert',
          ariaLive: 'assertive',
        };

      // 7. Invalid Email Format
      case 'invalid_email':
        return {
          variant: 'error',
          badgeType: 'x',
          badgeBg: '#ef4444',
          bgColor: '#fef2f2',
          borderColor: '#fecaca',
          titleColor: '#b91c1c',
          defaultTitle: 'Invalid email',
          defaultMessage: 'Please enter a valid email address.',
          ariaRole: 'alert',
          ariaLive: 'assertive',
        };

      // 8. Server / Network Error
      case 'server_error':
      default:
        return {
          variant: 'error',
          badgeType: 'x',
          badgeBg: '#ef4444',
          bgColor: '#fef2f2',
          borderColor: '#fecaca',
          titleColor: '#b91c1c',
          defaultTitle: 'Connection error',
          defaultMessage: "We couldn't complete your request. Check your connection and try again.",
          ariaRole: 'alert',
          ariaLive: 'assertive',
        };
    }
  };

  const config = getStatusConfig();

  const formatLockoutTime = (seconds) => {
    if (!seconds || seconds <= 0) return '24 hours';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} minutes`;
  };

  const renderBadgeIcon = () => {
    let iconElement = null;
    if (config.badgeType === 'check') {
      iconElement = <Check size={14} color="#ffffff" strokeWidth={3} />;
    } else if (config.badgeType === 'x') {
      iconElement = <X size={14} color="#ffffff" strokeWidth={3} />;
    } else if (config.badgeType === 'clock') {
      iconElement = <Clock size={14} color="#ffffff" strokeWidth={2.5} />;
    } else if (config.badgeType === 'lock') {
      iconElement = <Lock size={13} color="#ffffff" strokeWidth={2.5} />;
    }

    return (
      <div
        style={{
          width: '26px',
          height: '26px',
          borderRadius: '50%',
          backgroundColor: config.badgeBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: `0 1px 3px ${config.badgeBg}40`,
        }}
        aria-hidden="true"
      >
        {iconElement}
      </div>
    );
  };

  return (
    <div
      role={config.ariaRole}
      aria-live={config.ariaLive}
      className="auth-status-card"
      style={{
        backgroundColor: config.bgColor,
        border: `1px solid ${config.borderColor}`,
        borderRadius: '10px',
        padding: '14px 16px',
        margin: '14px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
        transition: 'all 180ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {renderBadgeIcon()}

        <div style={{ flex: 1, minWidth: 0 }}>
          <h4
            style={{
              margin: '0 0 3px 0',
              fontSize: '13.5px',
              fontWeight: 700,
              color: config.titleColor,
              lineHeight: 1.3,
            }}
          >
            {title || config.defaultTitle}
          </h4>
          <p
            style={{
              margin: 0,
              fontSize: '12.5px',
              color: 'var(--text-secondary, #475569)',
              lineHeight: 1.45,
            }}
          >
            {message || config.defaultMessage}
          </p>

          {remainingAttempts !== undefined && remainingAttempts !== null && remainingAttempts > 0 && (
            <div
              style={{
                marginTop: '6px',
                fontSize: '11.5px',
                fontWeight: 600,
                color: '#b91c1c',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{remainingAttempts} attempt(s) remaining before a 24-hour security lockout.</span>
            </div>
          )}

          {type === 'locked' && lockoutRemainingSeconds && (
            <div
              style={{
                marginTop: '6px',
                fontSize: '11.5px',
                fontWeight: 700,
                color: '#991b1b',
              }}
            >
              Remaining lockout duration: {formatLockoutTime(lockoutRemainingSeconds)}
            </div>
          )}
        </div>
      </div>

      {/* Action button - only shown if permitted (never for locked account) */}
      {type !== 'locked' && onAction && actionLabel && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
          <button
            type="button"
            onClick={onAction}
            disabled={isActionLoading}
            className="btn btn-secondary btn-sm"
            style={{
              fontSize: '12px',
              height: '30px',
              padding: '0 12px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isActionLoading ? (
              <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
            ) : type === 'otp_sent' || type === 'login_success' || type === 'success' ? (
              <ArrowRight size={13} />
            ) : (
              <RefreshCw size={13} />
            )}
            <span>{actionLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
}
