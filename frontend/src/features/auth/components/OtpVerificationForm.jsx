import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, Clock, ShieldCheck, RefreshCw } from 'lucide-react';
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

  // Focus the first input on initial mount
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
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
      <button
        type="button"
        onClick={onChangeEmail}
        className="btn-back-link"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          color: '#667085',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
          marginBottom: '20px',
          alignSelf: 'flex-start',
          transition: 'color 140ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#4361EE';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#667085';
        }}
      >
        <ArrowLeft size={15} />
        <span>Use a different email</span>
      </button>

      <div style={{ marginBottom: '24px' }}>
        <h2
          style={{
            fontSize: '26px',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: '#10182B',
            margin: '0 0 6px 0',
            lineHeight: 1.25,
          }}
        >
          Verify your email
        </h2>
        <p
          style={{
            fontSize: '13.5px',
            color: '#667085',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Enter the six-digit verification code sent to{' '}
          <strong style={{ color: '#10182B', wordBreak: 'break-all' }}>
            {email}
          </strong>
        </p>
      </div>

      {statusState && (
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
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: '8px' }}>
        <label
          htmlFor="otp-box-0"
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 700,
            color: '#172033',
            marginBottom: '10px',
          }}
        >
          Enter 6-digit code <span style={{ color: '#ef4444' }}>*</span>
        </label>

        {/* 6 Digit Numeric Boxes */}
        <div
          onPaste={handlePaste}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '8px',
            marginBottom: '18px',
          }}
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
              style={{
                width: '100%',
                height: '52px',
                textAlign: 'center',
                fontSize: '22px',
                fontWeight: 700,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                color: '#10182B',
                backgroundColor: digit ? '#F8FAFC' : '#FFFFFF',
                border: digit ? '2px solid #4361EE' : '1.5px solid #CBD5E1',
                borderRadius: '10px',
                outline: 'none',
                transition: 'all 150ms ease',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#4361EE';
                e.target.style.boxShadow = '0 0 0 3px rgba(67, 97, 238, 0.18)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = digit ? '#4361EE' : '#CBD5E1';
                e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
              }}
            />
          ))}
        </div>

        {/* Expiry and Security Info */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#667085',
            marginBottom: '22px',
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Clock size={13} color="#94A3B8" />
            <span>Valid for 10 minutes</span>
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <ShieldCheck size={13} color="#10B981" />
            <span>Protected challenge</span>
          </div>
        </div>

        {/* Primary Verify Button */}
        <button
          type="submit"
          disabled={!isComplete || isVerifying || isLocked}
          style={{
            width: '100%',
            height: '46px',
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '0.01em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: !isComplete || isVerifying || isLocked ? 'not-allowed' : 'pointer',
            opacity: !isComplete || isVerifying || isLocked ? 0.65 : 1,
            borderRadius: '10px',
            border: 'none',
            color: '#ffffff',
            backgroundColor: '#4361EE',
            boxShadow: '0 4px 14px rgba(67, 97, 238, 0.3)',
            transition: 'background-color 160ms ease, transform 120ms ease, box-shadow 160ms ease',
          }}
          onMouseEnter={(e) => {
            if (isComplete && !isVerifying && !isLocked) {
              e.currentTarget.style.backgroundColor = '#3651D4';
              e.currentTarget.style.boxShadow = '0 6px 18px rgba(67, 97, 238, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            if (isComplete && !isVerifying && !isLocked) {
              e.currentTarget.style.backgroundColor = '#4361EE';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(67, 97, 238, 0.3)';
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
          onMouseDown={(e) => {
            if (isComplete && !isVerifying && !isLocked) {
              e.currentTarget.style.transform = 'scale(0.99)';
            }
          }}
          onMouseUp={(e) => {
            if (isComplete && !isVerifying && !isLocked) {
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
        >
          {isVerifying ? (
            <>
              <RefreshCw size={17} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Verifying code...</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={17} />
              <span>Verify & Sign In</span>
            </>
          )}
        </button>

        {/* Resend OTP Section */}
        <div
          style={{
            marginTop: '22px',
            textAlign: 'center',
            fontSize: '13px',
            color: '#667085',
          }}
        >
          <span>Didn't receive the code? </span>
          {cooldown > 0 ? (
            <span style={{ fontWeight: 600, color: '#94A3B8' }}>
              Resend in {cooldown}s
            </span>
          ) : (
            <button
              type="button"
              onClick={handleTriggerResend}
              disabled={isResending || isLocked}
              style={{
                background: 'none',
                border: 'none',
                color: isLocked ? '#94A3B8' : '#4361EE',
                fontWeight: 700,
                cursor: isLocked ? 'not-allowed' : 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              {isResending ? 'Sending...' : 'Resend Code'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
