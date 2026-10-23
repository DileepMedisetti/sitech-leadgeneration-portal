import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Info,
  Clock,
} from 'lucide-react';

export default function DeliverabilityPanel({
  report,
  loading,
  onRunAnalysis,
  disabled,
}) {
  const [activeCategory, setActiveCategory] = useState(null);

  const getRiskBadge = (level) => {
    switch (level) {
      case 'low':
        return <span className="badge badge-success">Low Spam Risk</span>;
      case 'medium':
        return <span className="badge badge-warning">Medium Spam Risk</span>;
      case 'high':
        return <span className="badge badge-danger">High Spam Risk</span>;
      case 'critical':
        return <span className="badge badge-danger">Critical Deliverability Risk</span>;
      default:
        return <span className="badge badge-neutral">Not Analyzed</span>;
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'blocker':
        return <span className="badge badge-danger">Mandatory Blocker</span>;
      case 'error':
        return <span className="badge badge-danger">High Risk</span>;
      case 'warning':
        return <span className="badge badge-warning">Warning</span>;
      case 'info':
      default:
        return <span className="badge badge-neutral">Notice</span>;
    }
  };

  const categories = [
    { id: 'content', label: 'Subject & Content Quality' },
    { id: 'personalization', label: 'Personalization & Tokens' },
    { id: 'html_links', label: 'HTML Markup & Safe Links' },
    { id: 'authentication', label: 'Authentication & Domain Alignment' },
    { id: 'compliance', label: 'Unsubscribe & Postal Compliance' },
  ];

  const findings = report?.findings || [];
  const failedFindings = findings.filter((f) => f.status === 'failed');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Main Score Card */}
      <div
        className="card"
        style={{
          padding: '24px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Rule-Based Spam-Risk Analyzer
              </h3>
              {report && getRiskBadge(report.risk_level)}
            </div>
            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              Deterministic content quality, link integrity, domain alignment, and compliance checks.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onRunAnalysis}
            disabled={loading || disabled}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={15} className={loading ? 'spinning' : ''} />
            {loading ? 'Evaluating Rules...' : report ? 'Re-Analyze Content' : 'Run Deliverability Analysis'}
          </button>
        </div>

        {/* Stale Warning Banner */}
        {report?.is_stale && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#92400e',
              fontSize: '13px',
            }}
          >
            <AlertTriangle size={18} />
            <div>
              <strong>Report is stale:</strong> Email content was edited after this report was generated. Click "Re-Analyze Content" to update before launching.
            </div>
          </div>
        )}

        {/* Score & Key Metrics Overview */}
        {report ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '16px',
              marginTop: '20px',
              paddingTop: '20px',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Risk Score</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {report.risk_score}
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}> / 100</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                0 = Clean, 100 = High Risk
              </div>
            </div>

            <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Mandatory Blockers</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: report.has_blockers ? 'var(--text-primary)' : 'var(--text-primary)', marginTop: '4px' }}>
                {report.findings.filter((f) => f.severity === 'blocker' && f.status === 'failed').length}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {report.has_blockers ? 'Must resolve to launch' : 'Zero blockers'}
              </div>
            </div>

            <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Failed Checks</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {report.failed_count}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Out of {report.findings_count} total rules
              </div>
            </div>

            <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Clean Passed Checks</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {report.passed_count}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Verified compliant
              </div>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: '20px', padding: '24px', textAlign: 'center', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
              No deliverability analysis has been run for this draft yet. Click the button above to run pre-flight checks.
            </p>
          </div>
        )}
      </div>

      {/* Detailed Category Findings */}
      {report && (
        <div className="card" style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Rule Findings by Category
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {categories.map((cat) => {
              const catFindings = findings.filter((f) => f.category === cat.id);
              const catFailed = catFindings.filter((f) => f.status === 'failed');
              const isOpen = activeCategory === cat.id;

              return (
                <div
                  key={cat.id}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveCategory(isOpen ? null : cat.id)}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      background: isOpen ? 'var(--bg-subtle)' : 'transparent',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {catFailed.length > 0 ? (
                        <AlertTriangle size={18} color="#d97706" />
                      ) : (
                        <CheckCircle2 size={18} color="#16a34a" />
                      )}
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                        {cat.label}
                      </span>
                      {catFailed.length > 0 && (
                        <span className="badge badge-warning" style={{ fontSize: '11px' }}>
                          {catFailed.length} issue{catFailed.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>

                  {isOpen && (
                    <div style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
                      {catFindings.length === 0 ? (
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No rules in this category.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {catFindings.map((finding) => (
                            <div
                              key={finding.rule_code}
                              style={{
                                padding: '12px',
                                borderRadius: '6px',
                                background: finding.status === 'failed' ? '#fafafa' : '#ffffff',
                                border: finding.status === 'failed' ? '1px solid var(--border-color)' : '1px solid var(--border-subtle)',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {finding.status === 'failed' ? (
                                    <XCircle size={16} color="#dc2626" />
                                  ) : (
                                    <CheckCircle2 size={16} color="#16a34a" />
                                  )}
                                  <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                                    {finding.title}
                                  </strong>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {finding.status === 'failed' && getSeverityBadge(finding.severity)}
                                  {finding.status === 'failed' && (
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                      +{finding.risk_points} pts
                                    </span>
                                  )}
                                </div>
                              </div>

                              <p style={{ margin: '6px 0 0 24px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                {finding.explanation}
                              </p>

                              {finding.status === 'failed' && finding.recommendation && (
                                <div
                                  style={{
                                    margin: '8px 0 0 24px',
                                    padding: '8px 12px',
                                    background: 'var(--bg-subtle)',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    color: 'var(--text-primary)',
                                  }}
                                >
                                  <strong>Corrective Action:</strong> {finding.recommendation}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
