import React, { useState, useRef, useEffect } from 'react';
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
  Mail,
  X,
} from 'lucide-react';

export default function Sidebar({
  currentTab,
  onSelectTab,
  isOpen,
  onClose,
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const hoverTimeoutRef = useRef(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsSidebarHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    // Subtle anti-flicker delay before collapsing
    hoverTimeoutRef.current = setTimeout(() => {
      setIsSidebarHovered(false);
    }, 120);
  };

  // Immediate collapse when a navigation item is clicked
  const handleNavClick = (tabId) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsSidebarHovered(false);
    onSelectTab(tabId);
    if (onClose) {
      onClose();
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Lock body scroll when mobile sidebar drawer is open
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  const isExpanded = isSidebarHovered || isOpen;

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

      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`sidebar ${isSidebarHovered ? 'is-hovered' : ''} ${isOpen ? 'mobile-open' : ''}`}
        aria-label="Application Sidebar"
      >
        {/* Brand & Top Header */}
        <div
          style={{
            padding: !isExpanded ? '16px 8px' : '16px 18px',
            borderBottom: '1px solid var(--bg-sidebar-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: !isExpanded ? 'center' : 'space-between',
            minHeight: '76px',
            gap: '8px',
            boxSizing: 'border-box',
          }}
        >
          {isExpanded ? (
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

              {/* Mobile Close Button (shown only when opened as mobile drawer) */}
              {isOpen && (
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
              )}
            </>
          ) : (
            /* Collapsed & Not Hovered: Compact Branding */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src="/logo.png"
                alt="Lead Intelligence"
                title="Lead Intelligence"
                onError={() => setLogoFailed(true)}
                style={{
                  maxHeight: '28px',
                  maxWidth: '36px',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
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
                      onClick={() => handleNavClick(item.id)}
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

                    {/* Tooltip shown only in collapsed mode when not expanded */}
                    {!isExpanded && (
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
