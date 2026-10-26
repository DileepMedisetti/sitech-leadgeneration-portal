import React from 'react';
import { RefreshCw } from 'lucide-react';

export default function PlacementTestPanel({
  placementTest,
  loading,
  onRunTest,
  disabled,
}) {
  const getOutcomeBadge = (outcome) => {
    switch (outcome?.toLowerCase()) {
      case 'inbox':
        return (
          <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 700, backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
            Inbox
          </span>
        );
      case 'spam':
        return (
          <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 700, backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
            Spam
          </span>
        );
      case 'other':
        return (
          <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 700, backgroundColor: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>
            Other / Junk
          </span>
        );
      case 'failed':
        return (
          <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 700, backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #f87171' }}>
            Failed
          </span>
        );
      case 'unknown':
      default:
        return (
          <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 600, backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
            Unknown
          </span>
        );
    }
  };

  const obs = placementTest?.observed_count || 0;
  const inboxPct = obs > 0 ? Math.round((placementTest?.inbox_rate || 0) * 100) : 0;
  const spamPct = obs > 0 ? Math.round((placementTest?.spam_rate || 0) * 100) : 0;

  return (
    <div className="campaign-card campaign-card-padded">
      <div className="campaign-intel-header-top">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
              Actual Inbox Placement Testing
            </h3>
            {placementTest && (
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #bfdbfe',
                }}
              >
                Sample: {placementTest.total_tests || obs} Mailboxes
              </span>
            )}
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
            Empirical mailbox placement verification across Gmail, Outlook, Yahoo, Apple Mail, and institutional academic seed accounts.
          </p>
        </div>

        <button
          type="button"
          className="campaign-action-btn-secondary"
          onClick={onRunTest}
          disabled={loading || disabled}
        >
          <RefreshCw size={15} style={{ animation: loading ? 'campaignSpin 1s linear infinite' : 'none' }} />
          <span>
            {loading
              ? 'Testing Seedboxes...'
              : placementTest
              ? 'Re-run Placement Test'
              : 'Run Controlled Placement Test'}
          </span>
        </button>
      </div>

      {placementTest ? (
        <div style={{ marginTop: '20px' }}>
          {/* Aggregate Outcomes Metric Grid */}
          <div className="campaign-intel-stats-grid">
            <div className="campaign-intel-stat-box">
              <span className="campaign-intel-stat-label">Inbox Share</span>
              <div className="campaign-intel-stat-value" style={{ color: '#059669' }}>
                {inboxPct}%
              </div>
              <span className="campaign-intel-stat-desc">
                {placementTest.inbox_count} of {obs} observed mailboxes
              </span>
            </div>

            <div className="campaign-intel-stat-box">
              <span className="campaign-intel-stat-label">Spam / Junk Share</span>
              <div
                className="campaign-intel-stat-value"
                style={{ color: spamPct > 0 ? '#dc2626' : '#0f172a' }}
              >
                {spamPct}%
              </div>
              <span className="campaign-intel-stat-desc">
                {placementTest.spam_count} of {obs} observed mailboxes
              </span>
            </div>

            <div className="campaign-intel-stat-box">
              <span className="campaign-intel-stat-label">Other / Filtered</span>
              <div className="campaign-intel-stat-value">{placementTest.other_count || 0}</div>
              <span className="campaign-intel-stat-desc">Quarantined or promotion tabs</span>
            </div>

            <div className="campaign-intel-stat-box">
              <span className="campaign-intel-stat-label">Observed Sample</span>
              <div className="campaign-intel-stat-value">{obs}</div>
              <span className="campaign-intel-stat-desc">
                Provider: {placementTest.provider_name || 'Standard Seed Network'}
              </span>
            </div>
          </div>

          {/* Seedbox Observations Table */}
          {placementTest.results && placementTest.results.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                Seedbox Observations Log
              </h5>
              <div
                style={{
                  overflowX: 'auto',
                  border: '1px solid var(--camp-border)',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--camp-border)' }}>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>Seedbox Mailbox</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>Mailbox Provider</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>Observed Outcome</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>Latency</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>Diagnostic Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {placementTest.results.map((res, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--camp-border-subtle)' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono, monospace)', fontSize: '12px', color: '#0f172a' }}>
                          {res.seed_email}
                        </td>
                        <td style={{ padding: '10px 14px', textTransform: 'capitalize', color: '#334155' }}>
                          {(res.mailbox_provider || '').replace('_', ' ')}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {getOutcomeBadge(res.outcome)}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#64748b' }}>
                          {res.latency_seconds ? `${res.latency_seconds}s` : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#475569' }}>
                          {res.detail || 'Standard delivery verification'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Placement Disclaimer */}
          <div
            style={{
              marginTop: '18px',
              padding: '12px 16px',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--camp-border)',
              borderRadius: '8px',
              fontSize: '12.5px',
              color: '#64748b',
              lineHeight: 1.5,
            }}
          >
            <strong>Methodology Note:</strong> Seedbox measurements reflect controlled test mailboxes with clean history. Real-world delivery depends on individual university spam filter policies, sender IP reputation, and faculty user engagement.
          </div>
        </div>
      ) : (
        <div
          style={{
            marginTop: '20px',
            padding: '28px 20px',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
            border: '1px dashed #cbd5e1',
          }}
        >
          <p style={{ margin: 0, color: '#64748b', fontSize: '13.5px' }}>
            No placement test executed for this campaign yet. Controlled seedbox testing verifies actual folder placement across major email providers.
          </p>
        </div>
      )}
    </div>
  );
}
