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
          <span>SerpApi Guard Active</span>
        </div>

        {/* Global Refresh Action */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="btn btn-secondary btn-sm"
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
            <span>Refresh</span>
          </button>
        )}
      </div>
    </header>
  );
}
