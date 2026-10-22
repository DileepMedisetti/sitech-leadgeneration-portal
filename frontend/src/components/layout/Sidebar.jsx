import React, { useState } from 'react';
import {
  LayoutDashboard,
  Search,
  Compass,
  Cpu,
  Users,
  Contact,
  Send,
  CheckSquare,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

export default function Sidebar({
  currentTab,
  onSelectTab,
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
}) {
  const [logoFailed, setLogoFailed] = useState(false);

  const navSections = [
    {
      title: 'Intelligence',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'jobs', label: 'Search Jobs', icon: Search },
        { id: 'discovery', label: 'Discovery Engine', icon: Compass },
        { id: 'extraction', label: 'Extraction Monitor', icon: Cpu },
      ],
    },
    {
      title: 'Leads & Outreach',
      items: [
        { id: 'leads', label: 'Lead Management', icon: Users },
        { id: 'audience', label: 'Audience', icon: Contact },
        { id: 'campaigns', label: 'Campaigns', icon: Send },
        { id: 'review-queue', label: 'Review Queue', icon: CheckSquare },
      ],
    },
    {
      title: 'System',
      items: [
        { id: 'analytics', label: 'Analytics', icon: BarChart2 },
        { id: 'settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="drawer-backdrop"
          style={{ zIndex: 45 }}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isOpen ? 'mobile-open' : ''}`}>
        {/* Brand & Top Right Collapse Header */}
        <div
          style={{
            padding: isCollapsed ? '16px 8px' : '16px 18px',
            borderBottom: '1px solid var(--bg-sidebar-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            minHeight: '76px',
            gap: '8px',
            boxSizing: 'border-box',
          }}
        >
          {!isCollapsed ? (
            <>
              {/* Brand Logo & Name */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', overflow: 'hidden' }}>
                <img
                  src="/logo.png"
                  alt="Lead Intelligence"
                  onError={() => setLogoFailed(true)}
                  style={{
                    maxHeight: '34px',
                    maxWidth: '140px',
                    width: 'auto',
                    height: 'auto',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
                {logoFailed && (
                  <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                    Sitech Series
                  </div>
                )}
                <div
                  style={{
                    color: 'var(--primary)',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    marginTop: '4px',
                    lineHeight: 1.2,
                  }}
                >
                  Lead Intelligence
                </div>
              </div>

              {/* Mobile Close Button OR Desktop Top Right Collapse Button */}
              {isOpen ? (
                <button
                  onClick={onClose}
                  className="sidebar-collapse-btn"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  aria-label="Close Sidebar"
                >
                  <X size={16} />
                </button>
              ) : (
                <button
                  onClick={onToggleCollapse}
                  className="sidebar-collapse-btn"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                  title="Collapse sidebar (Ctrl+[)"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
            </>
          ) : (
            /* Collapsed Mode: Top Expand Button & Icon */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <img
                src="/logo.png"
                alt="Lead Intelligence"
                title="Lead Intelligence"
                onError={() => setLogoFailed(true)}
                style={{
                  maxHeight: '26px',
                  maxWidth: '36px',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
              <button
                onClick={onToggleCollapse}
                className="sidebar-collapse-btn"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Expand sidebar (Ctrl+[)"
                aria-label="Expand sidebar"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Region */}
        <nav className="sidebar-nav-container">
          {navSections.map((sec, secIdx) => (
            <div key={sec.title} style={{ marginBottom: secIdx < navSections.length - 1 ? '14px' : '6px' }}>
              <div className="sidebar-section-header">
                {sec.title}
              </div>

              {sec.items.map((item) => {
                const Icon = item.icon;
                const active =
                  currentTab === item.id ||
                  (item.id === 'audience' && currentTab === 'create-contact-list') ||
                  (item.id === 'campaigns' && (currentTab === 'create-campaign' || currentTab === 'campaign-detail')) ||
                  (item.id === 'jobs' && (currentTab === 'new-job' || currentTab === 'job-detail'));

                return (
                  <div key={item.id} className="nav-btn-wrapper">
                    <button
                      onClick={() => {
                        onSelectTab(item.id);
                        if (onClose) onClose();
                      }}
                      className={`nav-item-btn ${active ? 'active' : ''}`}
                      aria-label={item.label}
                      aria-current={active ? 'page' : undefined}
                      style={{
                        position: 'relative',
                        color: active ? 'var(--primary-text)' : 'var(--text-sidebar)',
                      }}
                    >
                      <Icon
                        size={18}
                        color={active ? 'var(--primary)' : 'var(--text-sidebar)'}
                        strokeWidth={active ? 2.3 : 1.8}
                        style={{ flexShrink: 0 }}
                      />
                      <span className="nav-item-label">{item.label}</span>
                    </button>

                    {/* Tooltip shown only in collapsed mode */}
                    {isCollapsed && (
                      <span className="sidebar-tooltip">
                        {item.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
