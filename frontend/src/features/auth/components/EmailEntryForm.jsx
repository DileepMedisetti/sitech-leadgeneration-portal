import React, { useState } from 'react';
import { Mail, ArrowRight, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import AuthStatusCard from './AuthStatusCard';

export default function EmailEntryForm({
  onSubmitEmail,
  isLoading,
  statusState,
  initialEmail = '',
}) {
  const [email, setEmail] = useState(initialEmail);
  const [validationError, setValidationError] = useState('');

  const validateEmailFormat = (val) => {
    const trimmed = (val || '').trim();
    if (!trimmed) {
      return 'Please enter your email address.';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return 'Please enter a valid email address (e.g. name@institution.edu).';
    }
    return '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const error = validateEmailFormat(email);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError('');
    onSubmitEmail(email.trim());
  };

  return (
    <div className="w-full flex flex-col">
      <CardHeader className="p-0 pb-6 text-left">
        <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
          Welcome back
        </CardTitle>
        <CardDescription className="text-sm text-slate-500 mt-1.5 leading-relaxed">
          Sign in to your Sitech Series workspace with a secure six-digit verification code sent to your email.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        {/* Optional fallback inline status card if present */}
        {statusState && (
          <div className="mb-5">
            <AuthStatusCard
              type={statusState.type}
              title={statusState.title}
              message={statusState.message}
              remainingAttempts={statusState.remainingAttempts}
              lockoutRemainingSeconds={statusState.lockoutRemainingSeconds}
              onAction={statusState.onAction}
              actionLabel={statusState.actionLabel}
              isActionLoading={statusState.isActionLoading}
            />
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="auth-email-input" className="mb-0">
                Email Address <span className="text-red-500 font-bold">*</span>
              </Label>
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Mail className="h-4 w-4" aria-hidden="true" />
              </div>

              <Input
                id="auth-email-input"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="e.g. name@university.edu"
                value={email}
                disabled={isLoading}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (validationError) setValidationError('');
                }}
                className={`pl-10 h-11 text-sm bg-white transition-all ${
                  validationError
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-slate-300 focus:border-blue-600 focus:ring-blue-600/20'
                }`}
                aria-invalid={Boolean(validationError)}
                aria-describedby={validationError ? 'email-error-message' : undefined}
              />
            </div>

            {validationError && (
              <p
                id="email-error-message"
                role="alert"
                className="text-xs font-semibold text-red-600 mt-1 flex items-center gap-1 animate-fadeIn"
              >
                {validationError}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 text-sm font-semibold tracking-wide bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg shadow-sm transition-all"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                <span>Sending verification code...</span>
              </>
            ) : (
              <>
                <span>Send Verification Code</span>
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </>
            )}
          </Button>
        </form>

        {/* Security Trust Note */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-500 select-none">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Passwordless enterprise single-session challenge</span>
        </div>
      </CardContent>
    </div>
  );
}
