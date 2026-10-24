import React, { useState } from 'react';
import { Mail, ArrowRight, RefreshCw } from 'lucide-react';
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
    const trimmed = val.trim();
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
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Heading & Subtitle */}
      <div style={{ marginBottom: '24px' }}>
        <h2
          style={{
            fontSize: '26px',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: '#10182B',
            margin: '0 0 8px 0',
            lineHeight: 1.25,
          }}
        >
          Welcome back
        </h2>
        <p
          style={{
            fontSize: '13.5px',
            color: '#667085',
            margin: 0,
            lineHeight: 1.55,
          }}
        >
          Sign in to your Sitech Series workspace with a secure six-digit verification code sent to your email.
        </p>
      </div>

      {/* Optional fallback inline status card if present */}
      {statusState && (
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
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} noValidate>
        <div style={{ marginBottom: '22px' }}>
          <label
            htmlFor="auth-email-input"
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 700,
              color: '#172033',
              marginBottom: '8px',
            }}
          >
            Email Address <span style={{ color: '#ef4444' }}>*</span>
          </label>

          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#64748b',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Mail size={17} />
            </div>

            <input
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
              style={{
                width: '100%',
                height: '46px',
                padding: '0 14px 0 42px',
                fontSize: '14px',
                color: '#10182B',
                backgroundColor: '#ffffff',
                border: validationError ? '1.5px solid #ef4444' : '1.5px solid #cbd5e1',
                borderRadius: '10px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 160ms ease, box-shadow 160ms ease',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = validationError ? '#ef4444' : '#4361EE';
                e.target.style.boxShadow = validationError
                  ? '0 0 0 3px rgba(239, 68, 68, 0.15)'
                  : '0 0 0 3px rgba(67, 97, 238, 0.18)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = validationError ? '#ef4444' : '#cbd5e1';
                e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
              }}
            />
          </div>

          {validationError && (
            <p
              role="alert"
              style={{
                fontSize: '12px',
                color: '#ef4444',
                fontWeight: 600,
                margin: '6px 0 0 0',
              }}
            >
              {validationError}
            </p>
          )}
        </div>

        {/* Primary Action Button */}
        <button
          type="submit"
          disabled={isLoading}
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
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.75 : 1,
            borderRadius: '10px',
            border: 'none',
            color: '#ffffff',
            backgroundColor: '#4361EE',
            boxShadow: '0 4px 14px rgba(67, 97, 238, 0.3)',
            transition: 'background-color 160ms ease, transform 120ms ease, box-shadow 160ms ease',
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = '#3651D4';
              e.currentTarget.style.boxShadow = '0 6px 18px rgba(67, 97, 238, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              e.currentTarget.style.backgroundColor = '#4361EE';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(67, 97, 238, 0.3)';
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
              <span>Sending verification code...</span>
            </>
          ) : (
            <>
              <span>Send Verification Code</span>
              <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
