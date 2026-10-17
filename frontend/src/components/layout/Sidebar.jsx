import React from 'react';
import {
  LayoutDashboard,
  Search,
  PlusCircle,
  Compass,
  Cpu,
  Users,
  CheckSquare,
  BarChart2,
  Settings,
  Sparkles,
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
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'jobs', label: 'Search Jobs', icon: Search },
    { id: 'new-job', label: 'Create Job', icon: PlusCircle },
    { id: 'discovery', label: 'Discovery Engine', icon: Compass },
    { id: 'extraction', label: 'Extraction Monitor', icon: Cpu },
    { id: 'leads', label: 'Lead Management', icon: Users },
    { id: 'review-queue', label: 'Review Queue', icon: CheckSquare },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'settings', label: 'Settings', icon: Settings },
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
            padding: isCollapsed ? '16px 10px' : '16px 18px',
            borderBottom: '1px solid var(--bg-sidebar-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            height: 'var(--header-height)',
            gap: '8px',
          }}
        >
          {!isCollapsed ? (
            <>
              {/* Brand Logo & Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontWeight: 700,
                    boxShadow: '0 2px 6px rgba(13, 148, 136, 0.35)',
                    flexShrink: 0,
                  }}
                  title="Sitech Series Lead Portal"
                >
                  <Sparkles size={18} />
                </div>

                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
                    Sitech Series
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 500 }}>
                    Lead Intelligence
                  </div>
                </div>
              </div>

              {/* Mobile Close Button OR Desktop Top Right Collapse Button */}
              {isOpen ? (
                <button
                  onClick={onClose}
                  className="sidebar-collapse-btn"
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '6px',
                    backgroundColor: 'transparent',
                    border: '1px solid #1e293b',
                    color: '#94a3b8',
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
                    width: '30px',
                    height: '30px',
                    borderRadius: '6px',
                    backgroundColor: 'transparent',
                    border: '1px solid #1e293b',
                    color: '#94a3b8',
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
            /* Collapsed Mode: Top Expand Button */
            <button
              onClick={onToggleCollapse}
              className="sidebar-collapse-btn"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Expand sidebar (Ctrl+[)"
              aria-label="Expand sidebar"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>

        {/* Navigation Region */}
        <nav className="sidebar-nav-container">
          <div className="sidebar-section-header">
            Navigation
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
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
                >
                  <Icon
                    size={18}
                    color={active ? 'var(--primary-border)' : '#94a3b8'}
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
        </nav>

        {/* Bottom Section - Clean status display without bottom collapse button */}
        <div
          style={{
            padding: isCollapsed ? '16px 10px' : '16px 18px',
            borderTop: '1px solid var(--bg-sidebar-border)',
            backgroundColor: '#0b1120',
          }}
        >
          {!isCollapsed ? (
            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--success)',
                    display: 'inline-block',
                  }}
                />
                <span style={{ color: '#cbd5e1', fontWeight: 500 }}>PostgreSQL Active</span>
              </div>
              <div>v2.0 • Academic Lead Portal</div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center' }} title="PostgreSQL Active • v2.0">
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--success)',
                  display: 'inline-block',
                }}
              />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
