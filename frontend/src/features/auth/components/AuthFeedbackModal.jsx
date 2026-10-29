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
import { Button } from '../../../components/ui/button';

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
  type, // 'otp_sent' | 'not_registered' | 'delivery_failed' | 'login_success' | 'incorrect' | 'expired' | 'locked' | 'inactive' | 'server_error' | 'email_in_use' | 'account_restored' | 'confirm_delete'
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
          badgeBg: 'bg-emerald-500 text-white',
          badgeRing: 'ring-8 ring-emerald-500/15',
          badgeIcon: <Check className="h-7 w-7" strokeWidth={3} />,
          defaultTitle: 'Verification code sent',
          defaultMessage: destinationEmail
            ? `We've sent a six-digit verification code to ${destinationEmail}.`
            : "We've sent a six-digit verification code to your registered email address.",
          defaultActionLabel: 'Continue',
          buttonVariant: 'default',
        };

      // 2. Unregistered Email Address (Priority 1 & 5)
      case 'not_registered':
        return {
          badgeBg: 'bg-red-500 text-white',
          badgeRing: 'ring-8 ring-red-500/15',
          badgeIcon: <X className="h-7 w-7" strokeWidth={3} />,
          defaultTitle: 'Email not registered',
          defaultMessage:
            'This email address is not registered with Sitech Series. Please check your email or contact your administrator.',
          defaultActionLabel: 'Try again',
          buttonVariant: 'default',
        };

      // 2b. Global Email In Use Conflict
      case 'email_in_use':
        return {
          badgeBg: 'bg-red-500 text-white',
          badgeRing: 'ring-8 ring-red-500/15',
          badgeIcon: <X className="h-7 w-7" strokeWidth={3} />,
          defaultTitle: 'Email already in use',
          defaultMessage:
            'This email address is already in use by another account. Please use a different email address.',
          defaultActionLabel: 'Try Another Email',
          buttonVariant: 'default',
        };

      // 2c. Account Restored
      case 'account_restored':
        return {
          badgeBg: 'bg-emerald-500 text-white',
          badgeRing: 'ring-8 ring-emerald-500/15',
          badgeIcon: <Check className="h-7 w-7" strokeWidth={3} />,
          defaultTitle: 'Account restored',
          defaultMessage:
            'The email account has been restored and is available in your Email Accounts page.',
          defaultActionLabel: 'View Email Accounts',
          buttonVariant: 'default',
        };

      // 2d. Permanent Delete Confirmation
      case 'confirm_delete':
        return {
          badgeBg: 'bg-red-600 text-white',
          badgeRing: 'ring-8 ring-red-600/18',
          badgeIcon: <AlertTriangle className="h-7 w-7" strokeWidth={2.6} />,
          defaultTitle: 'Permanently delete this email account?',
          defaultMessage:
            'This action cannot be undone. The email account will be permanently removed from your connected accounts.',
          defaultActionLabel: 'Permanently Delete',
          buttonVariant: 'destructive',
        };

      // 3. OTP Delivery Failure
      case 'delivery_failed':
        return {
          badgeBg: 'bg-red-500 text-white',
          badgeRing: 'ring-8 ring-red-500/15',
          badgeIcon: <X className="h-7 w-7" strokeWidth={3} />,
          defaultTitle: 'Verification email not sent',
          defaultMessage: "We couldn't send your verification code. Please try again later.",
          defaultActionLabel: 'Try again',
          buttonVariant: 'default',
        };

      // 4. Successful Login / Session Established
      case 'login_success':
        return {
          badgeBg: 'bg-emerald-500 text-white',
          badgeRing: 'ring-8 ring-emerald-500/15',
          badgeIcon: <Check className="h-7 w-7" strokeWidth={3} />,
          defaultTitle: 'Login successful',
          defaultMessage:
            'Your email has been verified. Welcome to your Sitech Series workspace.',
          defaultActionLabel: 'Enter Workspace',
          buttonVariant: 'default',
        };

      // 5. Incorrect 6-digit OTP
      case 'incorrect':
        return {
          badgeBg: 'bg-red-500 text-white',
          badgeRing: 'ring-8 ring-red-500/15',
          badgeIcon: <X className="h-7 w-7" strokeWidth={3} />,
          defaultTitle: 'Verification failed',
          defaultMessage:
            remainingAttempts !== undefined && remainingAttempts !== null
              ? `Incorrect verification code. ${remainingAttempts} attempt(s) remaining.`
              : 'The verification code entered does not match. Please verify and try again.',
          defaultActionLabel: 'Try again',
          buttonVariant: 'default',
        };

      // 6. Expired OTP
      case 'expired':
        return {
          badgeBg: 'bg-amber-500 text-white',
          badgeRing: 'ring-8 ring-amber-500/15',
          badgeIcon: <Clock className="h-7 w-7" strokeWidth={2.8} />,
          defaultTitle: 'Code expired',
          defaultMessage: 'The verification code has expired. Please request a new code.',
          defaultActionLabel: 'Request New Code',
          buttonVariant: 'default',
        };

      // 7. Account Locked (5 failed attempts)
      case 'locked':
        return {
          badgeBg: 'bg-red-600 text-white',
          badgeRing: 'ring-8 ring-red-600/18',
          badgeIcon: <Lock className="h-6 w-6" strokeWidth={2.6} />,
          defaultTitle: 'Too many attempts',
          defaultMessage:
            lockoutRemainingSeconds
              ? `Maximum verification attempts exceeded. Account is locked for ${formatLockoutDuration(lockoutRemainingSeconds)}.`
              : 'Maximum verification attempts exceeded. Account is locked for 24 hours.',
          defaultActionLabel: 'Close',
          buttonVariant: 'secondary',
        };

      // 8. Inactive Account
      case 'inactive':
        return {
          badgeBg: 'bg-red-500 text-white',
          badgeRing: 'ring-8 ring-red-500/15',
          badgeIcon: <AlertTriangle className="h-7 w-7" strokeWidth={2.6} />,
          defaultTitle: 'Account inactive',
          defaultMessage:
            'This account is inactive. Please contact your workspace administrator.',
          defaultActionLabel: 'Understood',
          buttonVariant: 'default',
        };

      // 9. Generic / Server / Network Error
      case 'server_error':
      default:
        return {
          badgeBg: 'bg-red-500 text-white',
          badgeRing: 'ring-8 ring-red-500/15',
          badgeIcon: <X className="h-7 w-7" strokeWidth={3} />,
          defaultTitle: 'Unable to complete your request',
          defaultMessage:
            message || "We couldn't connect to the server. Please check your connection and try again.",
          defaultActionLabel: 'Try again',
          buttonVariant: 'default',
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs auth-modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] bg-white rounded-2xl border border-slate-200/90 shadow-2xl shadow-slate-950/20 p-7 sm:p-8 flex flex-col items-center text-center auth-modal-content"
      >
        {/* Top Circular Badge */}
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 shrink-0 ${config.badgeBg} ${config.badgeRing} shadow-sm`}
          aria-hidden="true"
        >
          {config.badgeIcon}
        </div>

        {/* Modal Heading */}
        <h3
          id="auth-modal-title"
          className="text-xl font-bold tracking-tight text-slate-900 mb-2 leading-snug"
        >
          {finalTitle}
        </h3>

        {/* Modal Message */}
        <p
          id="auth-modal-desc"
          className="text-sm text-slate-600 leading-relaxed mb-6 max-w-[340px] break-words"
        >
          {finalMessage}
        </p>

        {/* Action Button(s) */}
        {secondaryActionLabel ? (
          <div className="flex gap-3 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={onSecondaryAction || onClose}
              disabled={isLoading}
              className="flex-1 h-11 text-sm font-semibold"
            >
              {secondaryActionLabel}
            </Button>
            <Button
              ref={actionButtonRef}
              type="button"
              variant={config.buttonVariant}
              onClick={handlePrimaryClick}
              disabled={isLoading}
              className="flex-1 h-11 text-sm font-semibold"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-1.5" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>{finalActionLabel}</span>
              )}
            </Button>
          </div>
        ) : (
          <Button
            ref={actionButtonRef}
            type="button"
            variant={config.buttonVariant}
            onClick={handlePrimaryClick}
            disabled={isLoading}
            className="w-full h-11 text-sm font-semibold tracking-wide"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>{finalActionLabel}</span>
                {type === 'otp_sent' || type === 'login_success' ? (
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                ) : null}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
