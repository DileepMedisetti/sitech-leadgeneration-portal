import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  AlertOctagon,
} from 'lucide-react';

export default function DeliverabilityPanel({
  report,
  loading,
  onRunAnalysis,
  disabled,
}) {
  const [activeCategory, setActiveCategory] = useState(null);

  const getRiskBadge = (level) => {
    switch (level?.toLowerCase()) {
      case 'low':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 700, backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
            <CheckCircle2 size={12} /> Low Spam Risk
          </span>
        );
      case 'medium':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 700, backgroundColor: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>
            <AlertTriangle size={12} /> Medium Spam Risk
          </span>
        );
      case 'high':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 700, backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
            <AlertOctagon size={12} /> High Spam Risk
          </span>
        );
      case 'critical':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 700, backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #f87171' }}>
            <XCircle size={12} /> Critical Deliverability Risk
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 9px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 600, backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
            Not Analyzed
          </span>
        );
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'blocker':
        return (
          <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
            Mandatory Blocker
          </span>
        );
      case 'error':
        return (
          <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
            High Risk
          </span>
        );
      case 'warning':
        return (
          <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
            Warning
          </span>
        );
      case 'info':
      default:
        return (
          <span style={{ padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
            Notice
          </span>
        );
    }
  };

  const categories = [
    { id: 'content', label: 'Subject & Content Quality' },
    { id: 'personalization', label: 'Personalization & Variables' },
    { id: 'html_links', label: 'HTML Markup & Safe Links' },
    { id: 'authentication', label: 'Authentication & Domain Alignment' },
    { id: 'compliance', label: 'Unsubscribe & Postal Compliance' },
  ];

  const findings = report?.findings || [];
  const blockersCount = findings.filter((f) => f.severity === 'blocker' && f.status === 'failed').length;

  return (
    <div className="campaign-intel-panel">
      {/* Header & Main Score Card */}
      <div className="campaign-card campaign-card-padded">
        <div className="campaign-intel-header-top">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                Rule-Based Spam-Risk Analyzer
              </h3>
              {report && getRiskBadge(report.risk_level)}
            </div>
            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
              Deterministic verification against 24+ academic mail filters, keyword heuristics, link safety, and RFC authentication rules.
            </p>
          </div>

          <button
            type="button"
            className="campaign-action-btn-primary"
            onClick={onRunAnalysis}
            disabled={loading || disabled}
          >
            <RefreshCw size={15} style={{ animation: loading ? 'campaignSpin 1s linear infinite' : 'none' }} />
            <span>
              {loading ? 'Evaluating Rules...' : report ? 'Re-Analyze Content' : 'Run Deliverability Analysis'}
            </span>
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
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#92400e',
              fontSize: '13px',
            }}
          >
            <AlertTriangle size={18} />
            <div>
              <strong>Report is stale:</strong> Email content was edited after this report was generated. Click "Re-Analyze Content" to refresh before launching.
            </div>
          </div>
        )}

        {/* Key Metrics Overview */}
        {report ? (
          <div className="campaign-intel-stats-grid">
            <div className="campaign-intel-stat-box">
              <span className="campaign-intel-stat-label">Spam Risk Score</span>
              <div className="campaign-intel-stat-value">
                {report.risk_score ?? report.spam_risk_score ?? 0}
                <span style={{ fontSize: '14px', fontWeight: 500, color: '#64748b' }}> / 100</span>
              </div>
              <span className="campaign-intel-stat-desc">0 = Spotless, 100 = Critical</span>
            </div>

            <div className="campaign-intel-stat-box">
              <span className="campaign-intel-stat-label">Mandatory Blockers</span>
              <div
                className="campaign-intel-stat-value"
                style={{ color: blockersCount > 0 ? '#dc2626' : '#059669' }}
              >
                {blockersCount}
              </div>
              <span className="campaign-intel-stat-desc">
                {blockersCount > 0 ? 'Must resolve to launch' : 'Zero blockers'}
              </span>
            </div>

            <div className="campaign-intel-stat-box">
              <span className="campaign-intel-stat-label">Failed Rules</span>
              <div className="campaign-intel-stat-value">{report.failed_count ?? 0}</div>
              <span className="campaign-intel-stat-desc">
                Out of {report.findings_count ?? findings.length} total checks
              </span>
            </div>

            <div className="campaign-intel-stat-box">
              <span className="campaign-intel-stat-label">Clean Passed Checks</span>
              <div className="campaign-intel-stat-value" style={{ color: '#059669' }}>
                {report.passed_count ?? 0}
              </div>
              <span className="campaign-intel-stat-desc">Verified compliant</span>
            </div>
          </div>
        ) : (
          <div
            style={{
              marginTop: '16px',
              padding: '28px 20px',
              textAlign: 'center',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px dashed #cbd5e1',
            }}
          >
            <p style={{ margin: 0, color: '#64748b', fontSize: '13.5px' }}>
              No deliverability report has been generated for this campaign yet. Click the button above to run real-time checks.
            </p>
          </div>
        )}
      </div>

      {/* Detailed Category Findings */}
      {report && (
        <div className="campaign-card campaign-card-padded">
          <div className="campaign-section-header">
            <h4 className="campaign-section-title">Rule Findings by Category</h4>
            <p className="campaign-section-subtitle">
              Expand each category to review individual rule outcomes, warnings, and remediation advice.
            </p>
          </div>

          <div className="campaign-findings-accordion">
            {categories.map((cat) => {
              const catFindings = findings.filter((f) => f.category === cat.id);
              const catFailed = catFindings.filter((f) => f.status === 'failed');
              const isOpen = activeCategory === cat.id;

              return (
                <div key={cat.id} className="campaign-category-item">
                  <button
                    type="button"
                    onClick={() => setActiveCategory(isOpen ? null : cat.id)}
                    className="campaign-category-header"
                  >
                    <div className="campaign-category-left">
                      {catFailed.length > 0 ? (
                        <AlertTriangle size={16} color="#d97706" />
                      ) : (
                        <CheckCircle2 size={16} color="#059669" />
                      )}
                      <span className="campaign-category-title">{cat.label}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          backgroundColor: catFailed.length > 0 ? '#fef2f2' : '#ecfdf5',
                          color: catFailed.length > 0 ? '#dc2626' : '#059669',
                          border: catFailed.length > 0 ? '1px solid #fecaca' : '1px solid #a7f3d0',
                        }}
                      >
                        {catFailed.length > 0 ? `${catFailed.length} issue(s)` : 'Passed'}
                      </span>
                      {isOpen ? <ChevronDown size={16} color="#64748b" /> : <ChevronRight size={16} color="#64748b" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="campaign-findings-list">
                      {catFindings.length === 0 ? (
                        <div style={{ fontSize: '13px', color: '#64748b', padding: '8px 0' }}>
                          No specific rules evaluated in this category.
                        </div>
                      ) : (
                        catFindings.map((finding) => (
                          <div key={finding.id} className="campaign-finding-row">
                            <div className="campaign-finding-icon">
                              {finding.status === 'failed' ? (
                                finding.severity === 'blocker' ? (
                                  <XCircle size={16} color="#dc2626" />
                                ) : (
                                  <AlertTriangle size={16} color="#d97706" />
                                )
                              ) : (
                                <CheckCircle2 size={16} color="#059669" />
                              )}
                            </div>

                            <div className="campaign-finding-content">
                              <div className="campaign-finding-title-row">
                                <span className="campaign-finding-rule-name">{finding.name}</span>
                                {finding.status === 'failed' && getSeverityBadge(finding.severity)}
                              </div>
                              <p className="campaign-finding-msg">{finding.message}</p>
                              {finding.recommendation && (
                                <p style={{ fontSize: '11.5px', color: '#2563eb', margin: '2px 0 0 0' }}>
                                  <strong>Tip:</strong> {finding.recommendation}
                                </p>
                              )}
                            </div>
                          </div>
                        ))
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
