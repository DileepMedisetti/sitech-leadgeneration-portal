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
import { Card } from '../../../components/ui/card';
import '../auth.css';

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
    <div className="auth-page-container h-[100dvh] max-h-[100dvh] w-full overflow-hidden box-border">
      {/* =========================================================================
          LEFT PANEL: Product Content & Brand Messaging (Midnight Navy + Deep Blue)
          ========================================================================= */}
      <div className="auth-left-brand-panel relative flex-[1.05] bg-slate-950 text-white p-8 md:p-12 lg:p-14 flex flex-col justify-between overflow-hidden box-border h-full select-none">
        {/* Ambient radial gradients */}
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-70"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 22%, rgba(59, 130, 246, 0.25) 0%, transparent 45%), radial-gradient(circle at 85% 80%, rgba(30, 58, 138, 0.5) 0%, transparent 50%)',
          }}
        />

        {/* Subtle grid pattern overlay */}
        <div className="auth-grid-pattern pointer-events-none absolute inset-0 z-0" />

        {/* 1. Brand Logo Header */}
        <div className="relative z-10 pb-6 border-b border-white/10">
          <div className="flex flex-col items-start gap-2.5">
            <img
              src="/logo.png"
              alt="Sitech Series"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
              className="h-8 w-auto object-contain block"
            />
            <div className="text-[10.5px] font-bold text-blue-400 tracking-widest uppercase">
              Lead Intelligence Portal
            </div>
          </div>
        </div>

        {/* 2. Main Product Marketing Block */}
        <div className="relative z-10 my-auto py-6 max-w-[480px] w-full">
          {/* Subtle Tag / Pill */}
          <div className="inline-flex items-center gap-2 bg-blue-500/15 border border-blue-400/30 px-3.5 py-1.5 rounded-full text-xs font-semibold text-blue-300 tracking-wide mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Academic Lead Intelligence</span>
          </div>

          {/* Headline */}
          <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-tight mb-4">
            Turn the Right Audience Into Meaningful Connections.
          </h1>

          {/* Supporting paragraph */}
          <p className="text-sm lg:text-[14.5px] text-slate-400 leading-relaxed mb-8">
            Discover qualified contacts, organize audiences, and manage personalized email campaigns from one unified workspace.
          </p>

          {/* 3 Feature cards */}
          <div className="flex flex-col gap-3.5 w-full">
            {productHighlights.map((hl) => {
              const Icon = hl.icon;
              return (
                <div
                  key={hl.title}
                  className="flex items-start gap-4 bg-slate-900/80 border border-white/10 p-4 rounded-xl shadow-md transition-all hover:border-white/20"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                    <Icon className="h-4.5 w-4.5 text-blue-400" strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white mb-0.5">
                      {hl.title}
                    </h3>
                    <p className="text-xs text-slate-400 leading-normal m-0">
                      {hl.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Footer info */}
        <div className="relative z-10 pt-5 border-t border-white/10 text-xs text-slate-500 flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-slate-400" />
          <span>Enterprise 256-bit SSL encrypted authentication session</span>
        </div>
      </div>

      {/* =========================================================================
          RIGHT PANEL: Centered Form Container Card (Cool Off-White #F8FAFC)
          ========================================================================= */}
      <div className="auth-right-form-panel flex-1 flex flex-col justify-center items-center p-4 sm:p-6 md:p-8 lg:p-10 bg-slate-50/70 min-w-0 min-h-0 h-full overflow-hidden box-border">
        {/* Mobile-only brand header */}
        <div className="auth-mobile-brand w-full max-w-[440px] text-center mb-6 hidden">
          <img
            src="/logo.png"
            alt="Sitech Series"
            className="h-8 w-auto mx-auto mb-2 block"
          />
          <div className="text-[10.5px] font-bold text-blue-600 tracking-wider uppercase">
            Lead Intelligence Portal
          </div>
        </div>

        {/* Authentication Card and Copyright Footer */}
        <div className="w-full max-w-[450px] flex flex-col items-center">
          <Card className="w-full bg-white border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-900/5 p-7 sm:p-9 transition-all">
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
          </Card>

          <footer className="w-full pt-4 text-center text-xs text-slate-500">
            © {new Date().getFullYear()} Sitech Series. All rights reserved.
          </footer>
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
