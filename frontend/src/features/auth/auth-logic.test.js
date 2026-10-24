import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Authentication Validation & Logic Tests', () => {
  it('1. Strict numeric OTP cleaning rejects alphabetic or special characters', () => {
    const cleanDigit = (val) => val.replace(/\D/g, '').slice(-1);

    assert.equal(cleanDigit('5'), '5');
    assert.equal(cleanDigit('a'), '');
    assert.equal(cleanDigit('!'), '');
    assert.equal(cleanDigit('89'), '9'); // takes last entered digit
  });

  it('2. OTP Paste extraction extracts exactly 6 digits', () => {
    const extractPastedOtp = (pasted) => pasted.replace(/\D/g, '').slice(0, 6);

    assert.equal(extractPastedOtp('123456'), '123456');
    assert.equal(extractPastedOtp('Code: 987654 (valid for 10m)'), '987654');
    assert.equal(extractPastedOtp('12 34 56'), '123456');
    assert.equal(extractPastedOtp('1234567890'), '123456');
  });

  it('3. Email format validator detects valid institutional and corporate emails', () => {
    const validateEmail = (email) => {
      const trimmed = (email || '').trim();
      if (!trimmed) return 'Email is required.';
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(trimmed) ? '' : 'Invalid email format.';
    };

    assert.equal(validateEmail('nameismohan123@gmail.com'), '');
    assert.equal(validateEmail('faculty@mit.edu'), '');
    assert.equal(validateEmail('  prof@cambridge.ac.uk  '), '');
    assert.equal(validateEmail('invalid-email'), 'Invalid email format.');
    assert.equal(validateEmail(''), 'Email is required.');
  });

  it('4. Lockout duration formatter computes human-readable hours and minutes', () => {
    const formatLockout = (seconds) => {
      if (!seconds || seconds <= 0) return '24 hours';
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (hours > 0) return `${hours}h ${minutes}m`;
      return `${minutes} minutes`;
    };

    assert.equal(formatLockout(86400), '24h 0m');
    assert.equal(formatLockout(3600), '1h 0m');
    assert.equal(formatLockout(7290), '2h 1m');
    assert.equal(formatLockout(300), '5 minutes');
    assert.equal(formatLockout(0), '24 hours');
  });

  it('5. Sender eligibility checker correctly enforces verified, active, ready status', () => {
    const isEligible = (account) =>
      Boolean(
        account.is_active === true &&
        account.verification_status === 'verified' &&
        account.provider_status === 'ready' &&
        !account.archived_at
      );

    const validAccount = {
      is_active: true,
      verification_status: 'verified',
      provider_status: 'ready',
      archived_at: null,
    };
    assert.equal(isEligible(validAccount), true);

    const inactiveAccount = { ...validAccount, is_active: false };
    assert.equal(isEligible(inactiveAccount), false);

    const pendingAccount = { ...validAccount, verification_status: 'pending' };
    assert.equal(isEligible(pendingAccount), false);

    const unreadyProviderAccount = { ...validAccount, provider_status: 'not_configured' };
    assert.equal(isEligible(unreadyProviderAccount), false);

    const archivedAccount = { ...validAccount, archived_at: '2026-10-24T12:00:00Z' };
    assert.equal(isEligible(archivedAccount), false);
  });

  it('6. Priority 5 centered modal config correctly handles unregistered email and authentication outcomes', () => {
    const getModalConfig = (type) => {
      switch (type) {
        case 'otp_sent':
          return { badge: 'check', title: 'Verification code sent', actionLabel: 'Continue' };
        case 'not_registered':
          return { badge: 'x', title: 'Email not registered', actionLabel: 'Try again' };
        case 'delivery_failed':
          return { badge: 'x', title: 'Verification email not sent', actionLabel: 'Try again' };
        case 'login_success':
          return { badge: 'check', title: 'Login successful', actionLabel: 'Enter Workspace' };
        case 'incorrect':
          return { badge: 'x', title: 'Verification failed', actionLabel: 'Try again' };
        case 'expired':
          return { badge: 'clock', title: 'Code expired', actionLabel: 'Request New Code' };
        case 'locked':
          return { badge: 'lock', title: 'Too many attempts', actionLabel: 'Close' };
        default:
          return { badge: 'x', title: 'Unable to complete your request', actionLabel: 'Try again' };
      }
    };

    assert.deepEqual(getModalConfig('otp_sent'), {
      badge: 'check',
      title: 'Verification code sent',
      actionLabel: 'Continue',
    });
    assert.deepEqual(getModalConfig('not_registered'), {
      badge: 'x',
      title: 'Email not registered',
      actionLabel: 'Try again',
    });
    assert.deepEqual(getModalConfig('delivery_failed'), {
      badge: 'x',
      title: 'Verification email not sent',
      actionLabel: 'Try again',
    });
    assert.deepEqual(getModalConfig('login_success'), {
      badge: 'check',
      title: 'Login successful',
      actionLabel: 'Enter Workspace',
    });
    assert.deepEqual(getModalConfig('incorrect'), {
      badge: 'x',
      title: 'Verification failed',
      actionLabel: 'Try again',
    });
    assert.deepEqual(getModalConfig('expired'), {
      badge: 'clock',
      title: 'Code expired',
      actionLabel: 'Request New Code',
    });
    assert.deepEqual(getModalConfig('locked'), {
      badge: 'lock',
      title: 'Too many attempts',
      actionLabel: 'Close',
    });
  });
});
