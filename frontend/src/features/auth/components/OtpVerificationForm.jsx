import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import {
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '../../../components/ui/card';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import AuthStatusCard from './AuthStatusCard';

export default function OtpVerificationForm({
  email,
  onVerify,
  onResend,
  onChangeEmail,
  isVerifying,
  isResending,
  statusState,
  initialCooldown = 60,
}) {
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(initialCooldown);
  const inputRefs = useRef([]);

  // Auto-focus the first input on initial mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleDigitChange = (index, value) => {
    const numericChar = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = numericChar;
    setOtpDigits(newDigits);

    // If character entered, auto-focus next field
    if (numericChar && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0 && inputRefs.current[index - 1]) {
        const newDigits = [...otpDigits];
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
        inputRefs.current[index - 1].focus();
      } else if (otpDigits[index]) {
        const newDigits = [...otpDigits];
        newDigits[index] = '';
        setOtpDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pastedData[i] || '';
    }
    setOtpDigits(newDigits);

    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const isComplete = otpDigits.every((d) => d !== '');
  const otpCode = otpDigits.join('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isComplete && !isVerifying) {
      onVerify(otpCode);
    }
  };

  const handleTriggerResend = () => {
    if (cooldown === 0 && !isResending) {
      onResend();
      setCooldown(60);
    }
  };

  const isLocked = statusState?.type === 'locked';

  return (
    <div className="w-full flex flex-col">
      <button
        type="button"
        onClick={onChangeEmail}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors p-0 mb-5 self-start cursor-pointer border-none bg-transparent"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Use a different email</span>
      </button>

      <CardHeader className="p-0 pb-6 text-left">
        <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
          Verify your email
        </CardTitle>
        <CardDescription className="text-sm text-slate-500 mt-1.5 leading-relaxed">
          Enter the six-digit verification code sent to{' '}
          <strong className="text-slate-900 font-semibold break-all">{email}</strong>
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        {statusState && (
          <div className="mb-5">
            <AuthStatusCard
              type={statusState.type}
              title={statusState.title}
              message={statusState.message}
              destinationEmail={statusState.destinationEmail || email}
              remainingAttempts={statusState.remainingAttempts}
              lockoutRemainingSeconds={statusState.lockoutRemainingSeconds}
              onAction={statusState.onAction}
              actionLabel={statusState.actionLabel}
              isActionLoading={statusState.isActionLoading}
            />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="otp-box-0" className="mb-2.5">
              Enter 6-digit code <span className="text-red-500 font-bold">*</span>
            </Label>

            {/* 6 Digit Numeric Boxes */}
            <div
              onPaste={handlePaste}
              className="grid grid-cols-6 gap-2 sm:gap-2.5 my-2"
            >
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  id={`otp-box-${idx}`}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  disabled={isLocked || isVerifying}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  aria-label={`Digit ${idx + 1} of 6`}
                  className={`w-full h-13 sm:h-14 text-center text-xl sm:text-2xl font-bold font-mono text-slate-900 rounded-xl outline-none transition-all border shadow-xs ${
                    digit
                      ? 'border-blue-600 bg-blue-50/20 ring-2 ring-blue-600/10'
                      : 'border-slate-300 bg-white hover:border-slate-400'
                  } focus:border-blue-600 focus:bg-white focus:ring-3 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60`}
                />
              ))}
            </div>

            {/* Expiry and Challenge Info */}
            <div className="flex items-center justify-between text-xs text-slate-500 mt-3 px-0.5">
              <div className="inline-flex items-center gap-1.5 text-slate-500">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>Valid for 10 minutes</span>
              </div>

              <div className="inline-flex items-center gap-1.5 text-emerald-600 font-medium">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Protected challenge</span>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={!isComplete || isVerifying || isLocked}
            className="w-full h-11 text-sm font-semibold tracking-wide bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg shadow-sm transition-all"
          >
            {isVerifying ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                <span>Verifying code...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                <span>Verify & Sign In</span>
              </>
            )}
          </Button>

          {/* Resend OTP Section */}
          <div className="pt-2 text-center text-xs text-slate-500">
            <span>Didn't receive the code? </span>
            {cooldown > 0 ? (
              <span className="font-semibold text-slate-400">
                Resend in {cooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleTriggerResend}
                disabled={isResending || isLocked}
                className="font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed border-none bg-transparent p-0"
              >
                {isResending ? 'Sending new code...' : 'Resend Code'}
              </button>
            )}
          </div>
        </form>
      </CardContent>
    </div>
  );
}
