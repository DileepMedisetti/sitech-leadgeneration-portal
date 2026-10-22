import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Mail,
  Users,
  Calendar,
  Settings,
  Edit2,
  Send,
  Eye,
  ShieldCheck,
  Info,
} from 'lucide-react';
import DeliverabilityPanel from './DeliverabilityPanel';
import PlacementTestPanel from './PlacementTestPanel';
import MLPredictionPanel from './MLPredictionPanel';

export default function ReviewStep({
  campaignName,
  subject,
  previewText,
  fromName,
  fromEmail,
  replyTo,
  htmlContent,
  selectedListNames = [],
  grossContacts = 0,
  eligibleContacts = 0,
  sendImmediately,
  scheduledAtDate,
  scheduledAtTime,
  timezoneName,
  trackingOptions,
  deliverabilityReport,
  loadingAnalysis,
  onRunDeliverabilityAnalysis,
  placementTest,
  loadingPlacement,
  onRunPlacementTest,
  mlPrediction,
  loadingML,
  onRequestMLPrediction,
  preflight,
  loadingPreflight,
  onJumpToStep,
  onLaunch,
  submitting,
}) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [ackConfirmed, setAckConfirmed] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const blockers = preflight?.blockers || [];
  const warnings = preflight?.warnings || [];
  const canLaunch = preflight ? preflight.can_schedule_or_send : false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Preflight Deliverability Gate Banner */}
      <div
        style={{
          padding: '20px 24px',
          borderRadius: '16px',
          backgroundColor: blockers.length > 0 ? '#fff1f2' : '#f0fdf4',
          border: '1px solid',
          borderColor: blockers.length > 0 ? '#fecdd3' : '#bbf7d0',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: blockers.length > 0 ? '#ffe4e6' : '#dcfce7',
            color: blockers.length > 0 ? '#e11d48' : '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {blockers.length > 0 ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
        </div>

        <div style={{ flex: 1 }}>
          <h4
            style={{
              margin: '0 0 4px 0',
              fontSize: '16px',
              fontWeight: 800,
              color: blockers.length > 0 ? '#9f1239' : '#166534',
            }}
          >
            {blockers.length > 0
              ? `${blockers.length} Preflight Blocker(s) Preventing Launch`
              : 'Campaign Ready for Dispatch'}
          </h4>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: blockers.length > 0 ? '#be123c' : '#15803d',
              lineHeight: 1.4,
            }}
          >
            {blockers.length > 0
              ? 'Address mandatory deliverability blockers below before scheduling or launching this outreach.'
              : 'All deliverability checks, sender alignment, audience deduplication, and unsubscribe compliance verified.'}
          </p>

          {blockers.length > 0 && (
            <ul style={{ margin: '10px 0 0 0', paddingLeft: '20px', fontSize: '13px', color: '#9f1239' }}>
              {blockers.map((b, i) => (
                <li key={i} style={{ marginBottom: '4px' }}>
                  <strong>Blocker:</strong> {b}
                </li>
              ))}
            </ul>
          )}

          {warnings.length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#b45309' }}>
              <strong>Non-blocking warnings:</strong> {warnings.join(' · ')}
            </div>
          )}
        </div>
      </div>

      {/* 4 Summary Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Card 1: Sender & Subject */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb', fontWeight: 700, fontSize: '13px' }}>
                <Mail size={16} /> Sender & Subject
              </div>
              <button
                type="button"
                onClick={() => onJumpToStep(1)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Edit2 size={12} /> Edit
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>SUBJECT</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{subject || '—'}</span>
              </div>
              {previewText && (
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>PREVIEW TEXT</span>
                  <span style={{ color: '#475569' }}>{previewText}</span>
                </div>
              )}
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>FROM</span>
                <span style={{ color: '#0f172a' }}>{fromName} &lt;{fromEmail}&gt;</span>
              </div>
              {replyTo && replyTo !== fromEmail && (
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>REPLY-TO</span>
                  <span style={{ color: '#0f172a' }}>&lt;{replyTo}&gt;</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              style={{
                width: '100%',
                padding: '6px 12px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Eye size={13} /> View Email Content
            </button>
          </div>
        </div>

        {/* Card 2: Target Audience */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb', fontWeight: 700, fontSize: '13px' }}>
                <Users size={16} /> Target Audience
              </div>
              <button
                type="button"
                onClick={() => onJumpToStep(2)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Edit2 size={12} /> Edit
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>SELECTED LISTS</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>
                  {selectedListNames.length > 0 ? selectedListNames.join(', ') : 'No list selected'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>GROSS CONTACTS</span>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{grossContacts}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>ELIGIBLE UNIQUE</span>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: '#16a34a' }}>{eligibleContacts}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '10px', fontSize: '11px', color: '#64748b' }}>
            Deduplicated by normalized email. Re-verified at send time.
          </div>
        </div>

        {/* Card 3: Dispatch & Schedule */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb', fontWeight: 700, fontSize: '13px' }}>
                <Calendar size={16} /> Schedule & Strategy
              </div>
              <button
                type="button"
                onClick={() => onJumpToStep(3)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Edit2 size={12} /> Edit
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>STRATEGY</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  {sendImmediately ? 'Send Immediately' : 'Scheduled Future Delivery'}
                </span>
              </div>
              {!sendImmediately && (
                <div>
                  <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>SCHEDULED FOR</span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>
                    {scheduledAtDate} at {scheduledAtTime} ({timezoneName})
                  </span>
                </div>
              )}
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>TRACKING</span>
                <span style={{ color: '#475569' }}>
                  Opens: {trackingOptions?.track_opens ? 'Enabled' : 'Disabled'} · Clicks: {trackingOptions?.track_clicks ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '10px', fontSize: '11px', color: '#64748b' }}>
            Timestamps normalized to UTC on dispatch.
          </div>
        </div>
      </div>

      {/* Deliverability Intelligence Engines Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
            Deliverability Intelligence & Verification
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Pre-flight diagnostics across deterministic rule scoring, seedbox placement, and calibrated ML prediction.
          </p>
        </div>

        {/* 1. Rule-Based Spam Analyzer */}
        <DeliverabilityPanel
          report={deliverabilityReport}
          loading={loadingAnalysis}
          onRunAnalysis={onRunDeliverabilityAnalysis}
        />

        {/* 2. Controlled Placement Testing Engine */}
        <PlacementTestPanel
          placementTest={placementTest}
          loading={loadingPlacement}
          onRunTest={onRunPlacementTest}
        />

        {/* 3. Calibrated ML Placement Prediction */}
        <MLPredictionPanel
          prediction={mlPrediction}
          loading={loadingML}
          onRequestPrediction={onRequestMLPrediction}
        />
      </div>

      {/* Bottom Launch Action Bar */}
      <div
        style={{
          padding: '24px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px' }}>
          <ShieldCheck size={18} style={{ color: canLaunch ? '#16a34a' : '#d97706' }} />
          <span>
            {canLaunch
              ? 'Deliverability validated. Ready for confirmation.'
              : 'Execute deliverability analysis to verify launch readiness.'}
          </span>
        </div>

        <button
          type="button"
          disabled={!canLaunch || submitting}
          onClick={() => setShowConfirmModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 28px',
            fontSize: '14px',
            fontWeight: 700,
            color: '#ffffff',
            backgroundColor: canLaunch ? '#2563eb' : '#94a3b8',
            border: 'none',
            borderRadius: '8px',
            cursor: canLaunch ? 'pointer' : 'not-allowed',
            boxShadow: canLaunch ? '0 2px 6px rgba(37, 99, 235, 0.25)' : 'none',
          }}
        >
          <Send size={16} />
          {submitting
            ? 'Processing...'
            : sendImmediately
            ? 'Launch Campaign Now'
            : 'Schedule Campaign'}
        </button>
      </div>

      {/* Explicit Confirmation Modal */}
      {showConfirmModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            padding: '20px',
          }}
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.2)',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Send size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  {sendImmediately ? 'Confirm Campaign Launch' : 'Confirm Scheduled Outreach'}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Explicit authorization required before dispatch.
                </p>
              </div>
            </div>

            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
                fontSize: '13px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div>
                <strong>Campaign:</strong> {campaignName}
              </div>
              <div>
                <strong>Recipients:</strong> {eligibleContacts} verified eligible contacts
              </div>
              <div>
                <strong>From:</strong> {fromName} &lt;{fromEmail}&gt;
              </div>
              <div>
                <strong>Timing:</strong>{' '}
                {sendImmediately
                  ? 'Immediate Dispatch'
                  : `${scheduledAtDate} at ${scheduledAtTime} (${timezoneName})`}
              </div>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontSize: '13px',
                color: '#334155',
                cursor: 'pointer',
                lineHeight: 1.4,
              }}
            >
              <input
                type="checkbox"
                checked={ackConfirmed}
                onChange={(e) => setAckConfirmed(e.target.checked)}
                style={{
                  marginTop: '2px',
                  accentColor: '#2563eb',
                  width: '16px',
                  height: '16px',
                }}
              />
              <span>
                I confirm that this campaign content, sender identity, and targeted audience comply with institutional standards and anti-spam regulations.
              </span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: '9px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#475569',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!ackConfirmed || submitting}
                onClick={() => {
                  setShowConfirmModal(false);
                  onLaunch();
                }}
                style={{
                  padding: '9px 24px',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#ffffff',
                  backgroundColor: ackConfirmed ? '#2563eb' : '#94a3b8',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: ackConfirmed ? 'pointer' : 'not-allowed',
                  boxShadow: ackConfirmed ? '0 2px 4px rgba(37, 99, 235, 0.25)' : 'none',
                }}
              >
                {submitting ? 'Dispatching...' : 'Yes, Launch Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Preview Modal */}
      {showPreviewModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            padding: '20px',
          }}
          onClick={() => setShowPreviewModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '85vh',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                Content Preview: {subject}
              </h4>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                ×
              </button>
            </div>

            <div style={{ flex: 1, padding: '28px', overflowY: 'auto' }}>
              <div
                dangerouslySetInnerHTML={{
                  __html: htmlContent
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/{{name}}/g, 'Dr. Margaret Hamilton')
                    .replace(/{{first_name}}/g, 'Margaret')
                    .replace(/{{university}}/g, 'MIT')
                    .replace(/{{department}}/g, 'Computer Science')
                    .replace(/{{unsubscribe_url}}/g, '#unsubscribe'),
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
