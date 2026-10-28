import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mail,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Trash2,
  Power,
  Search,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Star,
  Check,
  AlertTriangle,
  X,
  Pencil,
} from 'lucide-react';
import { emailAccountsApi } from '../../services/api-client';
import { useAuth } from '../../context/AuthContext';
import AuthFeedbackModal from '../auth/components/AuthFeedbackModal';

export default function EmailAccountsPage({ onNavigate }) {
  const { user, refreshUser } = useAuth();
  const [viewMode, setViewMode] = useState('active'); // 'active' | 'deleted'
  const [accounts, setAccounts] = useState([]);
  const [deletedAccounts, setDeletedAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Connect Email Account Wizard Modal State
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectStep, setConnectStep] = useState('input'); // 'input' | 'otp'
  const [connectEmail, setConnectEmail] = useState('');
  const [connectName, setConnectName] = useState('');
  const [connectReceiverName, setConnectReceiverName] = useState('');
  const [connectReceiverEmail, setConnectReceiverEmail] = useState('');
  const [connectReplyTo, setConnectReplyTo] = useState('');
  const [connectOtpDigits, setConnectOtpDigits] = useState(['', '', '', '', '', '']);

  // Edit Sender Modal State (Requirement 2 & 3)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [editFromName, setEditFromName] = useState('');
  const [editReplyTo, setEditReplyTo] = useState('');
  const [editReceiverName, setEditReceiverName] = useState('');
  const [editReceiverEmail, setEditReceiverEmail] = useState('');
  const [editErrors, setEditErrors] = useState({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [connectCooldown, setConnectCooldown] = useState(60);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const otpInputRefs = useRef([]);

  // Centered Feedback & Confirmation Popup Modal State
  const [popupModal, setPopupModal] = useState({
    isOpen: false,
    type: 'email_in_use', // 'email_in_use' | 'account_restored' | 'confirm_delete' | 'server_error' | 'success'
    title: '',
    message: '',
    actionLabel: '',
    onAction: null,
    secondaryActionLabel: null,
    onSecondaryAction: null,
  });

  const closePopupModal = () => {
    setPopupModal((prev) => ({ ...prev, isOpen: false }));
  };

  // Cooldown timer for Connect OTP
  useEffect(() => {
    if (connectCooldown <= 0) return;
    const timer = setInterval(() => {
      setConnectCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [connectCooldown]);

  // Load Active & Deleted accounts
  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const [activeData, deletedData] = await Promise.all([
        emailAccountsApi.list(),
        emailAccountsApi.listDeleted().catch(() => []),
      ]);
      setAccounts(activeData);
      setDeletedAccounts(deletedData);
    } catch (err) {
      console.error('Failed to load email accounts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // 1. Open Connect Email Modal
  const handleOpenConnectModal = () => {
    setConnectStep('input');
    setConnectEmail('');
    setConnectName(user?.display_name || '');
    setConnectReceiverName('');
    setConnectReceiverEmail('');
    setConnectReplyTo('');
    setConnectOtpDigits(['', '', '', '', '', '']);
    setFormErrors({});
    setIsConnectModalOpen(true);
  };

  const handleOpenEditModal = (acc) => {
    setEditingAccount(acc);
    setEditFromName(acc.from_name || '');
    setEditReplyTo(acc.reply_to || '');
    setEditReceiverName(acc.receiver_name || '');
    setEditReceiverEmail(acc.receiver_email || '');
    setEditErrors({});
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    if (e) e.preventDefault();
    if (!editingAccount) return;

    const errors = {};
    const trimmedName = editFromName.trim();
    const trimmedReplyTo = editReplyTo.trim();
    const trimmedReceiverName = editReceiverName.trim();
    const trimmedReceiverEmail = editReceiverEmail.trim();

    if (!trimmedName) {
      errors.from_name = 'Sender name is required.';
    }
    if (trimmedReplyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedReplyTo)) {
      errors.reply_to = 'Please enter a valid reply-to email address.';
    }
    if (trimmedReceiverEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedReceiverEmail)) {
      errors.receiver_email = 'Please enter a valid receiver email address.';
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setIsSavingEdit(true);
    setEditErrors({});
    try {
      const updated = await emailAccountsApi.update(editingAccount.id, {
        from_name: trimmedName,
        reply_to: trimmedReplyTo || null,
        receiver_name: trimmedReceiverName || null,
        receiver_email: trimmedReceiverEmail || null,
      });

      setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setIsEditModalOpen(false);
      setPopupModal({
        isOpen: true,
        type: 'login_success',
        title: 'Sender details updated',
        message: `Sender details for "${editingAccount.email_address}" have been updated successfully.`,
        actionLabel: 'Done',
        onAction: closePopupModal,
      });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setEditErrors({
        submit:
          typeof detail === 'string'
            ? detail
            : detail?.message || err.message || 'Failed to update sender details.',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // 2. Request OTP Code for new email
  const handleRequestConnectCode = async (e) => {
    if (e) e.preventDefault();
    const errors = {};
    const trimmedEmail = connectEmail.trim();
    const trimmedName = connectName.trim();

    if (!trimmedEmail) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Please enter a valid email address.';
    }
    if (!trimmedName) {
      errors.name = 'Sender display name is required.';
    }
    const trimmedReceiverEmail = connectReceiverEmail.trim();
    if (trimmedReceiverEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedReceiverEmail)) {
      errors.receiver_email = 'Please enter a valid receiver email address.';
    }
    const trimmedReplyTo = connectReplyTo.trim();
    if (trimmedReplyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedReplyTo)) {
      errors.reply_to = 'Please enter a valid reply-to email address.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsRequestingCode(true);
    setFormErrors({});
    try {
      await emailAccountsApi.requestConnectCode({
        email_address: trimmedEmail,
        from_name: trimmedName,
      });

      // Advance to OTP entry step
      setConnectStep('otp');
      setConnectCooldown(60);
      setConnectOtpDigits(['', '', '', '', '', '']);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const status = err.response?.status;

      // Global Email Ownership Check (Scenario A/B/C)
      if (status === 409 || detail?.status === 'email_in_use') {
        setPopupModal({
          isOpen: true,
          type: 'email_in_use',
          title: 'Email already in use',
          message:
            detail?.message ||
            'This email address is already in use by another account. Please use a different email address.',
          actionLabel: 'Try Another Email',
          onAction: closePopupModal,
        });
      } else {
        setFormErrors({
          submit:
            typeof detail === 'string'
              ? detail
              : detail?.message || err.message || 'Failed to send verification code.',
        });
      }
    } finally {
      setIsRequestingCode(false);
    }
  };

  // 3. Verify OTP Code and Connect
  const handleVerifyConnectCode = async (e) => {
    if (e) e.preventDefault();
    const otpCode = connectOtpDigits.join('');
    if (otpCode.length !== 6) {
      setFormErrors({ otp: 'Please enter all 6 digits of your verification code.' });
      return;
    }

    setIsVerifyingCode(true);
    setFormErrors({});
    try {
      await emailAccountsApi.verifyConnectCode({
        email_address: connectEmail.trim(),
        from_name: connectName.trim(),
        receiver_name: connectReceiverName.trim() || null,
        receiver_email: connectReceiverEmail.trim() || null,
        reply_to: connectReplyTo.trim() || null,
        otp_code: otpCode,
      });

      setIsConnectModalOpen(false);
      await fetchAccounts();
      if (refreshUser) refreshUser();

      // Show success modal
      setPopupModal({
        isOpen: true,
        type: 'login_success',
        title: 'Email account connected',
        message: `Email "${connectEmail.trim()}" has been verified and connected to your workspace. You can now use it for login and campaigns.`,
        actionLabel: 'Done',
        onAction: closePopupModal,
      });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setFormErrors({
        otp:
          typeof detail === 'string'
            ? detail
            : detail?.message || err.message || 'Incorrect verification code. Please check and try again.',
      });
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // Handle OTP digit box inputs
  const handleOtpDigitChange = (index, value) => {
    const numericChar = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...connectOtpDigits];
    newDigits[index] = numericChar;
    setConnectOtpDigits(newDigits);

    if (numericChar && index < 5 && otpInputRefs.current[index + 1]) {
      otpInputRefs.current[index + 1].focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!connectOtpDigits[index] && index > 0 && otpInputRefs.current[index - 1]) {
        const newDigits = [...connectOtpDigits];
        newDigits[index - 1] = '';
        setConnectOtpDigits(newDigits);
        otpInputRefs.current[index - 1].focus();
      } else if (connectOtpDigits[index]) {
        const newDigits = [...connectOtpDigits];
        newDigits[index] = '';
        setConnectOtpDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = [...connectOtpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setConnectOtpDigits(newDigits);
    const focusIndex = Math.min(pasted.length, 5);
    otpInputRefs.current[focusIndex]?.focus();
  };

  // 4. Activate / Deactivate Toggle with Safeguard
  const handleToggleActive = async (acc) => {
    try {
      if (acc.is_active) {
        await emailAccountsApi.deactivate(acc.id);
      } else {
        await emailAccountsApi.activate(acc.id);
      }
      await fetchAccounts();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : detail?.message || err.message;
      setPopupModal({
        isOpen: true,
        type: 'server_error',
        title: 'Action not permitted',
        message: msg,
        actionLabel: 'Understood',
        onAction: closePopupModal,
      });
    }
  };

  // 5. Soft Delete / Archive Account
  const handleArchive = async (acc) => {
    try {
      await emailAccountsApi.delete(acc.id);
      await fetchAccounts();
      if (refreshUser) refreshUser();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : detail?.message || err.message;
      setPopupModal({
        isOpen: true,
        type: 'server_error',
        title: 'Cannot archive email',
        message: msg,
        actionLabel: 'Understood',
        onAction: closePopupModal,
      });
    }
  };

  // 6. Restore Archived Account
  const handleRestore = async (acc) => {
    try {
      await emailAccountsApi.restore(acc.id);
      await fetchAccounts();
      if (refreshUser) refreshUser();

      setPopupModal({
        isOpen: true,
        type: 'account_restored',
        title: 'Account restored',
        message: `Email account "${acc.email_address}" has been restored and is available in your Email Accounts page.`,
        actionLabel: 'View Email Accounts',
        onAction: () => {
          closePopupModal();
          setViewMode('active');
        },
      });
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : detail?.message || err.message;
      setPopupModal({
        isOpen: true,
        type: 'server_error',
        title: 'Restoration failed',
        message: msg,
        actionLabel: 'Understood',
        onAction: closePopupModal,
      });
    }
  };

  // 7. Permanently Delete Archived Account Confirmation
  const handleRequestPermanentDelete = (acc) => {
    setPopupModal({
      isOpen: true,
      type: 'confirm_delete',
      title: 'Permanently delete this email account?',
      message: `This action cannot be undone. "${acc.email_address}" will be permanently removed from your connected accounts.`,
      secondaryActionLabel: 'Cancel',
      onSecondaryAction: closePopupModal,
      actionLabel: 'Permanently Delete',
      onAction: async () => {
        closePopupModal();
        try {
          await emailAccountsApi.permanentlyDelete(acc.id);
          await fetchAccounts();
          if (refreshUser) refreshUser();
        } catch (err) {
          const detail = err.response?.data?.detail;
          const msg = typeof detail === 'string' ? detail : detail?.message || err.message;
          setPopupModal({
            isOpen: true,
            type: 'server_error',
            title: 'Deletion failed',
            message: msg,
            actionLabel: 'Close',
            onAction: closePopupModal,
          });
        }
      },
    });
  };

  // Search filter
  const currentList = viewMode === 'active' ? accounts : deletedAccounts;
  const filteredAccounts = currentList.filter(
    (a) =>
      a.email_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.from_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '28px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          {viewMode === 'deleted' && (
            <button
              type="button"
              onClick={() => setViewMode('active')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                color: '#4361EE',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
                marginBottom: '8px',
              }}
            >
              <ArrowLeft size={15} />
              <span>Back to Email Accounts</span>
            </button>
          )}

          <h1
            style={{
              fontSize: '24px',
              fontWeight: 800,
              color: '#10182B',
              margin: '0 0 6px 0',
              letterSpacing: '-0.02em',
            }}
          >
            {viewMode === 'active' ? 'Email Accounts' : 'Deleted Email Accounts'}
          </h1>
          <p
            style={{
              fontSize: '13.5px',
              color: '#667085',
              margin: 0,
              maxWidth: '680px',
              lineHeight: 1.5,
            }}
          >
            {viewMode === 'active'
              ? 'Manage verified email identities associated with your workspace for login and campaign outreach.'
              : 'Archived email accounts can be restored or permanently deleted. Archived accounts cannot be used for login or campaigns.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {viewMode === 'active' ? (
            <>
              <button
                type="button"
                onClick={() => setViewMode('deleted')}
                style={{
                  height: '40px',
                  padding: '0 16px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: '10px',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  border: '1px solid #CBD5E1',
                  cursor: 'pointer',
                  transition: 'background-color 150ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F8FAFC')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
              >
                <Trash2 size={15} color="#64748B" />
                <span>Deleted Accounts</span>
                {deletedAccounts.length > 0 && (
                  <span
                    style={{
                      padding: '1px 7px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '9999px',
                      backgroundColor: '#F1F5F9',
                      color: '#64748B',
                    }}
                  >
                    {deletedAccounts.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handleOpenConnectModal}
                style={{
                  height: '40px',
                  padding: '0 18px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: '10px',
                  backgroundColor: '#4361EE',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(67, 97, 238, 0.3)',
                  transition: 'background-color 150ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#3651D4')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#4361EE')}
              >
                <Plus size={16} />
                <span>Connect Email Account</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setViewMode('active')}
              style={{
                height: '40px',
                padding: '0 16px',
                fontSize: '13.5px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '10px',
                backgroundColor: '#FFFFFF',
                color: '#475569',
                border: '1px solid #CBD5E1',
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={15} />
              <span>Active Accounts ({accounts.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
          <div
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94A3B8',
              pointerEvents: 'none',
              display: 'flex',
            }}
          >
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder={
              viewMode === 'active'
                ? 'Search connected email accounts...'
                : 'Search deleted email accounts...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              height: '40px',
              padding: '0 14px 0 38px',
              fontSize: '13.5px',
              color: '#10182B',
              backgroundColor: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {viewMode === 'active' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#667085' }}>
            <span>
              Total: <strong style={{ color: '#10182B' }}>{accounts.length}</strong>
            </span>
            <span>•</span>
            <span>
              Active: <strong style={{ color: '#10B981' }}>{accounts.filter((a) => a.is_active).length}</strong>
            </span>
            <span>•</span>
            <span>
              Verified: <strong style={{ color: '#4361EE' }}>{accounts.filter((a) => a.verification_status === 'verified').length}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Main Accounts List */}
      {loading ? (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '48px',
            textAlign: 'center',
            color: '#64748B',
          }}
        >
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <div>Loading email identities...</div>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: '#F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Mail size={24} color="#94A3B8" />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#10182B', margin: '0 0 6px 0' }}>
            {viewMode === 'active'
              ? searchTerm
                ? 'No matching email accounts'
                : 'No connected email accounts'
              : searchTerm
              ? 'No matching deleted accounts'
              : 'No deleted accounts found'}
          </h3>
          <p style={{ fontSize: '13.5px', color: '#667085', margin: '0 0 18px 0', maxWidth: '440px', marginInline: 'auto' }}>
            {viewMode === 'active'
              ? 'Connect an email address to use it for login authentication and outreach campaigns.'
              : 'You have no archived email accounts. Archived accounts will appear here and can be restored at any time.'}
          </p>
          {viewMode === 'active' && !searchTerm && (
            <button
              type="button"
              onClick={handleOpenConnectModal}
              style={{
                height: '38px',
                padding: '0 16px',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: '8px',
                backgroundColor: '#4361EE',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Connect Email Account
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredAccounts.map((acc) => {
            const isPrimary = acc.is_primary;
            const isVerified = acc.verification_status === 'verified';
            const isActive = acc.is_active;

            return (
              <div
                key={acc.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: isPrimary ? '1.5px solid #4361EE' : '1px solid #E2E8F0',
                  boxShadow: isPrimary
                    ? '0 4px 16px -2px rgba(67, 97, 238, 0.12)'
                    : '0 2px 6px -1px rgba(16, 24, 43, 0.04)',
                  padding: '18px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap',
                  transition: 'box-shadow 150ms ease',
                }}
              >
                {/* Account Details */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1, minWidth: '280px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      backgroundColor: isPrimary ? '#E8EDFF' : '#F8FAFC',
                      border: isPrimary ? '1px solid rgba(67, 97, 238, 0.25)' : '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isPrimary ? (
                      <Star size={20} color="#4361EE" strokeWidth={2.4} fill="#4361EE" />
                    ) : (
                      <Mail size={20} color="#64748B" />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#10182B', wordBreak: 'break-all' }}>
                        {acc.email_address}
                      </span>

                      {/* Primary Login Indicator (Priority 1) */}
                      {isPrimary && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            backgroundColor: '#E8EDFF',
                            color: '#4361EE',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            letterSpacing: '0.02em',
                          }}
                        >
                          <Star size={10} fill="#4361EE" />
                          <span>Primary Login</span>
                        </span>
                      )}

                      {!isPrimary && (
                        <span
                          style={{
                            backgroundColor: '#F1F5F9',
                            color: '#475569',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                          }}
                        >
                          Connected Sender
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '13px', color: '#667085', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                      <span>
                        Sender name: <strong style={{ color: '#10182B' }}>{acc.from_name}</strong>
                      </span>

                      {acc.receiver_email && (
                        <span>
                          Receiver: <strong style={{ color: '#10182B' }}>{acc.receiver_name ? `${acc.receiver_name} (${acc.receiver_email})` : acc.receiver_email}</strong>
                        </span>
                      )}

                      {acc.reply_to && acc.reply_to !== acc.email_address && (
                        <span>
                          Reply-to: <strong style={{ color: '#10182B' }}>{acc.reply_to}</strong>
                        </span>
                      )}

                      {/* Verification Status */}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {isVerified ? (
                          <>
                            <CheckCircle2 size={13} color="#10B981" />
                            <span style={{ color: '#10B981', fontWeight: 600 }}>Verified for Login & Sending</span>
                          </>
                        ) : (
                          <>
                            <Clock size={13} color="#F59E0B" />
                            <span style={{ color: '#F59E0B', fontWeight: 600 }}>Pending Verification</span>
                          </>
                        )}
                      </span>

                      {/* Provider status */}
                      {isVerified && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <ShieldCheck size={13} color="#4361EE" />
                          <span style={{ color: '#4361EE', fontWeight: 600 }}>SMTP Ready</span>
                        </span>
                      )}

                      {viewMode === 'deleted' && acc.archived_at && (
                        <span style={{ color: '#94A3B8' }}>
                          Deleted on: {new Date(acc.archived_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Account Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '8px',
                    flexShrink: 0,
                    flexWrap: 'wrap',
                    marginLeft: 'auto',
                  }}
                >
                  {viewMode === 'active' ? (
                    <>
                      {/* Edit Sender Action (Requirement 2) */}
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(acc)}
                        title="Edit sender and receiver details"
                        style={{
                          height: '34px',
                          width: '115px',
                          boxSizing: 'border-box',
                          justifyContent: 'center',
                          padding: '0 12px',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#FFFFFF',
                          color: '#334155',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 140ms ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#F8FAFC';
                          e.currentTarget.style.borderColor = '#94A3B8';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#FFFFFF';
                          e.currentTarget.style.borderColor = '#CBD5E1';
                        }}
                      >
                        <Pencil size={13} />
                        <span>Edit</span>
                      </button>

                      {/* Current Status Badge (display only) */}
                      <span
                        title={`Account status: ${isActive ? 'Active' : 'Inactive'}`}
                        style={{
                          height: '34px',
                          minWidth: '88px',
                          padding: '0 10px',
                          boxSizing: 'border-box',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          borderRadius: '8px',
                          border: isActive ? '1px solid #bbf7d0' : '1px solid #fecaca',
                          backgroundColor: isActive ? '#f0fdf4' : '#fef2f2',
                          color: isActive ? '#15803d' : '#b91c1c',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: isActive ? '#16a34a' : '#dc2626',
                            flexShrink: 0,
                          }}
                        />
                        <span>{isActive ? 'Active' : 'Inactive'}</span>
                      </span>

                      {/* Separate Activate / Deactivate Action */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(acc)}
                        title={
                          isActive
                            ? 'Deactivate account (cannot be used for login or campaigns)'
                            : 'Activate account'
                        }
                        style={{
                          height: '34px',
                          minWidth: '104px',
                          padding: '0 12px',
                          boxSizing: 'border-box',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          borderRadius: '8px',
                          border: isActive ? '1px solid #fecaca' : '1px solid #bbf7d0',
                          backgroundColor: isActive ? '#ffffff' : '#f0fdf4',
                          color: isActive ? '#b91c1c' : '#15803d',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap',
                          transition: 'all 140ms ease',
                          flexShrink: 0,
                        }}
                      >
                        <Power size={13} />
                        <span>{isActive ? 'Deactivate' : 'Activate'}</span>
                      </button>

                      {/* Keep the action columns aligned across every account row.
                          The primary login account gets an invisible placeholder
                          because it cannot be archived. */}
                      {isPrimary ? (
                        <span
                          aria-hidden="true"
                          style={{
                            width: '34px',
                            height: '34px',
                            display: 'inline-block',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleArchive(acc)}
                          title="Archive this email account (move to Deleted Accounts)"
                          style={{
                            width: '34px',
                            height: '34px',
                            boxSizing: 'border-box',
                            flexShrink: 0,
                            borderRadius: '8px',
                            border: '1px solid #E2E8F0',
                            backgroundColor: '#FFFFFF',
                            color: '#64748B',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 140ms ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#EF4444';
                            e.currentTarget.style.borderColor = '#FECACA';
                            e.currentTarget.style.backgroundColor = '#FEF2F2';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#64748B';
                            e.currentTarget.style.borderColor = '#E2E8F0';
                            e.currentTarget.style.backgroundColor = '#FFFFFF';
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Restore Action */}
                      <button
                        type="button"
                        onClick={() => handleRestore(acc)}
                        style={{
                          height: '34px',
                          padding: '0 12px',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          borderRadius: '8px',
                          backgroundColor: '#E8EDFF',
                          color: '#4361EE',
                          border: '1px solid rgba(67, 97, 238, 0.25)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <RotateCcw size={13} />
                        <span>Restore</span>
                      </button>

                      {/* Permanently Delete Action */}
                      <button
                        type="button"
                        onClick={() => handleRequestPermanentDelete(acc)}
                        style={{
                          height: '34px',
                          padding: '0 12px',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          borderRadius: '8px',
                          backgroundColor: '#FEF2F2',
                          color: '#DC2626',
                          border: '1px solid #FECACA',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Delete Permanently</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          CONNECT EMAIL ACCOUNT MODAL (With Global Uniqueness Validation)
          ========================================================================= */}
      {isConnectModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!isRequestingCode && !isVerifyingCode) {
              setIsConnectModalOpen(false);
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9990,
            backgroundColor: 'rgba(16, 24, 43, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '600',
              maxWidth: '95vh',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              boxShadow: '0 24px 48px -12px rgba(16, 24, 43, 0.28)',
              padding: '32px',
              boxSizing: 'border-box',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#E8EDFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Mail size={18} color="#4361EE" />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#10182B', margin: 0 }}>
                    {connectStep === 'input' ? 'Connect Email Account' : 'Verify Email Ownership'}
                  </h3>
                  <div style={{ fontSize: '12.5px', color: '#667085' }}>
                    {connectStep === 'input' ? 'Step 1 of 2: Email Details' : 'Step 2 of 2: Enter Verification Code'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsConnectModalOpen(false)}
                disabled={isRequestingCode || isVerifyingCode}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {connectStep === 'input' ? (
              /* Step 1: Email & Display Name Input */
              <form onSubmit={handleRequestConnectCode} noValidate>
                <p style={{ fontSize: '13px', color: '#667085', margin: '0 0 20px 0', lineHeight: 1.5 }}>
                  Add an additional email identity to your workspace. Once ownership is verified, you can use it to sign in and send campaigns.
                </p>

                {formErrors.submit && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FECACA',
                      color: '#B91C1C',
                      fontSize: '12.5px',
                      marginBottom: '16px',
                      lineHeight: 1.4,
                    }}
                  >
                    {formErrors.submit}
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#172033', marginBottom: '6px' }}>
                    Email Address <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="email"
                    autoFocus
                    placeholder="e.g. name@university.edu"
                    value={connectEmail}
                    disabled={isRequestingCode}
                    onChange={(e) => {
                      setConnectEmail(e.target.value);
                      if (formErrors.email) setFormErrors((prev) => ({ ...prev, email: null }));
                    }}
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 14px',
                      fontSize: '14px',
                      color: '#10182B',
                      border: formErrors.email ? '1.5px solid #ef4444' : '1.5px solid #CBD5E1',
                      borderRadius: '8px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  {formErrors.email && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontWeight: 600 }}>
                      {formErrors.email}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#172033', marginBottom: '6px' }}>
                    Sender Display Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Mohan Sharma"
                    value={connectName}
                    disabled={isRequestingCode}
                    onChange={(e) => {
                      setConnectName(e.target.value);
                      if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: null }));
                    }}
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 14px',
                      fontSize: '14px',
                      color: '#10182B',
                      border: formErrors.name ? '1.5px solid #ef4444' : '1.5px solid #CBD5E1',
                      borderRadius: '8px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  {formErrors.name && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontWeight: 600 }}>
                      {formErrors.name}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#172033', marginBottom: '6px' }}>
                      Receiver Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Faculty Member"
                      value={connectReceiverName}
                      disabled={isRequestingCode}
                      onChange={(e) => setConnectReceiverName(e.target.value)}
                      style={{
                        width: '100%',
                        height: '44px',
                        padding: '0 14px',
                        fontSize: '14px',
                        color: '#10182B',
                        border: '1.5px solid #CBD5E1',
                        borderRadius: '8px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#172033', marginBottom: '6px' }}>
                      Receiver Email
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. target@university.edu"
                      value={connectReceiverEmail}
                      disabled={isRequestingCode}
                      onChange={(e) => {
                        setConnectReceiverEmail(e.target.value);
                        if (formErrors.receiver_email) setFormErrors((prev) => ({ ...prev, receiver_email: null }));
                      }}
                      style={{
                        width: '100%',
                        height: '44px',
                        padding: '0 14px',
                        fontSize: '14px',
                        color: '#10182B',
                        border: formErrors.receiver_email ? '1.5px solid #ef4444' : '1.5px solid #CBD5E1',
                        borderRadius: '8px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    {formErrors.receiver_email && (
                      <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontWeight: 600 }}>
                        {formErrors.receiver_email}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setIsConnectModalOpen(false)}
                    disabled={isRequestingCode}
                    style={{
                      height: '42px',
                      padding: '0 16px',
                      borderRadius: '8px',
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      color: '#475569',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isRequestingCode}
                    style={{
                      height: '42px',
                      padding: '0 20px',
                      borderRadius: '8px',
                      backgroundColor: '#4361EE',
                      border: 'none',
                      color: '#ffffff',
                      fontWeight: 700,
                      cursor: isRequestingCode ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(67, 97, 238, 0.3)',
                    }}
                  >
                    {isRequestingCode ? (
                      <>
                        <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                        <span>Sending code...</span>
                      </>
                    ) : (
                      <span>Send Verification Code</span>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Step 2: OTP Verification Code Entry */
              <form onSubmit={handleVerifyConnectCode}>
                <p style={{ fontSize: '13.5px', color: '#667085', margin: '0 0 18px 0', lineHeight: 1.5 }}>
                  Enter the six-digit verification code sent to{' '}
                  <strong style={{ color: '#10182B' }}>{connectEmail.trim()}</strong>
                </p>

                {formErrors.otp && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FECACA',
                      color: '#B91C1C',
                      fontSize: '12.5px',
                      marginBottom: '16px',
                    }}
                  >
                    {formErrors.otp}
                  </div>
                )}

                {/* 6 Digit Numeric Boxes */}
                <div
                  onPaste={handleOtpPaste}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(6, 1fr)',
                    gap: '8px',
                    marginBottom: '18px',
                  }}
                >
                  {connectOtpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (otpInputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      disabled={isVerifyingCode}
                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      style={{
                        width: '100%',
                        height: '48px',
                        textAlign: 'center',
                        fontSize: '20px',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        color: '#10182B',
                        backgroundColor: digit ? '#F8FAFC' : '#FFFFFF',
                        border: digit ? '2px solid #4361EE' : '1.5px solid #CBD5E1',
                        borderRadius: '8px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  ))}
                </div>

                {/* Resend Link */}
                <div style={{ textAlign: 'center', fontSize: '12.5px', color: '#667085', marginBottom: '22px' }}>
                  <span>Didn't receive the code? </span>
                  {connectCooldown > 0 ? (
                    <span style={{ fontWeight: 600, color: '#94A3B8' }}>Resend in {connectCooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestConnectCode}
                      disabled={isRequestingCode}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#4361EE',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                    >
                      Resend Code
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setConnectStep('input')}
                    disabled={isVerifyingCode}
                    style={{
                      height: '42px',
                      padding: '0 16px',
                      borderRadius: '8px',
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      color: '#475569',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Back
                  </button>

                  <button
                    type="submit"
                    disabled={isVerifyingCode || connectOtpDigits.some((d) => !d)}
                    style={{
                      height: '42px',
                      padding: '0 20px',
                      borderRadius: '8px',
                      backgroundColor: '#4361EE',
                      border: 'none',
                      color: '#ffffff',
                      fontWeight: 700,
                      cursor: isVerifyingCode || connectOtpDigits.some((d) => !d) ? 'not-allowed' : 'pointer',
                      opacity: connectOtpDigits.some((d) => !d) ? 0.65 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(67, 97, 238, 0.3)',
                    }}
                  >
                    {isVerifyingCode ? (
                      <>
                        <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <span>Verify & Connect</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          EDIT SENDER MODAL (Requirement 2 & 3: Matching Screenshot Specifications)
          ========================================================================= */}
      {isEditModalOpen && editingAccount && (() => {
        const emailParts = (editingAccount.email_address || '').split('@');
        const emailPrefix = emailParts[0] || '';
        const emailDomain = emailParts[1] || '';

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-sender-title"
            onClick={() => !isSavingEdit && setIsEditModalOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9990,
              backgroundColor: 'rgba(16, 24, 43, 0.65)',
              backdropFilter: 'blur(5px)',
              display: 'flex',
              alignItems: 'stretch',
              justifyContent: 'flex-end',
              padding: 0,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                  position: 'fixed',
                  top: 0,
                  right: 0,
                  width: '700px',
                  maxWidth: '100vw',
                  height: '100dvh',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 0,
                  borderLeft: '1px solid rgba(226, 232, 240, 0.9)',
                  boxShadow: '-8px 0 30px rgba(15, 23, 42, 0.12)',
                  padding: '24px 32px',
                  boxSizing: 'border-box',
                  overflowY: 'hidden',
                  overflowX: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h3
                    id="edit-sender-title"
                    style={{ fontSize: '20px', fontWeight: 800, color: '#10182B', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}
                  >
                    Edit sender
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: 1.45 }}>
                    Configure your sender identity and default recipient details for outreach campaigns.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSavingEdit}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94A3B8',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Informational Guidance Text */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  backgroundColor: '#F0F4FF',
                  border: '1px solid #D0E0FF',
                  color: '#2B4FB2',
                  fontSize: '12.5px',
                  lineHeight: 1.45,
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Sparkles size={16} color="#4361EE" style={{ flexShrink: 0 }} />
                <span>
                  Sender and receiver information saved here will be automatically populated when selecting this sender in the campaign creation workflow.
                </span>
              </div>

              {editErrors.submit && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FECACA',
                    color: '#B91C1C',
                    fontSize: '12.5px',
                    marginBottom: '16px',
                  }}
                >
                  {editErrors.submit}
                </div>
              )}

              <form onSubmit={handleSaveEdit} noValidate>
                {/* Sender Email Presentation (prefix@domain display) */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#172033', marginBottom: '6px' }}>
                    Sender Email Address
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        value={emailPrefix}
                        disabled
                        aria-label="Email Prefix"
                        style={{
                          width: '100%',
                          height: '42px',
                          padding: '0 12px',
                          fontSize: '13.5px',
                          fontWeight: 600,
                          color: '#334155',
                          backgroundColor: '#F8FAFC',
                          border: '1.5px solid #CBD5E1',
                          borderRadius: '8px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#64748B' }}>@</span>
                    <div style={{ flex: 1.2 }}>
                      <input
                        type="text"
                        value={emailDomain}
                        disabled
                        aria-label="Email Domain"
                        style={{
                          width: '100%',
                          height: '42px',
                          padding: '0 12px',
                          fontSize: '13.5px',
                          fontWeight: 600,
                          color: '#334155',
                          backgroundColor: '#F8FAFC',
                          border: '1.5px solid #CBD5E1',
                          borderRadius: '8px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: '#E8EDFF',
                        color: '#4361EE',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Verified
                    </span>
                  </div>
                  <span style={{ display: 'block', fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
                    Sender email identity is verified via ownership challenges.
                  </span>
                </div>

                {/* Sender Name */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#172033', marginBottom: '6px' }}>
                    Sender Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={editFromName}
                    disabled={isSavingEdit}
                    placeholder="e.g. Dr. Mohan Sharma"
                    onChange={(e) => {
                      setEditFromName(e.target.value);
                      if (editErrors.from_name) setEditErrors((prev) => ({ ...prev, from_name: null }));
                    }}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 14px',
                      fontSize: '14px',
                      color: '#10182B',
                      border: editErrors.from_name ? '1.5px solid #ef4444' : '1.5px solid #CBD5E1',
                      borderRadius: '8px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  {editErrors.from_name && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontWeight: 600 }}>
                      {editErrors.from_name}
                    </div>
                  )}
                </div>

                {/* Reply-To Email */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#172033', marginBottom: '6px' }}>
                    Reply-To Email Address
                  </label>
                  <input
                    type="email"
                    value={editReplyTo}
                    disabled={isSavingEdit}
                    placeholder="e.g. replies@sitechseries.org"
                    onChange={(e) => {
                      setEditReplyTo(e.target.value);
                      if (editErrors.reply_to) setEditErrors((prev) => ({ ...prev, reply_to: null }));
                    }}
                    style={{
                      width: '100%',
                      height: '42px',
                      padding: '0 14px',
                      fontSize: '14px',
                      color: '#10182B',
                      border: editErrors.reply_to ? '1.5px solid #ef4444' : '1.5px solid #CBD5E1',
                      borderRadius: '8px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  {editErrors.reply_to && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontWeight: 600 }}>
                      {editErrors.reply_to}
                    </div>
                  )}
                  <span style={{ display: 'block', fontSize: '11.5px', color: '#64748B', marginTop: '4px' }}>
                    Optional. Inbound replies from recipients will be directed to this address.
                  </span>
                </div>

                {/* Section Divider */}
                <div style={{ height: '1px', backgroundColor: '#E2E8F0', margin: '20px 0' }} />

                {/* Receiver Name & Receiver Email Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px', marginBottom: '24px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#172033', marginBottom: '6px' }}>
                      Receiver Name
                    </label>
                    <input
                      type="text"
                      value={editReceiverName}
                      disabled={isSavingEdit}
                      placeholder="e.g. Faculty Lead / Contact"
                      onChange={(e) => setEditReceiverName(e.target.value)}
                      style={{
                        width: '100%',
                        height: '42px',
                        padding: '0 14px',
                        fontSize: '14px',
                        color: '#10182B',
                        border: '1.5px solid #CBD5E1',
                        borderRadius: '8px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#172033', marginBottom: '6px' }}>
                      Receiver Email Address
                    </label>
                    <input
                      type="email"
                      value={editReceiverEmail}
                      disabled={isSavingEdit}
                      placeholder="e.g. recipient@university.edu"
                      onChange={(e) => {
                        setEditReceiverEmail(e.target.value);
                        if (editErrors.receiver_email) setEditErrors((prev) => ({ ...prev, receiver_email: null }));
                      }}
                      style={{
                        width: '100%',
                        height: '42px',
                        padding: '0 14px',
                        fontSize: '14px',
                        color: '#10182B',
                        border: editErrors.receiver_email ? '1.5px solid #ef4444' : '1.5px solid #CBD5E1',
                        borderRadius: '8px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    {editErrors.receiver_email && (
                      <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontWeight: 600 }}>
                        {editErrors.receiver_email}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '16px', marginTop: 'auto', paddingBottom: '4px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    disabled={isSavingEdit}
                    style={{
                      height: '42px',
                      padding: '0 18px',
                      borderRadius: '8px',
                      backgroundColor: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      color: '#475569',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    style={{
                      height: '42px',
                      padding: '0 24px',
                      borderRadius: '8px',
                      backgroundColor: '#4361EE',
                      border: 'none',
                      color: '#ffffff',
                      fontWeight: 700,
                      cursor: isSavingEdit ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(67, 97, 238, 0.3)',
                    }}
                  >
                    {isSavingEdit ? (
                      <>
                        <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Changes</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          CENTERED FEEDBACK POPUP MODAL (For Conflicts, Restores, Deletes)
          ========================================================================= */}
      <AuthFeedbackModal
        isOpen={popupModal.isOpen}
        type={popupModal.type}
        title={popupModal.title}
        message={popupModal.message}
        actionLabel={popupModal.actionLabel}
        onAction={popupModal.onAction}
        secondaryActionLabel={popupModal.secondaryActionLabel}
        onSecondaryAction={popupModal.onSecondaryAction}
        onClose={closePopupModal}
      />
    </div>
  );
}
