import React, { useState } from 'react';
import { Menu, RefreshCw, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ProfileCard from '../profile/ProfileCard';
import LogoutConfirmModal from '../profile/LogoutConfirmModal';

export default function Header({
  title,
  subtitle,
  onToggleMobileSidebar,
  onRefresh,
  isRefreshing,
  onNavigate,
}) {
  const { user, isAuthenticated } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const userInitials = user?.display_name
    ? user.display_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'M';

  return (
    <>
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
          {/* Mobile Hamburger Toggle */}
          <button
            onClick={onToggleMobileSidebar}
            className="btn btn-secondary btn-sm btn-icon"
            id="mobile-menu-btn"
            aria-label="Open Navigation Menu"
            style={{ display: 'none', flexShrink: 0 }}
          >
            <Menu size={18} />
          </button>

          <div style={{ minWidth: 0, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h1
              style={{
                fontSize: '18px',
                fontWeight: 800,
                margin: 0,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                lineHeight: 1.25,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                style={{
                  fontSize: '12.5px',
                  color: 'var(--text-muted)',
                  margin: '2px 0 0 0',
                  lineHeight: 1.35,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0, marginLeft: 'auto' }}>
          {/* SerpApi Credit Protection Badge */}
          <div
            className="header-badge header-badge-guard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--primary-light)',
              border: '1px solid var(--primary-border)',
              padding: '5px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '11.5px',
              color: 'var(--primary-text)',
              fontWeight: 600,
              letterSpacing: '0.01em',
              boxShadow: 'var(--shadow-xs)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            title="Queries are deduplicated via SHA-256 caching. Webpage contact extraction consumes 0 SerpApi credits."
          >
            <ShieldCheck size={14} color="var(--primary)" strokeWidth={2.2} />
            <span className="header-badge-label">SerpApi Guard Active</span>
          </div>

          {/* Global Refresh Action */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="btn btn-secondary btn-sm header-refresh-btn"
              title="Refresh current workspace data"
              disabled={isRefreshing}
              style={{
                height: '32px',
                padding: '0 12px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw
                size={13}
                style={{
                  animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                }}
              />
              <span className="header-action-label">Refresh</span>
            </button>
          )}

          {/* Profile Card & Avatar Trigger */}
          {isAuthenticated && (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                aria-label="Open User Profile Menu"
                aria-expanded={isProfileOpen}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary, #2563eb)',
                  color: '#ffffff',
                  border: '2px solid #ffffff',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(37, 99, 235, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'transform 120ms ease, box-shadow 120ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {userInitials}
              </button>

              <ProfileCard
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                onOpenLogoutModal={() => {
                  setIsProfileOpen(false);
                  setIsLogoutModalOpen(true);
                }}
                onNavigate={onNavigate}
              />
            </div>
          )}
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onNavigate={onNavigate}
      />
    </>
  );
}
