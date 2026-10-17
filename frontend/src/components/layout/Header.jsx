import React from 'react';
import { Menu, RefreshCw, ShieldCheck } from 'lucide-react';

export default function Header({
  title,
  subtitle,
  onToggleMobileSidebar,
  onRefresh,
  isRefreshing,
}) {
  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Mobile Hamburger Toggle */}
        <button
          onClick={onToggleMobileSidebar}
          className="btn btn-secondary btn-sm btn-icon"
          id="mobile-menu-btn"
          aria-label="Open Navigation Menu"
          style={{ display: 'none' }}
        >
          <Menu size={18} />
        </button>

        <div>
          <h1
            style={{
              fontSize: '17px',
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-primary)',
              letterSpacing: '-0.3px',
              lineHeight: 1.2,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                margin: '2px 0 0 0',
                lineHeight: 1.2,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* SerpApi Credit Protection Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--primary-light)',
            border: '1px solid var(--primary-border)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            fontSize: '11px',
            color: 'var(--primary-text)',
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
          title="Queries are deduplicated via SHA-256 caching. Webpage contact extraction consumes 0 SerpApi credits."
        >
          <ShieldCheck size={14} color="var(--primary)" />
          <span>SerpApi Guard Active</span>
        </div>

        {/* Global Refresh Action */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="btn btn-secondary btn-sm"
            title="Refresh current workspace data"
            disabled={isRefreshing}
          >
            <RefreshCw
              size={13}
              style={{
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
              }}
            />
            <span>Refresh</span>
          </button>
        )}
      </div>
    </header>
  );
}
