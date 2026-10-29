import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Clock,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  AlertOctagon,
  Info,
  Check,
  X,
  Sliders,
  Filter,
} from 'lucide-react';

export default function PlacementAnalysisStep({
  campaignId,
  preflight,
  loadingPreflight,
  deliverabilityReport,
  loadingAnalysis,
  onRunDeliverabilityAnalysis,
  mlPrediction,
  loadingML,
  onRequestMLPrediction,
  onJumpToStep,
  onProceedToReview,
  isStale = false,
}) {
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'failed' | 'warning' | 'passed' | 'unavailable'
  const [expandedCheckId, setExpandedCheckId] = useState(null);

  const checks = preflight?.checks || [];
  const blockers = preflight?.blockers || [];
  const warnings = preflight?.warnings || [];

  // Grouped status counts
  const failedChecks = checks.filter((c) => c.status === 'blocked' || c.status === 'failed');
  const warningChecks = checks.filter((c) => c.status === 'warning');
  const passedChecks = checks.filter((c) => c.status === 'passed');
  const unavailableChecks = checks.filter((c) => c.status === 'unavailable');
  const pendingChecks = checks.filter((c) => c.status === 'pending');

  const filteredChecks = checks.filter((c) => {
    if (filterStatus === 'failed') return c.status === 'blocked' || c.status === 'failed';
    if (filterStatus === 'warning') return c.status === 'warning';
    if (filterStatus === 'passed') return c.status === 'passed';
    if (filterStatus === 'unavailable') return c.status === 'unavailable';
    return true;
  });

  const hasCriticalBlockers = failedChecks.length > 0 || blockers.length > 0;

  // Circular status icon renderer
  const renderStatusIcon = (status, size = 18) => {
    switch (status) {
      case 'passed':
        return (
          <div
            style={{
              width: `${size + 6}px`,
              height: `${size + 6}px`,
              borderRadius: '50%',
              backgroundColor: '#ecfdf5',
              border: '2px solid #10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#059669',
              flexShrink: 0,
            }}
            title="Passed"
          >
            <Check size={size - 4} strokeWidth={3} />
          </div>
        );
      case 'blocked':
      case 'failed':
        return (
          <div
            style={{
              width: `${size + 6}px`,
              height: `${size + 6}px`,
              borderRadius: '50%',
              backgroundColor: '#fef2f2',
              border: '2px solid #ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#dc2626',
              flexShrink: 0,
            }}
            title="Failed"
          >
            <X size={size - 4} strokeWidth={3} />
          </div>
        );
      case 'warning':
        return (
          <div
            style={{
              width: `${size + 6}px`,
              height: `${size + 6}px`,
              borderRadius: '50%',
              backgroundColor: '#fffbeb',
              border: '2px solid #f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d97706',
              flexShrink: 0,
            }}
            title="Warning"
          >
            <span style={{ fontSize: `${size - 5}px`, fontWeight: 800, lineHeight: 1 }}>!</span>
          </div>
        );
      case 'unavailable':
        return (
          <div
            style={{
              width: `${size + 6}px`,
              height: `${size + 6}px`,
              borderRadius: '50%',
              backgroundColor: '#f1f5f9',
              border: '2px solid #94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              flexShrink: 0,
            }}
            title="Unavailable / Not Verified"
          >
            <span style={{ fontSize: `${size - 5}px`, fontWeight: 800, lineHeight: 1 }}>&empty;</span>
          </div>
        );
      case 'pending':
      default:
        return (
          <div
            style={{
              width: `${size + 6}px`,
              height: `${size + 6}px`,
              borderRadius: '50%',
              backgroundColor: '#f8fafc',
              border: '2px solid #cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              flexShrink: 0,
            }}
            title="Pending"
          >
            <Clock size={size - 6} />
          </div>
        );
    }
  };

  const getCategoryBadge = (category) => {
    const map = {
      campaign_details: { label: 'Campaign Details', bg: '#f1f5f9', text: '#475569' },
      sender_identity: { label: 'Sender Identity', bg: '#eff6ff', text: '#1d4ed8' },
      sender_auth: { label: 'Authentication', bg: '#fdf4ff', text: '#a21caf' },
      subject_line: { label: 'Subject Line', bg: '#ecfeff', text: '#0e7490' },
      html_template: { label: 'HTML Template', bg: '#f0fdf4', text: '#15803d' },
      links: { label: 'Links & URLs', bg: '#fefce8', text: '#a16207' },
      personalization: { label: 'Personalization', bg: '#f5f3ff', text: '#6d28d9' },
      rendering: { label: 'Rendering', bg: '#fff1f2', text: '#be123c' },
      audience_readiness: { label: 'Audience', bg: '#f0f9ff', text: '#0369a1' },
      scheduling: { label: 'Scheduling', bg: '#fafaf9', text: '#57534e' },
      deliverability: { label: 'Spam Risk', bg: '#fef2f2', text: '#b91c1c' },
      ml_prediction: { label: 'ML Placement', bg: '#e0e7ff', text: '#4338ca' },
    };
    const c = map[category] || { label: category, bg: '#f1f5f9', text: '#475569' };
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 700,
          backgroundColor: c.bg,
          color: c.text,
          letterSpacing: '0.02em',
        }}
      >
        {c.label}
      </span>
    );
  };

  const getRiskLevelBadge = (level) => {
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
            <XCircle size={12} /> Critical Spam Risk
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

  const isMLAvailable = mlPrediction?.status === 'available';

  return (
    <div className="campaign-step-container" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* 1. Page Heading */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>
            Placement Analysis
          </h2>
          <p style={{ fontSize: '14.5px', color: '#475569', margin: 0, lineHeight: 1.5, maxWidth: '750px' }}>
            Analyze your email content, sender configuration, and deliverability signals before launching your campaign.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="campaign-action-btn-primary"
            onClick={onRunDeliverabilityAnalysis}
            disabled={loadingAnalysis || loadingPreflight}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
          >
            <RefreshCw
              size={15}
              style={{
                animation: loadingAnalysis || loadingPreflight ? 'campaignSpin 1s linear infinite' : 'none',
              }}
            />
            <span>
              {loadingAnalysis || loadingPreflight
                ? 'Evaluating Campaign Checks...'
                : deliverabilityReport
                ? 'Re-run Analysis'
                : 'Run Analysis'}
            </span>
          </button>
        </div>
      </div>

      {/* Stale Analysis Alert Banner */}
      {(isStale || deliverabilityReport?.is_stale) && (
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            color: '#92400e',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '13.5px', fontWeight: 600 }}>
              Campaign inputs were modified since the last analysis run. Results may be outdated.
            </div>
          </div>
          <button
            type="button"
            onClick={onRunDeliverabilityAnalysis}
            disabled={loadingAnalysis}
            style={{
              padding: '6px 14px',
              backgroundColor: '#d97706',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Update Analysis Now
          </button>
        </div>
      )}

      {/* 2. Analysis Summary Metrics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
        }}
      >
        {/* Total Checks */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
            Total Checks
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
            {checks.length}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
            Across 10 categories
          </div>
        </div>

        {/* Passed */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#059669', textTransform: 'uppercase' }}>
              Passed Checks
            </span>
            {renderStatusIcon('passed', 14)}
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
            {passedChecks.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            Verified standards
          </div>
        </div>

        {/* Warnings */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#d97706', textTransform: 'uppercase' }}>
              Warnings
            </span>
            {renderStatusIcon('warning', 14)}
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>
            {warningChecks.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            Advisories to review
          </div>
        </div>

        {/* Failed */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626', textTransform: 'uppercase' }}>
              Failed Checks
            </span>
            {renderStatusIcon('failed', 14)}
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#dc2626', marginTop: '4px' }}>
            {failedChecks.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            Must correct before launch
          </div>
        </div>

        {/* Unavailable */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px 20px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Unavailable
            </span>
            {renderStatusIcon('unavailable', 14)}
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#64748b', marginTop: '4px' }}>
            {unavailableChecks.length}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
            Not verified in environment
          </div>
        </div>

        {/* Rule-Based Spam Risk Score Card */}
        {deliverabilityReport && (
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px 20px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                Spam Risk Score
              </span>
              {getRiskLevelBadge(deliverabilityReport.risk_level)}
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              {deliverabilityReport.risk_score} <span style={{ fontSize: '14px', fontWeight: 500, color: '#94a3b8' }}>/ 100</span>
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
              Deterministic heuristic penalty
            </div>
          </div>
        )}
      </div>

      {/* 3. Machine Learning Placement Prediction Section (Prominent & Separate) */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '24px 28px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: '18px',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  Machine-Learning Email Placement Forecast
                </h3>
                {isMLAvailable ? (
                  <span
                    style={{
                      padding: '2px 9px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: mlPrediction.risk_tier === 'low_risk' ? '#ecfdf5' : '#fffbeb',
                      color: mlPrediction.risk_tier === 'low_risk' ? '#059669' : '#b45309',
                      border: '1px solid currentColor',
                    }}
                  >
                    {mlPrediction.risk_tier === 'low_risk' ? 'High Inbox Probability' : 'Moderate Placement Risk'}
                  </span>
                ) : (
                  <span
                    style={{
                      padding: '2px 9px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: '#f1f5f9',
                      color: '#64748b',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    Model Gated
                  </span>
                )}
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Supervised statistical classification trained and calibrated on verified academic email outreach seedboxes.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onRequestMLPrediction}
            disabled={loadingML}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '7px',
              fontSize: '12.5px',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={13} style={{ animation: loadingML ? 'campaignSpin 1s linear infinite' : 'none' }} />
            <span>{loadingML ? 'Evaluating Model...' : 'Refresh ML Prediction'}</span>
          </button>
        </div>

        {isMLAvailable ? (
          <div>
            {/* Probability Metrics */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px 20px',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                  Estimated Inbox Probability
                </div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                  {Math.round((mlPrediction.inbox_probability || 0) * 1000) / 10}%
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  Model: {mlPrediction.model_version || 'Calibrated v1.0.1'}
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px 20px',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                  Plausible Confidence Bounds (95%)
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                  {mlPrediction.confidence_interval
                    ? `[${Math.round(mlPrediction.confidence_interval[0] * 100)}% – ${Math.round(
                        mlPrediction.confidence_interval[1] * 100
                      )}%]`
                    : '± 8%'}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  Estimated variance range
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px 20px',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                  Predicted Primary Destination
                </div>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 800,
                    color: mlPrediction.predicted_placement === 'inbox' ? '#059669' : '#d97706',
                    marginTop: '4px',
                    textTransform: 'capitalize',
                  }}
                >
                  {mlPrediction.predicted_placement || 'Inbox'}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  Decision boundary forecast
                </div>
              </div>
            </div>

            {/* Top Predictive Factors & Feature Weights */}
            {mlPrediction.feature_importance && mlPrediction.feature_importance.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>
                  Top Predictive Features & Factor Weights (Mathematical Attribution)
                </div>
                <div
                  style={{
                    overflowX: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '8px 14px', fontWeight: 600, color: '#475569' }}>Feature / Signal</th>
                        <th style={{ padding: '8px 14px', fontWeight: 600, color: '#475569' }}>Impact</th>
                        <th style={{ padding: '8px 14px', fontWeight: 600, color: '#475569' }}>Model Weight</th>
                        <th style={{ padding: '8px 14px', fontWeight: 600, color: '#475569' }}>Current Campaign Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mlPrediction.feature_importance.map((f, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 14px', fontWeight: 600, color: '#0f172a' }}>{f.feature}</td>
                          <td style={{ padding: '8px 14px' }}>
                            <span
                              style={{
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: f.impact === 'positive' ? '#ecfdf5' : '#fef2f2',
                                color: f.impact === 'positive' ? '#059669' : '#dc2626',
                              }}
                            >
                              {f.impact === 'positive' ? '+ Positive Signal' : '- Elevated Risk'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 14px', fontFamily: 'monospace', color: '#475569' }}>
                            {f.weight}
                          </td>
                          <td style={{ padding: '8px 14px', color: '#64748b' }}>
                            {typeof f.value === 'number' ? f.value : String(f.value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Model Limitations Legal / Deliverability Disclaimer */}
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#64748b',
                lineHeight: 1.5,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <Info size={15} style={{ flexShrink: 0, marginTop: '2px', color: '#94a3b8' }} />
              <div>
                <strong>Predictive Model Disclaimer:</strong>{' '}
                {mlPrediction.limitations ||
                  'Placement estimates are statistical probabilities derived from controlled seed mailboxes and spam heuristics. They do not guarantee inbox placement for real recipients, whose receiving servers apply dynamic tenant policies, domain reputation, and individual user engagement signals.'}
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '24px 20px',
              textAlign: 'center',
              backgroundColor: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: '10px',
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              ML Placement Prediction Gated
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b', maxWidth: '600px', marginInline: 'auto' }}>
              {mlPrediction?.reason ||
                'No approved machine-learning model is currently active. Placement estimation is gated until sufficient verified test mailbox data is validated.'}
            </p>
          </div>
        )}
      </div>

      {/* 4. Actionable Recommendations Section */}
      {(failedChecks.length > 0 || warningChecks.length > 0) && (
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '24px 28px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
              Actionable Deliverability Recommendations
            </h3>
            <p style={{ margin: 0, fontSize: '13.5px', color: '#64748b' }}>
              Resolve these items to improve inbox deliverability and satisfy pre-launch quality gates.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[...failedChecks, ...warningChecks].map((item, idx) => {
              const isBlocker = item.status === 'blocked' || item.status === 'failed';
              return (
                <div
                  key={item.id || idx}
                  style={{
                    border: `1px solid ${isBlocker ? '#fecaca' : '#fde68a'}`,
                    backgroundColor: isBlocker ? '#fff5f5' : '#fffdfa',
                    borderRadius: '10px',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: '280px' }}>
                    {renderStatusIcon(item.status, 18)}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14.5px', fontWeight: 700, color: '#0f172a' }}>
                          {item.label}
                        </span>
                        {getCategoryBadge(item.category)}
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            backgroundColor: isBlocker ? '#fee2e2' : '#fef3c7',
                            color: isBlocker ? '#991b1b' : '#92400e',
                          }}
                        >
                          {isBlocker ? 'Mandatory Blocker' : 'Warning Advisory'}
                        </span>
                      </div>
                      <div style={{ fontSize: '13.5px', color: '#334155', marginTop: '4px', fontWeight: 500 }}>
                        {item.detail}
                      </div>
                      {item.why_it_matters && (
                        <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px' }}>
                          <strong>Why it matters:</strong> {item.why_it_matters}
                        </div>
                      )}
                      {item.recommendation && (
                        <div style={{ fontSize: '12.5px', color: isBlocker ? '#b91c1c' : '#b45309', marginTop: '4px' }}>
                          <strong>Recommended Fix:</strong> {item.recommendation}
                        </div>
                      )}
                    </div>
                  </div>

                  {item.related_step && item.action_label && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!onJumpToStep) return;
                        const s = item.related_step;
                        const target = s === 3 ? 1 : s === 4 ? 3 : s === 5 ? 4 : s;
                        onJumpToStep(target);
                      }}
                      style={{
                        padding: '7px 14px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        color: '#0f172a',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                        e.currentTarget.style.borderColor = '#94a3b8';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#ffffff';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }}
                    >
                      <span>{item.action_label}</span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Complete Test-Case Results List / Table */}
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '24px 28px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            marginBottom: '18px',
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
              Quality Assurance Test Cases ({filteredChecks.length})
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Comprehensive evaluation across sender configuration, domain auth, content rules, and audience readiness.
            </p>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid',
                backgroundColor: filterStatus === 'all' ? '#0f172a' : '#ffffff',
                color: filterStatus === 'all' ? '#ffffff' : '#64748b',
                borderColor: filterStatus === 'all' ? '#0f172a' : '#cbd5e1',
              }}
            >
              All ({checks.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('failed')}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid',
                backgroundColor: filterStatus === 'failed' ? '#dc2626' : '#ffffff',
                color: filterStatus === 'failed' ? '#ffffff' : '#dc2626',
                borderColor: filterStatus === 'failed' ? '#dc2626' : '#fca5a5',
              }}
            >
              Failed ({failedChecks.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('warning')}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid',
                backgroundColor: filterStatus === 'warning' ? '#d97706' : '#ffffff',
                color: filterStatus === 'warning' ? '#ffffff' : '#d97706',
                borderColor: filterStatus === 'warning' ? '#d97706' : '#fde68a',
              }}
            >
              Warnings ({warningChecks.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('passed')}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid',
                backgroundColor: filterStatus === 'passed' ? '#059669' : '#ffffff',
                color: filterStatus === 'passed' ? '#ffffff' : '#059669',
                borderColor: filterStatus === 'passed' ? '#059669' : '#a7f3d0',
              }}
            >
              Passed ({passedChecks.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('unavailable')}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid',
                backgroundColor: filterStatus === 'unavailable' ? '#64748b' : '#ffffff',
                color: filterStatus === 'unavailable' ? '#ffffff' : '#64748b',
                borderColor: filterStatus === 'unavailable' ? '#64748b' : '#cbd5e1',
              }}
            >
              Unavailable ({unavailableChecks.length})
            </button>
          </div>
        </div>

        {/* Checks Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredChecks.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13.5px' }}>
              No checks match the selected filter.
            </div>
          ) : (
            filteredChecks.map((check, idx) => {
              const isExpanded = expandedCheckId === (check.id || idx);
              return (
                <div
                  key={check.id || idx}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    backgroundColor: isExpanded ? '#f8fafc' : '#ffffff',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div
                    onClick={() => setExpandedCheckId(isExpanded ? null : (check.id || idx))}
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      {renderStatusIcon(check.status, 16)}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                            {check.label}
                          </span>
                          {getCategoryBadge(check.category)}
                        </div>
                        <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                          {check.detail}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {check.related_step && check.action_label && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onJumpToStep) {
                              const s = check.related_step;
                              const target = s === 3 ? 1 : s === 4 ? 3 : s === 5 ? 4 : s;
                              onJumpToStep(target);
                            }
                          }}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            color: '#334155',
                            cursor: 'pointer',
                          }}
                        >
                          {check.action_label}
                        </button>
                      )}
                      <span style={{ color: '#94a3b8' }}>
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        padding: '12px 16px 16px 46px',
                        borderTop: '1px solid #f1f5f9',
                        fontSize: '12.5px',
                        color: '#475569',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      {check.why_it_matters && (
                        <div>
                          <strong>Why it matters:</strong> {check.why_it_matters}
                        </div>
                      )}
                      {check.recommendation && (
                        <div>
                          <strong>Recommendation:</strong> {check.recommendation}
                        </div>
                      )}
                      {check.evidence && (
                        <div style={{ marginTop: '4px' }}>
                          <strong>Observed Evidence:</strong>
                          <pre
                            style={{
                              margin: '4px 0 0 0',
                              padding: '8px 12px',
                              backgroundColor: '#f1f5f9',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              overflowX: 'auto',
                            }}
                          >
                            {JSON.stringify(check.evidence, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 6. Navigation Controls Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          paddingTop: '12px',
          borderTop: '1px solid #e2e8f0',
        }}
      >
        <button
          type="button"
          onClick={() => onJumpToStep && onJumpToStep(1)} // Return to Content
          style={{
            padding: '10px 18px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            fontSize: '13.5px',
            fontWeight: 600,
            color: '#334155',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <ArrowLeft size={16} /> Return to Campaign Content
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {hasCriticalBlockers && (
            <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>
              Resolve {failedChecks.length} blocker(s) before proceeding to Review.
            </span>
          )}
          <button
            type="button"
            onClick={onProceedToReview}
            disabled={hasCriticalBlockers}
            style={{
              padding: '10px 22px',
              backgroundColor: hasCriticalBlockers ? '#94a3b8' : '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: 700,
              cursor: hasCriticalBlockers ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: hasCriticalBlockers ? 'none' : '0 2px 4px rgba(15, 23, 42, 0.2)',
            }}
          >
            <span>Continue to Review</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
