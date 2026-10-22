import React from 'react';
import { Cpu, CheckCircle2, AlertTriangle, HelpCircle, RefreshCw, BarChart2 } from 'lucide-react';

export default function MLPredictionPanel({
  prediction,
  loading,
  onRequestPrediction,
  disabled,
}) {
  const isAvailable = prediction?.status === 'available';

  const getTierBadge = (tier) => {
    switch (tier) {
      case 'low_risk':
        return <span className="badge badge-success">High Probability Inbox</span>;
      case 'moderate_risk':
        return <span className="badge badge-warning">Moderate Risk / Ambiguous</span>;
      case 'high_risk':
        return <span className="badge badge-danger">Elevated Spam Likelihood</span>;
      default:
        return <span className="badge badge-neutral">Unclassified</span>;
    }
  };

  return (
    <div className="card" style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Machine-Learning Placement Forecast
            </h3>
            {isAvailable ? (
              getTierBadge(prediction.risk_tier)
            ) : (
              <span className="badge badge-neutral">Model Gated</span>
            )}
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Supervised placement forecast trained and calibrated on verified seedbox outcomes.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={onRequestPrediction}
          disabled={loading || disabled}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          {loading ? 'Evaluating Model...' : 'Calculate ML Placement Forecast'}
        </button>
      </div>

      {isAvailable ? (
        <div style={{ marginTop: '20px' }}>
          {/* Main Probabilities */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              paddingBottom: '20px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ padding: '14px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Estimated Inbox Probability</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                {Math.round((prediction.inbox_probability || 0) * 1000) / 10}%
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Model: {prediction.model_version || 'Calibrated Baseline'}
              </div>
            </div>

            <div style={{ padding: '14px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Confidence Interval</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
                {prediction.confidence_interval ? (
                  `[${Math.round(prediction.confidence_interval[0] * 100)}% – ${Math.round(prediction.confidence_interval[1] * 100)}%]`
                ) : (
                  '± 10%'
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Estimated 95% plausible range
              </div>
            </div>

            <div style={{ padding: '14px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Predicted Placement</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px', textTransform: 'capitalize' }}>
                {prediction.predicted_placement || 'Inbox'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Based on 24 content features
              </div>
            </div>
          </div>

          {/* Model Limitations Disclaimer */}
          <div
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: 'var(--bg-subtle)',
              borderRadius: '6px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}
          >
            <strong>ML Model Disclaimer:</strong> {prediction.limitations}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: '20px', padding: '24px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <Cpu size={22} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h5 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Machine Learning Predictor Not Active
              </h5>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {prediction?.reason ||
                  'Statistical placement prediction requires sufficient calibrated mailbox placement data before deployment. In accordance with strict deliverability engineering guidelines, we do not fabricate fake percentages or unvalidated model predictions.'}
              </p>
              <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Please rely on the <strong>Rule-Based Analyzer</strong> and <strong>Controlled Seedbox Placement Testing</strong> above to evaluate deliverability.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
