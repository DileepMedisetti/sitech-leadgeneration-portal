import React from 'react';
import {
  Check,
  X,
  Clock,
  Lock,
  RefreshCw,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';

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
          containerClass: 'bg-emerald-50/70 border-emerald-200 text-emerald-900',
          badgeClass: 'bg-emerald-500 text-white',
          titleColor: 'text-emerald-900',
          badgeIcon: <Check className="h-3.5 w-3.5" strokeWidth={3} />,
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
          containerClass: 'bg-emerald-50/70 border-emerald-200 text-emerald-900',
          badgeClass: 'bg-emerald-500 text-white',
          titleColor: 'text-emerald-900',
          badgeIcon: <Check className="h-3.5 w-3.5" strokeWidth={3} />,
          defaultTitle: 'Login successful',
          defaultMessage: 'Your email has been verified. Welcome to your Sitech Series workspace.',
          ariaRole: 'status',
          ariaLive: 'polite',
        };

      // 3. Incorrect 6-digit OTP
      case 'incorrect':
        return {
          containerClass: 'bg-red-50/70 border-red-200 text-red-900',
          badgeClass: 'bg-red-500 text-white',
          titleColor: 'text-red-900',
          badgeIcon: <X className="h-3.5 w-3.5" strokeWidth={3} />,
          defaultTitle: 'Verification failed',
          defaultMessage: 'The verification code is incorrect. Please check it and try again.',
          ariaRole: 'alert',
          ariaLive: 'assertive',
        };

      // 4. Expired OTP
      case 'expired':
        return {
          containerClass: 'bg-amber-50/70 border-amber-200 text-amber-900',
          badgeClass: 'bg-amber-500 text-white',
          titleColor: 'text-amber-900',
          badgeIcon: <Clock className="h-3.5 w-3.5" strokeWidth={2.5} />,
          defaultTitle: 'Verification code expired',
          defaultMessage: 'The verification code has expired. Please request a new code.',
          ariaRole: 'alert',
          ariaLive: 'assertive',
        };

      // 5. Account Locked after 5 failed attempts
      case 'locked':
        return {
          containerClass: 'bg-red-50/70 border-red-300 text-red-950',
          badgeClass: 'bg-red-600 text-white',
          titleColor: 'text-red-950',
          badgeIcon: <Lock className="h-3.5 w-3.5" strokeWidth={2.5} />,
          defaultTitle: 'Account locked',
          defaultMessage: 'Maximum verification attempts exceeded. Account is locked for 24 hours.',
          ariaRole: 'alert',
          ariaLive: 'assertive',
        };

      // 6. Delivery Failure
      case 'delivery_failed':
        return {
          containerClass: 'bg-red-50/70 border-red-200 text-red-900',
          badgeClass: 'bg-red-500 text-white',
          titleColor: 'text-red-900',
          badgeIcon: <X className="h-3.5 w-3.5" strokeWidth={3} />,
          defaultTitle: 'Email delivery failed',
          defaultMessage: "We couldn't send your verification code. Please check your address and try again later.",
          ariaRole: 'alert',
          ariaLive: 'assertive',
        };

      // 7. Invalid Email Format
      case 'invalid_email':
        return {
          containerClass: 'bg-red-50/70 border-red-200 text-red-900',
          badgeClass: 'bg-red-500 text-white',
          titleColor: 'text-red-900',
          badgeIcon: <AlertCircle className="h-3.5 w-3.5" strokeWidth={2.5} />,
          defaultTitle: 'Invalid email',
          defaultMessage: 'Please enter a valid email address.',
          ariaRole: 'alert',
          ariaLive: 'assertive',
        };

      // 8. Server / Network Error
      case 'server_error':
      default:
        return {
          containerClass: 'bg-red-50/70 border-red-200 text-red-900',
          badgeClass: 'bg-red-500 text-white',
          titleColor: 'text-red-900',
          badgeIcon: <X className="h-3.5 w-3.5" strokeWidth={3} />,
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

  return (
    <div
      role={config.ariaRole}
      aria-live={config.ariaLive}
      className={`rounded-xl border p-3.5 transition-all text-xs flex flex-col gap-2 ${config.containerClass}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-xs ${config.badgeClass}`}
          aria-hidden="true"
        >
          {config.badgeIcon}
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          <h4 className={`text-xs font-bold leading-snug mb-0.5 ${config.titleColor}`}>
            {title || config.defaultTitle}
          </h4>
          <p className="text-slate-600 leading-relaxed m-0">
            {message || config.defaultMessage}
          </p>

          {remainingAttempts !== undefined && remainingAttempts !== null && remainingAttempts > 0 && (
            <div className="mt-1.5 font-semibold text-red-600 flex items-center gap-1">
              <span>{remainingAttempts} attempt(s) remaining before a 24-hour security lockout.</span>
            </div>
          )}

          {type === 'locked' && lockoutRemainingSeconds && (
            <div className="mt-1.5 font-bold text-red-700">
              Remaining lockout duration: {formatLockoutTime(lockoutRemainingSeconds)}
            </div>
          )}
        </div>
      </div>

      {/* Action button - only shown if permitted (never for locked account) */}
      {type !== 'locked' && onAction && actionLabel && (
        <div className="flex justify-end mt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAction}
            disabled={isActionLoading}
            className="h-8 px-3 text-xs font-semibold gap-1.5 bg-white border-slate-200"
          >
            {isActionLoading ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : type === 'otp_sent' || type === 'login_success' || type === 'success' ? (
              <ArrowRight className="h-3 w-3" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            <span>{actionLabel}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
