import React from 'react';
import { RefreshCw } from 'lucide-react';

export default function MLPredictionPanel({
  prediction,
  loading,
  onRequestPrediction,
  disabled,
}) {
  const isAvailable = prediction?.status === 'available';

  const getTierBadge = (tier) => {
    switch (tier?.toLowerCase()) {
      case 'low_risk':
        return (
          <span style={{ padding: '3px 9px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 700, backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
            High Probability Inbox
          </span>
        );
      case 'moderate_risk':
        return (
          <span style={{ padding: '3px 9px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 700, backgroundColor: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>
            Moderate Risk / Ambiguous
          </span>
        );
      case 'high_risk':
        return (
          <span style={{ padding: '3px 9px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 700, backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
            Elevated Spam Likelihood
          </span>
        );
      default:
        return (
          <span style={{ padding: '3px 9px', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 600, backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
            Unclassified
          </span>
        );
    }
  };

  return (
    <div className="campaign-card campaign-card-padded">
      <div className="campaign-intel-header-top">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
              Machine-Learning Placement Forecast
            </h3>
            {isAvailable ? (
              getTierBadge(prediction.risk_tier)
            ) : (
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: '#f1f5f9',
                  color: '#64748b',
                  border: '1px solid #e2e8f0',
                }}
              >
                Model Gated
              </span>
            )}
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
            Supervised placement forecast trained and calibrated on verified academic outreach seedbox outcomes.
          </p>
        </div>

        <button
          type="button"
          className="campaign-action-btn-secondary"
          onClick={onRequestPrediction}
          disabled={loading || disabled}
        >
          <RefreshCw size={15} style={{ animation: loading ? 'campaignSpin 1s linear infinite' : 'none' }} />
          <span>{loading ? 'Evaluating Model...' : 'Calculate ML Placement Forecast'}</span>
        </button>
      </div>

      {isAvailable ? (
        <div style={{ marginTop: '20px' }}>
          {/* Main Probabilities Metric Grid */}
          <div className="campaign-intel-stats-grid">
            <div className="campaign-intel-stat-box">
              <span className="campaign-intel-stat-label">Estimated Inbox Probability</span>
              <div className="campaign-intel-stat-value" style={{ color: '#059669' }}>
                {Math.round((prediction.inbox_probability || 0) * 1000) / 10}%
              </div>
              <span className="campaign-intel-stat-desc">
                Model: {prediction.model_version || 'Calibrated Baseline'}
              </span>
            </div>

            <div className="campaign-intel-stat-box">
              <span className="campaign-intel-stat-label">Confidence Interval</span>
              <div className="campaign-intel-stat-value" style={{ fontSize: '20px' }}>
                {prediction.confidence_interval
                  ? `[${Math.round(prediction.confidence_interval[0] * 100)}% – ${Math.round(
                      prediction.confidence_interval[1] * 100
                    )}%]`
                  : '± 8%'}
              </div>
              <span className="campaign-intel-stat-desc">Estimated 95% plausible range</span>
            </div>

            <div className="campaign-intel-stat-box">
              <span className="campaign-intel-stat-label">Predicted Placement</span>
              <div
                className="campaign-intel-stat-value"
                style={{ fontSize: '20px', textTransform: 'capitalize' }}
              >
                {prediction.predicted_placement || 'Inbox'}
              </div>
              <span className="campaign-intel-stat-desc">Based on verified feature weights</span>
            </div>
          </div>

          {/* Feature Importance Table */}
          {prediction.feature_importance && prediction.feature_importance.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                Top Predictive Factors & Feature Weights
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
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>Feature / Signal</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>Direction</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>Impact Weight</th>
                      <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>Explanation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prediction.feature_importance.map((f, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--camp-border-subtle)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                          {f.feature}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
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
                            {f.impact === 'positive' ? '+ Boosts Inbox' : '- Increases Spam'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono, monospace)', color: '#475569' }}>
                          {f.weight}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#64748b' }}>
                          {f.detail || 'Standard heuristic contribution'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
            Machine learning forecast not calculated yet. Click above to analyze 24+ delivery factors.
          </p>
        </div>
      )}
    </div>
  );
}
