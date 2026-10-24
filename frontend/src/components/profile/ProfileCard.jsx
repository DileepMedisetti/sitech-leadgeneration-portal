import React, { useRef, useEffect } from 'react';
import { Mail, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ProfileCard({
  isOpen,
  onClose,
  onOpenLogoutModal,
  onNavigate,
}) {
  const { user } = useAuth();
  const cardRef = useRef(null);

  // Close on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const initials = user?.display_name
    ? user.display_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U';

  const accountsCount = user?.email_accounts_count ?? 0;

  return (
    <div
      ref={cardRef}
      role="menu"
      aria-label="User Profile Menu"
      className="profile-popover-card"
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: '310px',
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '12px',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.08)',
        zIndex: 100,
        overflow: 'hidden',
        animation: 'fadeIn 120ms ease-out',
      }}
    >
      {/* 1. Profile Section */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: '#fafafa',
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: 'var(--primary, #2563eb)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '15px',
            fontWeight: 800,
            flexShrink: 0,
            boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
          }}
        >
          {initials}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--text-primary, #0f172a)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {user?.display_name || 'Workspace User'}
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary, #64748b)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={user?.email}
          >
            {user?.email || 'authenticated'}
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10.5px',
              fontWeight: 600,
              color: '#059669',
              marginTop: '4px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
              }}
            />
            <span>Active Session</span>
          </div>
        </div>
      </div>

      {/* 2. Email Accounts Action Section */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12.5px',
            color: 'var(--text-secondary, #475569)',
            marginBottom: '10px',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600 }}>Configured Senders:</span>
          <span
            style={{
              fontWeight: 700,
              backgroundColor: '#f1f5f9',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
              color: '#0f172a',
            }}
          >
            {accountsCount} account{accountsCount !== 1 ? 's' : ''}
          </span>
        </div>

        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            if (onNavigate) onNavigate('email-accounts');
          }}
          className="btn btn-secondary btn-sm"
          style={{
            width: '100%',
            height: '34px',
            fontSize: '12.5px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            borderColor: '#cbd5e1',
            color: 'var(--text-primary, #0f172a)',
            transition: 'all 140ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f8fafc';
            e.currentTarget.style.borderColor = 'var(--primary, #2563eb)';
            e.currentTarget.style.color = 'var(--primary, #2563eb)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.borderColor = '#cbd5e1';
            e.currentTarget.style.color = 'var(--text-primary, #0f172a)';
          }}
        >
          <Mail size={14} color="var(--primary, #2563eb)" />
          <span>Manage Email Accounts</span>
        </button>
      </div>

      {/* 3. Sign Out Action Section */}
      <div style={{ padding: '8px 10px', backgroundColor: '#ffffff' }}>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            onOpenLogoutModal();
          }}
          style={{
            width: '100%',
            height: '34px',
            background: 'none',
            border: 'none',
            borderRadius: '6px',
            color: '#dc2626',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0 10px',
            transition: 'background-color 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#fef2f2';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <LogOut size={15} color="#dc2626" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}
