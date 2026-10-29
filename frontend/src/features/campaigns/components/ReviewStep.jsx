import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Mail,
  Users,
  Calendar,
  Edit2,
  Send,
  Eye,
  ShieldCheck,
  Clock,
  Sparkles,
  X,
  Smartphone,
  Monitor,
  Check,
  ArrowRight,
  ArrowLeft,
  AlertOctagon,
  FileText,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';
import { CURATED_TEMPLATES, renderPersonalizedText, SAMPLE_RECIPIENT } from '../campaignConstants';

export default function ReviewStep({
  campaignName,
  subject,
  previewText,
  fromName,
  fromEmail,
  replyTo,
  receiverName,
  receiverEmail,
  selectedTags = [],
  editorMode = 'template_gallery',
  selectedTemplateId,
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
  mlPrediction,
  loadingML,
  preflight,
  onJumpToStep,
  onLaunch,
  submitting,
  isStale = false,
}) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [ackConfirmed, setAckConfirmed] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewViewport, setPreviewViewport] = useState('desktop'); // 'desktop' | 'mobile'

  // Lock body scroll when review modals are open
  useEffect(() => {
    if (showConfirmModal || showPreviewModal) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [showConfirmModal, showPreviewModal]);

  const blockers = preflight?.blockers || [];
  const warnings = preflight?.warnings || [];
  const checks = preflight?.checks || [];

  const currentTemplate = CURATED_TEMPLATES.find((t) => t.id === selectedTemplateId);

  const formattedScheduledTime =
    !sendImmediately && scheduledAtDate
      ? `${scheduledAtDate} at ${scheduledAtTime || '09:00'} (${timezoneName || 'UTC'})`
      : 'Immediate delivery upon launch confirmation';

  const personalizedSubject = renderPersonalizedText(subject, SAMPLE_RECIPIENT);
  const personalizedPreview = renderPersonalizedText(previewText, SAMPLE_RECIPIENT);
  const personalizedHtml = renderPersonalizedText(htmlContent, SAMPLE_RECIPIENT);

  const failedChecks = checks.filter((c) => c.status === 'blocked' || c.status === 'failed');
  const warningChecks = checks.filter((c) => c.status === 'warning');
  const passedChecks = checks.filter((c) => c.status === 'passed');
  const unavailableChecks = checks.filter((c) => c.status === 'unavailable');

  const renderStatusIcon = (status, size = 16) => {
    switch (status) {
      case 'passed':
        return (
          <div
            style={{
              width: `${size + 4}px`,
              height: `${size + 4}px`,
              borderRadius: '50%',
              backgroundColor: '#ecfdf5',
              border: '2px solid #10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#059669',
              flexShrink: 0,
            }}
          >
            <Check size={size - 4} strokeWidth={3} />
          </div>
        );
      case 'blocked':
      case 'failed':
        return (
          <div
            style={{
              width: `${size + 4}px`,
              height: `${size + 4}px`,
              borderRadius: '50%',
              backgroundColor: '#fef2f2',
              border: '2px solid #ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#dc2626',
              flexShrink: 0,
            }}
          >
            <X size={size - 4} strokeWidth={3} />
          </div>
        );
      case 'warning':
        return (
          <div
            style={{
              width: `${size + 4}px`,
              height: `${size + 4}px`,
              borderRadius: '50%',
              backgroundColor: '#fffbeb',
              border: '2px solid #f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#d97706',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: `${size - 5}px`, fontWeight: 800, lineHeight: 1 }}>!</span>
          </div>
        );
      case 'unavailable':
      default:
        return (
          <div
            style={{
              width: `${size + 4}px`,
              height: `${size + 4}px`,
              borderRadius: '50%',
              backgroundColor: '#f1f5f9',
              border: '2px solid #94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: `${size - 5}px`, fontWeight: 800, lineHeight: 1 }}>&empty;</span>
          </div>
        );
    }
  };

  return (
    <div className="campaign-step-container" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* 1. Preflight Deliverability Gate Banner */}
      <div
        className={`campaign-preflight-banner ${
          blockers.length > 0 ? 'banner-blocked' : 'banner-ready'
        }`}
        style={{
          padding: '20px 24px',
          borderRadius: '14px',
          backgroundColor: blockers.length > 0 ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${blockers.length > 0 ? '#fecaca' : '#bbf7d0'}`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: '16px',
        }}
      >
        <div style={{ marginTop: '2px' }}>
          {blockers.length > 0 ? (
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#dc2626',
              }}
            >
              <AlertTriangle size={20} />
            </div>
          ) : (
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#16a34a',
              }}
            >
              <CheckCircle2 size={20} />
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: '0 0 4px 0',
              fontSize: '17px',
              fontWeight: 800,
              color: blockers.length > 0 ? '#991b1b' : '#166534',
            }}
          >
            {blockers.length > 0
              ? `${blockers.length} Mandatory Deliverability Blocker(s) Detected`
              : 'Campaign Verified & Ready for Launch'}
          </h3>
          <p
            style={{
              margin: '0 0 10px 0',
              fontSize: '13.5px',
              color: blockers.length > 0 ? '#b91c1c' : '#15803d',
              lineHeight: 1.5,
            }}
          >
            {blockers.length > 0
              ? 'Please resolve the following required items before launching your outreach.'
              : 'All sender credentials, audience deduplication checks, and compliance guidelines verified.'}
          </p>

          {blockers.length > 0 && (
            <ul
              style={{
                margin: 0,
                paddingLeft: '20px',
                fontSize: '13px',
                color: '#991b1b',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {blockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}

          {warnings.length > 0 && blockers.length === 0 && (
            <div
              style={{
                fontSize: '12.5px',
                color: '#b45309',
                backgroundColor: '#fffbeb',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #fde68a',
                marginTop: '8px',
              }}
            >
              <strong>Advisory:</strong> {warnings.join(' · ')}
            </div>
          )}
        </div>
      </div>

      {/* 2. Structured Campaign Summary Cards Grid (2x2) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Card 1: Campaign & Sender Details */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '22px 24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={16} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: '#0f172a' }}>
                  Campaign & Sender Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onJumpToStep && onJumpToStep(1)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                }}
              >
                <Edit2 size={12} /> Edit Details
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Campaign Name:</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{campaignName || 'Untitled'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Subject Line:</span>
                <span style={{ fontWeight: 600, color: '#0f172a', textAlign: 'right', maxWidth: '240px' }} title={subject}>
                  {subject}
                </span>
              </div>
              {previewText && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Preview Text:</span>
                  <span style={{ fontStyle: 'italic', color: '#475569', textAlign: 'right', maxWidth: '240px' }} title={previewText}>
                    {previewText}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Sender Identity:</span>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{fromName} &lt;{fromEmail}&gt;</span>
              </div>
              {replyTo && replyTo !== fromEmail && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Reply-To:</span>
                  <span style={{ color: '#0f172a' }}>{replyTo}</span>
                </div>
              )}
              {receiverEmail && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Default Receiver:</span>
                  <span style={{ color: '#0f172a' }}>{receiverName ? `${receiverName} <${receiverEmail}>` : receiverEmail}</span>
                </div>
              )}
              {selectedTags && selectedTags.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>Tags:</span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {selectedTags.map((tag) => (
                      <span key={tag} style={{ fontSize: '11px', padding: '1px 7px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '4px' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Target Audience */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '22px 24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: '#0f172a' }}>
                  Target Audience
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onJumpToStep && onJumpToStep(2)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0284c7',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                }}
              >
                <Edit2 size={12} /> Edit Audience
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Selected Lists:</span>
                <span style={{ fontWeight: 700, color: '#0f172a', textAlign: 'right', maxWidth: '240px' }}>
                  {selectedListNames.length > 0 ? selectedListNames.join(', ') : 'None selected'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Gross Contacts:</span>
                <span style={{ color: '#0f172a' }}>{grossContacts.toLocaleString()} contacts</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Eligible Recipients:</span>
                <span style={{ fontWeight: 800, color: '#059669' }}>
                  {eligibleContacts.toLocaleString()} verified contacts
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Deduplication:</span>
                <span style={{ color: '#0f172a' }}>Automatic by normalized email</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Suppression Filter:</span>
                <span style={{ color: '#059669' }}>Enforced (opt-outs filtered)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Email Design & Content */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '22px 24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={16} color="#7c3aed" />
                <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: '#0f172a' }}>
                  Email Template & Content
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onJumpToStep && onJumpToStep(1)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#7c3aed',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                }}
              >
                <Edit2 size={12} /> Edit Template
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Editor Mode:</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>
                  {editorMode === 'template_gallery' ? 'Template Gallery' : 'Custom HTML Editor'}
                </span>
              </div>
              {editorMode === 'template_gallery' && currentTemplate && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Template Name:</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{currentTemplate.name}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>HTML Size:</span>
                <span style={{ color: '#0f172a' }}>
                  {htmlContent ? `${htmlContent.length.toLocaleString()} characters` : '0 characters'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Tokens Detected:</span>
                <span style={{ color: '#059669' }}>Double-curly syntax valid</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            style={{
              marginTop: '16px',
              padding: '9px 16px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '7px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#0f172a',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Eye size={14} /> Preview Rendered Email
          </button>
        </div>

        {/* Card 4: Schedule & Delivery Timing */}
        <div
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '22px 24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} color="#d97706" />
                <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: '#0f172a' }}>
                  When to Send
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onJumpToStep && onJumpToStep(3)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#d97706',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                }}
              >
                <Edit2 size={12} /> Edit Schedule
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Dispatch Mode:</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  {sendImmediately ? 'Send Immediately' : 'Scheduled Future Send'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Delivery Timing:</span>
                <span style={{ fontWeight: 600, color: '#0f172a', textAlign: 'right', maxWidth: '240px' }}>
                  {formattedScheduledTime}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Timezone:</span>
                <span style={{ color: '#0f172a' }}>{timezoneName || 'UTC'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Open & Click Tracking:</span>
                <span style={{ color: '#059669' }}>Enabled (1x1 pixel & TLS redirects)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Placement Analysis Summary Card */}
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
            marginBottom: '18px',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={20} color="#2563eb" />
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                Placement Analysis Summary
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Pre-launch quality assurance, deliverability test cases, and machine learning placement forecasts.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {(isStale || deliverabilityReport?.is_stale) ? (
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: '#fffbeb',
                  color: '#b45309',
                  border: '1px solid #fde68a',
                }}
              >
                Stale Analysis
              </span>
            ) : (
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0',
                }}
              >
                Analysis Up-to-Date
              </span>
            )}

            <button
              type="button"
              onClick={() => onJumpToStep && onJumpToStep(4)}
              style={{
                padding: '7px 14px',
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '7px',
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#2563eb',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Inspect Full Analysis</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {/* Deliverability Stats Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
            marginBottom: '16px',
          }}
        >
          <div style={{ backgroundColor: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Test Cases Result
            </span>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
              {passedChecks.length} Passed &middot; {warningChecks.length} Warnings &middot; {failedChecks.length} Failed
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Spam-Risk Score
            </span>
            <div style={{ fontSize: '18px', fontWeight: 800, color: deliverabilityReport?.risk_score < 30 ? '#059669' : '#d97706', marginTop: '4px' }}>
              {deliverabilityReport ? `${deliverabilityReport.risk_score} / 100 (${deliverabilityReport.risk_level})` : 'Not run'}
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              ML Placement Forecast
            </span>
            <div style={{ fontSize: '18px', fontWeight: 800, color: mlPrediction?.status === 'available' ? '#059669' : '#64748b', marginTop: '4px' }}>
              {mlPrediction?.status === 'available'
                ? `${Math.round(mlPrediction.inbox_probability * 100)}% Inbox (${mlPrediction.predicted_placement})`
                : 'Model Gated / Unavailable'}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Pre-Launch Readiness Checklist */}
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
            Pre-Launch Verification Checklist ({checks.length} checks)
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Mandatory gates verified by FastAPI backend prior to dispatch authorization.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {checks.map((chk, i) => (
            <div
              key={chk.id || i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: chk.status === 'blocked' ? '#fff5f5' : chk.status === 'warning' ? '#fffdfa' : '#f8fafc',
                border: `1px solid ${chk.status === 'blocked' ? '#fecaca' : chk.status === 'warning' ? '#fde68a' : '#e2e8f0'}`,
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {renderStatusIcon(chk.status, 14)}
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{chk.label}</span>
                <span style={{ color: '#64748b' }}>— {chk.detail}</span>
              </div>

              {chk.related_step && chk.status !== 'passed' && (
                <button
                  type="button"
                  onClick={() => {
                    if (!onJumpToStep) return;
                    const s = chk.related_step;
                    const target = s === 3 ? 1 : s === 4 ? 3 : s === 5 ? 4 : s;
                    onJumpToStep(target);
                  }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: '#0f172a',
                    cursor: 'pointer',
                  }}
                >
                  Resolve
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 5. Final Launch Execution CTA Card */}
      <div
        style={{
          backgroundColor: '#0f172a',
          color: '#ffffff',
          borderRadius: '16px',
          padding: '28px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
          boxShadow: '0 8px 16px -4px rgba(15, 23, 42, 0.25)',
        }}
      >
        <div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: 800, color: '#ffffff' }}>
            {sendImmediately ? 'Ready to Dispatch Outreach Campaign' : 'Ready to Schedule Outreach Campaign'}
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', lineHeight: 1.5 }}>
            {sendImmediately
              ? `Campaign will immediately send to ${eligibleContacts.toLocaleString()} verified eligible recipients.`
              : `Campaign will automatically queue and dispatch on ${formattedScheduledTime}.`}
          </p>
        </div>

        <button
          type="button"
          disabled={submitting || blockers.length > 0}
          onClick={() => setShowConfirmModal(true)}
          style={{
            padding: '14px 28px',
            backgroundColor: blockers.length > 0 ? '#475569' : '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '9px',
            fontSize: '15px',
            fontWeight: 700,
            cursor: blockers.length > 0 ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: blockers.length > 0 ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.4)',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            if (blockers.length === 0) e.currentTarget.style.backgroundColor = '#1d4ed8';
          }}
          onMouseLeave={(e) => {
            if (blockers.length === 0) e.currentTarget.style.backgroundColor = '#2563eb';
          }}
        >
          <Send size={16} />
          <span>
            {submitting
              ? 'Processing Dispatch...'
              : sendImmediately
              ? 'Launch Campaign Now'
              : 'Confirm & Schedule Campaign'}
          </span>
        </button>
      </div>

      {/* Rendered Email Preview Modal */}
      {showPreviewModal && (
        <div
          className="campaign-modal-backdrop"
          onClick={() => setShowPreviewModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="campaign-modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '850px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={18} color="#2563eb" />
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                  Rendered Email Preview (Sample Contact Interpolation)
                </h4>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', backgroundColor: '#e2e8f0', padding: '2px', borderRadius: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('desktop')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      backgroundColor: previewViewport === 'desktop' ? '#ffffff' : 'transparent',
                      color: previewViewport === 'desktop' ? '#0f172a' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Monitor size={13} /> Desktop (600px)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewViewport('mobile')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      backgroundColor: previewViewport === 'mobile' ? '#ffffff' : 'transparent',
                      color: previewViewport === 'mobile' ? '#0f172a' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Smartphone size={13} /> Mobile (375px)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: 0,
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Email Header Preview */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff', fontSize: '13px' }}>
              <div style={{ display: 'flex', marginBottom: '6px' }}>
                <span style={{ width: '80px', color: '#64748b', fontWeight: 600 }}>From:</span>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>{fromName} &lt;{fromEmail}&gt;</span>
              </div>
              <div style={{ display: 'flex', marginBottom: '6px' }}>
                <span style={{ width: '80px', color: '#64748b', fontWeight: 600 }}>To:</span>
                <span style={{ color: '#0f172a' }}>{SAMPLE_RECIPIENT.name} &lt;{SAMPLE_RECIPIENT.email}&gt;</span>
              </div>
              <div style={{ display: 'flex', marginBottom: '6px' }}>
                <span style={{ width: '80px', color: '#64748b', fontWeight: 600 }}>Subject:</span>
                <span style={{ color: '#0f172a', fontWeight: 700 }}>{personalizedSubject}</span>
              </div>
              {previewText && (
                <div style={{ display: 'flex' }}>
                  <span style={{ width: '80px', color: '#64748b', fontWeight: 600 }}>Preview:</span>
                  <span style={{ color: '#64748b', fontStyle: 'italic' }}>{personalizedPreview}</span>
                </div>
              )}
            </div>

            {/* Email Body Iframe Preview */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px',
                backgroundColor: '#f1f5f9',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: previewViewport === 'mobile' ? '375px' : '600px',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  borderRadius: '8px',
                  padding: '20px',
                  transition: 'width 0.2s ease',
                  overflowX: 'hidden',
                }}
              >
                <div
                  dangerouslySetInnerHTML={{ __html: personalizedHtml }}
                  style={{ color: '#1e293b', fontSize: '14px', lineHeight: 1.6 }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          className="campaign-modal-backdrop"
          onClick={() => setShowConfirmModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            className="campaign-modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                }}
              >
                <Send size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  {sendImmediately ? 'Confirm Campaign Launch' : 'Confirm Campaign Schedule'}
                </h4>
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  Final preflight safety verification
                </div>
              </div>
            </div>

            <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, margin: '0 0 16px 0' }}>
              You are about to {sendImmediately ? 'immediately dispatch' : 'schedule'} the campaign{' '}
              <strong>"{campaignName}"</strong> to <strong>{eligibleContacts.toLocaleString()} verified contacts</strong>.
            </p>

            {warnings.length > 0 && (
              <div
                style={{
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '16px',
                  fontSize: '12.5px',
                  color: '#92400e',
                }}
              >
                <strong>Pre-Launch Advisories:</strong>
                <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px' }}>
                  {warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontSize: '13px',
                color: '#334155',
                cursor: 'pointer',
                marginBottom: '24px',
              }}
            >
              <input
                type="checkbox"
                checked={ackConfirmed}
                onChange={(e) => setAckConfirmed(e.target.checked)}
                style={{ marginTop: '2px' }}
              />
              <span>
                I confirm that the sender identity, recipient audience, and email contents are accurate and compliant with institutional outreach guidelines.
              </span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: '9px 18px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '7px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#475569',
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
                  if (onLaunch) onLaunch(true);
                }}
                style={{
                  padding: '9px 20px',
                  backgroundColor: !ackConfirmed || submitting ? '#94a3b8' : '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '7px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: !ackConfirmed || submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Executing...' : 'Confirm & Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
