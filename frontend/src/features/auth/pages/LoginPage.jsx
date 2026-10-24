import React, { useState } from 'react';
import {
  Users,
  Send,
  ShieldCheck,
  Sparkles,
  Lock,
} from 'lucide-react';
import { authApi } from '../../../services/api-client';
import { useAuth } from '../../../context/AuthContext';
import EmailEntryForm from '../components/EmailEntryForm';
import OtpVerificationForm from '../components/OtpVerificationForm';
import AuthFeedbackModal from '../components/AuthFeedbackModal';

export default function LoginPage({ onNavigate }) {
  const { login } = useAuth();

  // Screen step: 'email' | 'otp'
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [initialCooldown, setInitialCooldown] = useState(60);

  // Centered Feedback Modal State (Priority 5)
  const [modalState, setModalState] = useState({
    isOpen: false,
    type: 'otp_sent', // 'otp_sent' | 'not_registered' | 'delivery_failed' | 'login_success' | 'incorrect' | 'expired' | 'locked' | 'inactive' | 'server_error'
    title: '',
    message: '',
    destinationEmail: '',
    remainingAttempts: null,
    lockoutRemainingSeconds: null,
    actionLabel: '',
    onAction: null,
  });

  const closeModal = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  // 1. Submit email and request 6-digit OTP
  const handleRequestOtp = async (targetEmail) => {
    setIsLoading(true);
    try {
      const response = await authApi.requestOtp(targetEmail);
      setEmail(targetEmail);
      setInitialCooldown(response.cooldown_seconds || 60);

      // Priority 5: Show Centered Modal for successful OTP request
      setModalState({
        isOpen: true,
        type: 'otp_sent',
        title: 'Verification code sent',
        message: "We've sent a six-digit verification code to your registered email address.",
        destinationEmail: targetEmail,
        actionLabel: 'Continue',
        onAction: () => {
          closeModal();
          setStep('otp');
        },
      });
    } catch (err) {
      console.error('Request OTP failed:', err);
      const detail = err.response?.data?.detail;
      const status = err.response?.status;

      // Priority 1: Unregistered email rejected before sending OTP
      if (status === 404 || detail?.status === 'not_registered') {
        setModalState({
          isOpen: true,
          type: 'not_registered',
          title: 'Email not registered',
          message:
            detail?.message ||
            'This email address is not registered with Sitech Series. Please check your email or contact your administrator.',
          actionLabel: 'Try again',
          onAction: closeModal,
        });
      } else if (status === 403 || detail?.status === 'inactive') {
        setModalState({
          isOpen: true,
          type: 'inactive',
          title: 'Account inactive',
          message:
            detail?.message ||
            'This account is inactive. Please contact your workspace administrator.',
          actionLabel: 'Understood',
          onAction: closeModal,
        });
      } else if (status === 423 || detail?.status === 'locked') {
        setModalState({
          isOpen: true,
          type: 'locked',
          title: 'Too many attempts',
          message:
            detail?.message ||
            'Maximum verification attempts exceeded. Account is locked for 24 hours.',
          lockoutRemainingSeconds: detail?.remaining_lockout_seconds,
          actionLabel: 'Close',
          onAction: closeModal,
        });
      } else if (status === 429 || detail?.status === 'rate_limited') {
        setModalState({
          isOpen: true,
          type: 'server_error',
          title: 'Please wait',
          message: detail?.message || 'Please wait before requesting another verification code.',
          actionLabel: 'Try again',
          onAction: closeModal,
        });
      } else if (status === 502 || detail?.status === 'delivery_failed') {
        setModalState({
          isOpen: true,
          type: 'delivery_failed',
          title: 'Verification email not sent',
          message:
            detail?.message ||
            "We couldn't send your verification code. Please try again later.",
          actionLabel: 'Try again',
          onAction: () => {
            closeModal();
            handleRequestOtp(targetEmail);
          },
        });
      } else {
        setModalState({
          isOpen: true,
          type: 'server_error',
          title: 'Unable to complete your request',
          message:
            err.message ||
            "We couldn't connect to the server. Please check your connection and try again.",
          actionLabel: 'Try again',
          onAction: closeModal,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Submit 6-digit OTP and verify
  const handleVerifyOtp = async (otpCode) => {
    setIsVerifying(true);
    try {
      const response = await authApi.verifyOtp(email, otpCode);
      if (response.status === 'success' && response.access_token) {
        // Priority 5: Successful Login centered popup modal
        setModalState({
          isOpen: true,
          type: 'login_success',
          title: 'Login successful',
          message: 'Your email has been verified. Welcome to your Sitech Series workspace.',
          actionLabel: 'Enter Workspace',
          onAction: () => {
            closeModal();
            login(response.access_token, response.user);
            if (onNavigate) {
              onNavigate('dashboard');
            }
          },
        });

        // Also smoothly transition after 1.2 seconds if user doesn't click
        setTimeout(() => {
          login(response.access_token, response.user);
          if (onNavigate) {
            onNavigate('dashboard');
          }
        }, 1200);
      }
    } catch (err) {
      console.error('Verify OTP failed:', err);
      const detail = err.response?.data?.detail;
      const status = err.response?.status;

      if (status === 423 || detail?.status === 'locked') {
        setModalState({
          isOpen: true,
          type: 'locked',
          title: 'Too many attempts',
          message:
            detail?.message ||
            'Maximum verification attempts exceeded. Account is locked for 24 hours.',
          lockoutRemainingSeconds: detail?.remaining_lockout_seconds,
          actionLabel: 'Close',
          onAction: closeModal,
        });
      } else if (detail?.status === 'expired') {
        setModalState({
          isOpen: true,
          type: 'expired',
          title: 'Code expired',
          message:
            detail?.message ||
            'The verification code has expired. Please request a new code.',
          actionLabel: 'Request New Code',
          onAction: () => {
            closeModal();
            handleResendOtp();
          },
        });
      } else if (detail?.status === 'incorrect' || status === 400) {
        setModalState({
          isOpen: true,
          type: 'incorrect',
          title: 'Verification failed',
          message:
            detail?.message ||
            'Incorrect verification code. Please check it and try again.',
          remainingAttempts: detail?.remaining_attempts,
          actionLabel: 'Try again',
          onAction: closeModal,
        });
      } else {
        setModalState({
          isOpen: true,
          type: 'server_error',
          title: 'Unable to complete your request',
          message:
            err.message ||
            "We couldn't connect to the server. Please check your connection and try again.",
          actionLabel: 'Try again',
          onAction: closeModal,
        });
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // 3. Resend OTP handler
  const handleResendOtp = async () => {
    setIsResending(true);
    try {
      const response = await authApi.requestOtp(email);
      setInitialCooldown(response.cooldown_seconds || 60);
      setModalState({
        isOpen: true,
        type: 'otp_sent',
        title: 'Verification code sent',
        message: "We've sent a new six-digit verification code to your registered email address.",
        destinationEmail: email,
        actionLabel: 'Continue',
        onAction: closeModal,
      });
    } catch (err) {
      const detail = err.response?.data?.detail;
      const status = err.response?.status;

      if (status === 423 || detail?.status === 'locked') {
        setModalState({
          isOpen: true,
          type: 'locked',
          title: 'Too many attempts',
          message:
            detail?.message ||
            'Maximum verification attempts exceeded. Account is locked for 24 hours.',
          lockoutRemainingSeconds: detail?.remaining_lockout_seconds,
          actionLabel: 'Close',
          onAction: closeModal,
        });
      } else if (status === 502 || detail?.status === 'delivery_failed') {
        setModalState({
          isOpen: true,
          type: 'delivery_failed',
          title: 'Verification email not sent',
          message:
            detail?.message ||
            "We couldn't send your verification code. Please try again later.",
          actionLabel: 'Try again',
          onAction: () => {
            closeModal();
            handleResendOtp();
          },
        });
      } else {
        setModalState({
          isOpen: true,
          type: 'server_error',
          title: 'Unable to complete your request',
          message:
            err.message ||
            "We couldn't connect to the server. Please check your connection and try again.",
          actionLabel: 'Try again',
          onAction: closeModal,
        });
      }
    } finally {
      setIsResending(false);
    }
  };

  const productHighlights = [
    {
      icon: Users,
      title: 'Audience Intelligence',
      desc: 'Organize and manage qualified contacts and audience lists.',
    },
    {
      icon: Send,
      title: 'Campaign Management',
      desc: 'Create, schedule, and manage targeted email campaigns.',
    },
    {
      icon: ShieldCheck,
      title: 'Secure Workspace',
      desc: 'Manage your account and sender identities in a secure workspace.',
    },
  ];

  return (
    <div
      className="login-page-container"
      style={{
        height: '100dvh',
        maxHeight: '100dvh',
        width: '100vw',
        display: 'flex',
        backgroundColor: '#F6F8FC',
        fontFamily: 'inherit',
        overflow: 'hidden',
      }}
    >
      {/* =========================================================================
          LEFT PANEL: Product Content & Brand Messaging (Midnight Navy + Deep Blue)
          ========================================================================= */}
      <div
        className="auth-brand-panel"
        style={{
          flex: '1.05',
          backgroundColor: '#10182B',
          backgroundImage:
            'radial-gradient(circle at 14% 18%, rgba(67, 97, 238, 0.22) 0%, transparent 45%), radial-gradient(circle at 86% 84%, rgba(23, 37, 84, 0.8) 0%, transparent 50%)',
          color: '#ffffff',
          padding: 'clamp(26px, 4vh, 44px) clamp(30px, 4vw, 54px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
          boxSizing: 'border-box',
          height: '100%',
        }}
      >
        {/* Subtle grid pattern overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
              'linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
            pointerEvents: 'none',
          }}
        />

        {/* 1. Brand Logo Header - Positioned cleanly without duplicate text */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            paddingBottom: 'clamp(12px, 1.8vh, 18px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: '6px',
            }}
          >
            <img
              src="/logo.png"
              alt="Sitech Series"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
              style={{
                height: '34px',
                width: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
            <div
              style={{
                fontSize: '11px',
                color: '#60A5FA',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                lineHeight: 1.2,
              }}
            >
              LEAD INTELLIGENCE PORTAL
            </div>
          </div>
        </div>

        {/* 2. Main Product Marketing Block - Centered with generous breathing room */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            margin: 'auto 0',
            padding: 'clamp(8px, 1.5vh, 18px) 0',
            maxWidth: '490px',
            width: '100%',
          }}
        >
          {/* Subtle Tag / Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(67, 97, 238, 0.16)',
              border: '1px solid rgba(67, 97, 238, 0.35)',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 700,
              color: '#93C5FD',
              letterSpacing: '0.04em',
              marginBottom: 'clamp(10px, 1.6vh, 16px)',
            }}
          >
            <Sparkles size={12} />
            <span>Academic Lead Intelligence</span>
          </div>

          {/* Headline */}
          <h1
            style={{
              fontSize: 'clamp(23px, 2.25vw, 30px)',
              fontWeight: 800,
              lineHeight: 1.25,
              letterSpacing: '-0.025em',
              color: '#FFFFFF',
              margin: '0 0 clamp(8px, 1.4vh, 14px) 0',
            }}
          >
            Turn the Right Audience Into Meaningful Connections.
          </h1>

          {/* Supporting paragraph */}
          <p
            style={{
              fontSize: 'clamp(13px, 1.05vw, 14.5px)',
              color: '#94A3B8',
              lineHeight: 1.55,
              margin: '0 0 clamp(16px, 2.4vh, 26px) 0',
            }}
          >
            Discover qualified contacts, organize audiences, and manage personalized email campaigns from one unified workspace.
          </p>

          {/* 3 Feature cards with Deep Blue (#172554) styling */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(8px, 1.3vh, 12px)',
              width: '100%',
            }}
          >
            {productHighlights.map((hl) => {
              const Icon = hl.icon;
              return (
                <div
                  key={hl.title}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                    backgroundColor: '#172554',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: 'clamp(9px, 1.3vh, 13px) 15px',
                    borderRadius: '10px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  }}
                >
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(67, 97, 238, 0.22)',
                      border: '1px solid rgba(67, 97, 238, 0.38)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={17} color="#818CF8" strokeWidth={2.2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3
                      style={{
                        margin: '0 0 2px 0',
                        fontSize: '13.5px',
                        fontWeight: 700,
                        color: '#F8FAFC',
                      }}
                    >
                      {hl.title}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '12px',
                        color: '#94A3B8',
                        lineHeight: 1.4,
                      }}
                    >
                      {hl.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Footer info */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            paddingTop: 'clamp(10px, 1.5vh, 16px)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: '11.5px',
            color: '#64748B',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Lock size={12} color="#64748B" />
          <span>Enterprise 256-bit SSL encrypted authentication session</span>
        </div>
      </div>

      {/* =========================================================================
          RIGHT PANEL: Centered Form Container Card (Cool Off-White #F6F8FC Background)
          ========================================================================= */}
      <div
        className="auth-form-panel"
        style={{
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 'clamp(20px, 3vh, 40px) clamp(16px, 3vw, 40px)',
          backgroundColor: '#F6F8FC',
          boxSizing: 'border-box',
          minWidth: 0,
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Centered White Card (Priority 4) */}
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            boxShadow:
              '0 8px 30px -4px rgba(16, 24, 43, 0.06), 0 2px 8px -2px rgba(16, 24, 43, 0.04)',
            padding: 'clamp(26px, 3.8vh, 38px) clamp(22px, 3vw, 36px)',
            boxSizing: 'border-box',
          }}
        >
          {/* Mobile-only brand header */}
          <div
            className="auth-mobile-brand"
            style={{
              display: 'none',
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            <img
              src="/logo.png"
              alt="Sitech Series"
              style={{
                height: '30px',
                width: 'auto',
                margin: '0 auto 6px auto',
                display: 'block',
              }}
            />
            <div
              style={{
                fontSize: '10px',
                color: '#4361EE',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              LEAD INTELLIGENCE PORTAL
            </div>
          </div>

          {step === 'email' && (
            <EmailEntryForm
              initialEmail={email}
              onSubmitEmail={handleRequestOtp}
              isLoading={isLoading}
            />
          )}

          {step === 'otp' && (
            <OtpVerificationForm
              email={email}
              onVerify={handleVerifyOtp}
              onResend={handleResendOtp}
              onChangeEmail={() => {
                setStep('email');
              }}
              isVerifying={isVerifying}
              isResending={isResending}
              initialCooldown={initialCooldown}
            />
          )}
        </div>
      </div>

      {/* =========================================================================
          CENTERED FEEDBACK POPUP MODAL (Priority 5)
          ========================================================================= */}
      <AuthFeedbackModal
        isOpen={modalState.isOpen}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        destinationEmail={modalState.destinationEmail}
        remainingAttempts={modalState.remainingAttempts}
        lockoutRemainingSeconds={modalState.lockoutRemainingSeconds}
        actionLabel={modalState.actionLabel}
        onAction={modalState.onAction}
        onClose={closeModal}
      />
    </div>
  );
}
