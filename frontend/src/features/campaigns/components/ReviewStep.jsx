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
} from 'lucide-react';
import DeliverabilityPanel from './DeliverabilityPanel';
import PlacementTestPanel from './PlacementTestPanel';
import MLPredictionPanel from './MLPredictionPanel';
import { CURATED_TEMPLATES, renderPersonalizedText } from '../campaignConstants';

export default function ReviewStep({
  campaignName,
  subject,
  previewText,
  fromName,
  fromEmail,
  replyTo,
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
  onRunDeliverabilityAnalysis,
  placementTest,
  loadingPlacement,
  onRunPlacementTest,
  mlPrediction,
  loadingML,
  onRequestMLPrediction,
  preflight,
  onJumpToStep,
  onLaunch,
  submitting,
}) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [ackConfirmed, setAckConfirmed] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [activeIntelTab, setActiveIntelTab] = useState('rules'); // 'rules' | 'placement' | 'ml'

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

  const currentTemplate = CURATED_TEMPLATES.find((t) => t.id === selectedTemplateId);

  const formattedScheduledTime =
    !sendImmediately && scheduledAtDate
      ? `${scheduledAtDate} at ${scheduledAtTime || '09:00'} (${timezoneName || 'UTC'})`
      : 'Immediate delivery upon launch confirmation';

  return (
    <div className="campaign-step-container">
      {/* 1. Preflight Deliverability Gate Banner */}
      <div
        className={`campaign-preflight-banner ${
          blockers.length > 0 ? 'banner-blocked' : 'banner-ready'
        }`}
      >
        <div className="campaign-preflight-icon-box">
          {blockers.length > 0 ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
        </div>
        <div className="campaign-preflight-body">
          <h3 className="campaign-preflight-heading">
            {blockers.length > 0
              ? `${blockers.length} Mandatory Deliverability Blocker(s)`
              : 'Campaign Ready for Dispatch'}
          </h3>
          <p className="campaign-preflight-message">
            {blockers.length > 0
              ? 'Please resolve the following required deliverability and compliance items before launching.'
              : 'All sender alignments, audience deduplication checks, and compliance guidelines verified.'}
          </p>

          {blockers.length > 0 && (
            <ul className="campaign-preflight-list">
              {blockers.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}

          {warnings.length > 0 && blockers.length === 0 && (
            <div className="campaign-preflight-warnings">
              <strong>Advisory:</strong> {warnings.join(' · ')}
            </div>
          )}
        </div>
      </div>

      {/* 2. Structured Review Cards Grid (2x2) */}
      <div className="campaign-review-grid">
        {/* Card 1: Campaign & Sender Details */}
        <div className="campaign-card campaign-card-padded campaign-review-card">
          <div className="campaign-review-card-header">
            <div className="campaign-review-card-title-group">
              <Mail size={16} className="campaign-review-card-icon" />
              <h3 className="campaign-review-card-title">Campaign & Sender Details</h3>
            </div>
            <button
              type="button"
              onClick={() => onJumpToStep && onJumpToStep(1)}
              className="campaign-review-edit-btn"
              title="Edit Campaign Details"
            >
              <Edit2 size={12} />
              <span>Edit Details</span>
            </button>
          </div>

          <div className="campaign-review-table">
            <div className="campaign-review-row">
              <span className="campaign-review-label">Campaign Name:</span>
              <span className="campaign-review-value campaign-review-value-bold">
                {campaignName || 'Untitled Campaign'}
              </span>
            </div>
            <div className="campaign-review-row">
              <span className="campaign-review-label">Email Subject:</span>
              <span className="campaign-review-value">{subject}</span>
            </div>
            {previewText && (
              <div className="campaign-review-row">
                <span className="campaign-review-label">Preview Text:</span>
                <span className="campaign-review-value campaign-review-italic">
                  {previewText}
                </span>
              </div>
            )}
            <div className="campaign-review-row">
              <span className="campaign-review-label">Sender Identity:</span>
              <span className="campaign-review-value">
                {fromName} &lt;{fromEmail}&gt;
              </span>
            </div>
            {replyTo && replyTo !== fromEmail && (
              <div className="campaign-review-row">
                <span className="campaign-review-label">Reply-To:</span>
                <span className="campaign-review-value">{replyTo}</span>
              </div>
            )}
            {selectedTags && selectedTags.length > 0 && (
              <div className="campaign-review-row">
                <span className="campaign-review-label">Tags:</span>
                <div className="campaign-review-tags">
                  {selectedTags.map((tag) => (
                    <span key={tag} className="campaign-review-tag-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Email Design & Content */}
        <div className="campaign-card campaign-card-padded campaign-review-card">
          <div className="campaign-review-card-header">
            <div className="campaign-review-card-title-group">
              <Eye size={16} className="campaign-review-card-icon" />
              <h3 className="campaign-review-card-title">Email Design & Content</h3>
            </div>
            <button
              type="button"
              onClick={() => onJumpToStep && onJumpToStep(2)}
              className="campaign-review-edit-btn"
              title="Edit Email Design"
            >
              <Edit2 size={12} />
              <span>Edit Content</span>
            </button>
          </div>

          <div className="campaign-review-table">
            <div className="campaign-review-row">
              <span className="campaign-review-label">Creation Method:</span>
              <span className="campaign-review-value">
                {editorMode === 'template_gallery' ? 'Template Gallery' : 'Custom HTML Editor'}
              </span>
            </div>
            {editorMode === 'template_gallery' && currentTemplate && (
              <div className="campaign-review-row">
                <span className="campaign-review-label">Template:</span>
                <span className="campaign-review-value campaign-review-value-bold">
                  {currentTemplate.name}
                </span>
              </div>
            )}
            <div className="campaign-review-row">
              <span className="campaign-review-label">Content Size:</span>
              <span className="campaign-review-value">
                {htmlContent ? `${htmlContent.length.toLocaleString()} characters` : '0 characters'}
              </span>
            </div>
          </div>

          <div className="campaign-review-preview-action">
            <button
              type="button"
              onClick={() => setShowPreviewModal(true)}
              className="campaign-action-btn-secondary campaign-btn-full"
            >
              <Eye size={14} />
              <span>Preview Rendered Email</span>
            </button>
          </div>
        </div>

        {/* Card 3: Target Audience */}
        <div className="campaign-card campaign-card-padded campaign-review-card">
          <div className="campaign-review-card-header">
            <div className="campaign-review-card-title-group">
              <Users size={16} className="campaign-review-card-icon" />
              <h3 className="campaign-review-card-title">Target Audience</h3>
            </div>
            <button
              type="button"
              onClick={() => onJumpToStep && onJumpToStep(3)}
              className="campaign-review-edit-btn"
              title="Edit Audience Selection"
            >
              <Edit2 size={12} />
              <span>Edit Audience</span>
            </button>
          </div>

          <div className="campaign-review-table">
            <div className="campaign-review-row">
              <span className="campaign-review-label">Selected Lists:</span>
              <span className="campaign-review-value campaign-review-value-bold">
                {selectedListNames.length > 0 ? selectedListNames.join(', ') : 'No lists selected'}
              </span>
            </div>
            <div className="campaign-review-row">
              <span className="campaign-review-label">Gross Contacts:</span>
              <span className="campaign-review-value">
                {grossContacts.toLocaleString()} contacts
              </span>
            </div>
            <div className="campaign-review-row">
              <span className="campaign-review-label">Eligible Contacts:</span>
              <span className="campaign-review-value campaign-review-value-success">
                {eligibleContacts.toLocaleString()} verified recipients
              </span>
            </div>
            <div className="campaign-review-row">
              <span className="campaign-review-label">Deduplication:</span>
              <span className="campaign-review-value">Automatic by normalized email</span>
            </div>
          </div>
        </div>

        {/* Card 4: Schedule & Tracking */}
        <div className="campaign-card campaign-card-padded campaign-review-card">
          <div className="campaign-review-card-header">
            <div className="campaign-review-card-title-group">
              <Calendar size={16} className="campaign-review-card-icon" />
              <h3 className="campaign-review-card-title">Schedule & Tracking</h3>
            </div>
            <button
              type="button"
              onClick={() => onJumpToStep && onJumpToStep(4)}
              className="campaign-review-edit-btn"
              title="Edit Schedule"
            >
              <Edit2 size={12} />
              <span>Edit Schedule</span>
            </button>
          </div>

          <div className="campaign-review-table">
            <div className="campaign-review-row">
              <span className="campaign-review-label">Dispatch Mode:</span>
              <span className="campaign-review-value campaign-review-value-bold">
                {sendImmediately ? 'Send Immediately' : 'Scheduled Future Send'}
              </span>
            </div>
            <div className="campaign-review-row">
              <span className="campaign-review-label">Delivery Timing:</span>
              <span className="campaign-review-value">{formattedScheduledTime}</span>
            </div>
            <div className="campaign-review-row">
              <span className="campaign-review-label">Open Tracking:</span>
              <span className="campaign-review-value">
                {trackingOptions?.track_opens ? 'Enabled (1x1 pixel)' : 'Disabled'}
              </span>
            </div>
            <div className="campaign-review-row">
              <span className="campaign-review-label">Click Tracking:</span>
              <span className="campaign-review-value">
                {trackingOptions?.track_clicks ? 'Enabled (TLS redirect)' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Deliverability Intelligence Suite Tabs */}
      <div className="campaign-card campaign-card-padded campaign-intel-suite-card">
        <div className="campaign-section-header">
          <h3 className="campaign-section-title">Deliverability Intelligence & Verification</h3>
          <p className="campaign-section-subtitle">
            Inspect automated spam filter heuristics, controlled seedbox placement, and predictive machine learning models.
          </p>
        </div>

        {/* Intelligence Tab Navigation */}
        <div className="campaign-intel-tabs-row">
          <button
            type="button"
            onClick={() => setActiveIntelTab('rules')}
            className={`campaign-intel-tab-btn ${
              activeIntelTab === 'rules' ? 'intel-tab-active' : ''
            }`}
          >
            <ShieldCheck size={14} />
            <span>Spam-Risk Analysis</span>
            {deliverabilityReport?.spam_risk_score !== undefined && (
              <span className="campaign-tab-score-pill">
                Score {deliverabilityReport.spam_risk_score}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveIntelTab('placement')}
            className={`campaign-intel-tab-btn ${
              activeIntelTab === 'placement' ? 'intel-tab-active' : ''
            }`}
          >
            <Clock size={14} />
            <span>Seedbox Placement Test</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveIntelTab('ml')}
            className={`campaign-intel-tab-btn ${
              activeIntelTab === 'ml' ? 'intel-tab-active' : ''
            }`}
          >
            <Sparkles size={14} />
            <span>ML Inbox Forecast</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="campaign-intel-tab-body">
          {activeIntelTab === 'rules' && (
            <DeliverabilityPanel
              report={deliverabilityReport}
              loading={loadingAnalysis}
              onRunAnalysis={onRunDeliverabilityAnalysis}
            />
          )}

          {activeIntelTab === 'placement' && (
            <PlacementTestPanel
              placementTest={placementTest}
              loading={loadingPlacement}
              onRunTest={onRunPlacementTest}
            />
          )}

          {activeIntelTab === 'ml' && (
            <MLPredictionPanel
              prediction={mlPrediction}
              loading={loadingML}
              onRequestPrediction={onRequestMLPrediction}
            />
          )}
        </div>
      </div>

      {/* 4. Final Launch Execution CTA Card */}
      <div className="campaign-card campaign-card-padded campaign-launch-cta-card">
        <div className="campaign-launch-cta-content">
          <div className="campaign-launch-cta-text">
            <h3 className="campaign-launch-cta-title">
              {sendImmediately ? 'Ready to Dispatch Campaign' : 'Ready to Schedule Campaign'}
            </h3>
            <p className="campaign-launch-cta-desc">
              {sendImmediately
                ? `Will send immediately to approximately ${eligibleContacts.toLocaleString()} verified eligible contacts.`
                : `Will automatically queue and send on ${formattedScheduledTime}.`}
            </p>
          </div>

          <button
            type="button"
            disabled={submitting || blockers.length > 0}
            onClick={() => setShowConfirmModal(true)}
            className="campaign-launch-primary-btn"
          >
            <Send size={16} />
            <span>
              {submitting
                ? 'Processing...'
                : sendImmediately
                ? 'Launch Campaign Now'
                : 'Confirm & Schedule Campaign'}
            </span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="campaign-modal-backdrop" onClick={() => setShowConfirmModal(false)}>
          <div className="campaign-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="campaign-modal-header">
              <h3 className="campaign-modal-title">
                {sendImmediately ? 'Confirm Campaign Launch' : 'Confirm Scheduled Outreach'}
              </h3>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="campaign-modal-close-btn"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="campaign-modal-body">
              <p style={{ margin: '0 0 16px 0', fontSize: '13.5px', color: '#334155', lineHeight: 1.5 }}>
                You are about to {sendImmediately ? 'dispatch' : 'schedule'} outreach for{' '}
                <strong>{campaignName}</strong> to{' '}
                <strong>{eligibleContacts.toLocaleString()} verified faculty contacts</strong>.
              </p>

              <div className="campaign-modal-summary-box">
                <div className="campaign-modal-summary-row">
                  <span>Subject:</span>
                  <strong style={{ color: '#0f172a' }}>{subject}</strong>
                </div>
                <div className="campaign-modal-summary-row">
                  <span>Sender:</span>
                  <span>
                    {fromName} &lt;{fromEmail}&gt;
                  </span>
                </div>
                <div className="campaign-modal-summary-row">
                  <span>Timing:</span>
                  <span>{formattedScheduledTime}</span>
                </div>
              </div>

              <label className="campaign-modal-checkbox-row">
                <input
                  type="checkbox"
                  className="campaign-checkbox"
                  checked={ackConfirmed}
                  onChange={(e) => setAckConfirmed(e.target.checked)}
                />
                <span style={{ fontSize: '12.5px', color: '#1e293b' }}>
                  I confirm that recipient contact lists are compliant with institutional outreach policies and all deliverability guidelines are met.
                </span>
              </label>
            </div>

            <div className="campaign-modal-footer">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="campaign-action-btn-secondary"
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
                className="campaign-action-btn-primary"
              >
                {submitting ? 'Dispatching...' : 'Yes, Proceed with Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rendered Email Preview Modal */}
      {showPreviewModal && (
        <div className="campaign-modal-backdrop" onClick={() => setShowPreviewModal(false)}>
          <div className="campaign-modal-box campaign-modal-box-lg" onClick={(e) => e.stopPropagation()}>
            <div className="campaign-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={16} color="#2563eb" />
                <h3 className="campaign-modal-title">Email Content Preview</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="campaign-modal-close-btn"
                aria-label="Close preview"
              >
                <X size={18} />
              </button>
            </div>

            <div className="campaign-modal-body" style={{ backgroundColor: '#f8fafc', padding: '24px' }}>
              <div
                className="campaign-preview-inbox-header"
                style={{ marginBottom: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              >
                <div className="campaign-inbox-header-row">
                  <span className="campaign-inbox-header-label">Subject:</span>
                  <span className="campaign-inbox-header-subject">
                    {renderPersonalizedText(subject)}
                  </span>
                </div>
                <div className="campaign-inbox-header-row">
                  <span className="campaign-inbox-header-label">From:</span>
                  <span className="campaign-inbox-header-value">
                    {fromName} &lt;{fromEmail}&gt;
                  </span>
                </div>
                {previewText && (
                  <div className="campaign-inbox-header-row">
                    <span className="campaign-inbox-header-label">Preview:</span>
                    <span className="campaign-inbox-header-preheader">
                      {renderPersonalizedText(previewText)}
                    </span>
                  </div>
                )}
              </div>

              <div className="campaign-device-frame-desktop">
                <div
                  className="campaign-email-render-target"
                  dangerouslySetInnerHTML={{
                    __html: renderPersonalizedText(
                      (htmlContent || '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    ),
                  }}
                />
              </div>
            </div>

            <div className="campaign-modal-footer">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="campaign-action-btn-secondary"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
