import React from 'react';
import { Mail, CheckCircle2, AlertOctagon, HelpCircle, RefreshCw, Layers } from 'lucide-react';

export default function PlacementTestPanel({
  placementTest,
  loading,
  onRunTest,
  disabled,
}) {
  const getOutcomeBadge = (outcome) => {
    switch (outcome?.toLowerCase()) {
      case 'inbox':
        return <span className="badge badge-success">Inbox</span>;
      case 'spam':
        return <span className="badge badge-danger">Spam</span>;
      case 'other':
        return <span className="badge badge-warning">Other / Junk</span>;
      case 'failed':
        return <span className="badge badge-danger">Failed</span>;
      case 'unknown':
      default:
        return <span className="badge badge-neutral">Unknown</span>;
    }
  };

  const obs = placementTest?.observed_count || 0;
  const inboxPct = obs > 0 ? Math.round((placementTest?.inbox_rate || 0) * 100) : 0;
  const spamPct = obs > 0 ? Math.round((placementTest?.spam_rate || 0) * 100) : 0;

  return (
    <div className="card" style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Actual Inbox Placement Testing
            </h3>
            {placementTest && (
              <span className="badge badge-neutral">
                Sample: {placementTest.total_tests} Mailboxes
              </span>
            )}
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Empirical mailbox placement verification across Gmail, Outlook, Yahoo, Apple Mail, and Corporate seed accounts.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={onRunTest}
          disabled={loading || disabled}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          {loading ? 'Testing Seedboxes...' : placementTest ? 'Re-run Placement Test' : 'Run Controlled Placement Test'}
        </button>
      </div>

      {placementTest ? (
        <div style={{ marginTop: '20px' }}>
          {/* Aggregate Outcomes */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '14px',
              paddingBottom: '20px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Inbox Share</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {inboxPct}%
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {placementTest.inbox_count} of {obs} observed mailboxes
              </div>
            </div>

            <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Spam / Junk Share</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {spamPct}%
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {placementTest.spam_count} of {obs} observed mailboxes
              </div>
            </div>

            <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Other / Filtered</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {placementTest.other_count}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Quarantined or promotion tabs
              </div>
            </div>

            <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Observed Sample</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {obs}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Provider: {placementTest.provider_name}
              </div>
            </div>
          </div>

          {/* Seedbox Observations Table */}
          {placementTest.results && placementTest.results.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Seedbox Observations
              </h5>
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Seedbox Mailbox</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Mailbox Provider</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Observed Outcome</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Latency</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Diagnostic Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {placementTest.results.map((res, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                          {res.seed_email}
                        </td>
                        <td style={{ padding: '10px 14px', textTransform: 'capitalize' }}>
                          {res.mailbox_provider.replace('_', ' ')}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {getOutcomeBadge(res.outcome)}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>
                          {res.latency_seconds ? `${res.latency_seconds}s` : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                          {res.detail || 'Standard delivery verification'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Honest Disclaimer */}
          <div
            style={{
              marginTop: '16px',
              padding: '10px 14px',
              background: 'var(--bg-subtle)',
              borderRadius: '6px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}
          >
            <strong>Note on Placement Testing:</strong> Seedbox measurements reflect controlled test mailboxes with clean history. Real-world placement depends on the recipient domain's individual anti-spam filters, sender IP warming, domain DKIM reputation, and user-level engagement.
          </div>
        </div>
      ) : (
        <div style={{ marginTop: '20px', padding: '24px', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
            No placement test executed for this draft yet. Controlled testing verifies real folder placement before launching.
          </p>
        </div>
      )}
    </div>
  );
}
