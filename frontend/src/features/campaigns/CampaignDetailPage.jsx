import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Send,
  Users,
  FileText,
  ShieldCheck,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  ChevronRight,
  Eye,
  Layers,
  BarChart2,
} from 'lucide-react';
import { campaignsApi, deliverabilityApi } from '../../services/api-client';
import StatusBadge from '../../components/ui/StatusBadge';
import ConfirmationModal from '../../components/ui/ConfirmationModal';
import DeliverabilityPanel from './components/DeliverabilityPanel';
import PlacementTestPanel from './components/PlacementTestPanel';
import MLPredictionPanel from './components/MLPredictionPanel';
import CampaignReportDashboard from './components/CampaignReportDashboard';
import './campaigns.css';

export default function CampaignDetailPage({ campaignId, onNavigate }) {
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // report | overview | deliverability | placement | ml
  const [hasSetInitialTab, setHasSetInitialTab] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Deliverability sub-states
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingPlacement, setLoadingPlacement] = useState(false);
  const [loadingML, setLoadingML] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Centered Feedback Modal State
  const [feedbackModal, setFeedbackModal] = useState({
    isOpen: false,
    type: 'danger',
    title: '',
    message: '',
  });

  const fetchCampaign = () => {
    if (!campaignId) return;
    setLoading(true);
    campaignsApi
      .get(campaignId)
      .then((res) => {
        setCampaign(res);
        if (!hasSetInitialTab) {
          if (res?.status === 'sent' || res?.status === 'completed') {
            setActiveTab('report');
          }
          setHasSetInitialTab(true);
        }
      })
      .catch((err) => {
        setErrorMessage(err.message || 'Failed to load campaign.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCampaign();
  }, [campaignId]);

  const handleRunAnalysis = async () => {
    setLoadingAnalysis(true);
    try {
      const report = await deliverabilityApi.analyzeCampaign(campaignId);
      setCampaign((prev) => ({ ...prev, latest_deliverability_report: report }));
    } catch (err) {
      setFeedbackModal({
        isOpen: true,
        type: 'danger',
        title: 'Deliverability Analysis Failed',
        message: err.message || 'Deliverability analysis could not be completed at this time.',
      });
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const handleRunPlacementTest = async () => {
    setLoadingPlacement(true);
    try {
      const testResult = await deliverabilityApi.runPlacementTest(campaignId, {
        notes: 'Workspace placement test',
      });
      setCampaign((prev) => ({ ...prev, latest_placement_test: testResult }));
    } catch (err) {
      setFeedbackModal({
        isOpen: true,
        type: 'danger',
        title: 'Placement Test Failed',
        message: err.message || 'Placement test simulation failed. Please try again.',
      });
    } finally {
      setLoadingPlacement(false);
    }
  };

  const handleRequestML = async () => {
    setLoadingML(true);
    try {
      const pred = await deliverabilityApi.getMLPrediction(campaignId);
      setCampaign((prev) => ({ ...prev, latest_ml_prediction: pred }));
    } catch (err) {
      setFeedbackModal({
        isOpen: true,
        type: 'danger',
        title: 'ML Prediction Request Failed',
        message: err.message || 'Machine learning placement forecast request failed.',
      });
    } finally {
      setLoadingML(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      await campaignsApi.pause(campaignId);
      fetchCampaign();
    } catch (err) {
      setFeedbackModal({
        isOpen: true,
        type: 'danger',
        title: 'Failed to Pause Campaign',
        message: err.message || 'The campaign could not be paused. Please verify your connection.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      await campaignsApi.resume(campaignId);
      fetchCampaign();
    } catch (err) {
      setFeedbackModal({
        isOpen: true,
        type: 'danger',
        title: 'Failed to Resume Campaign',
        message: err.message || 'The campaign could not be resumed. Please verify your connection.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !campaign) {
    return (
      <div className="campaign-detail-page">
        <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--camp-text-muted)' }}>
          <div className="campaign-loading-spinner" style={{ margin: '0 auto 16px auto' }} />
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Loading campaign workspace...</p>
        </div>
      </div>
    );
  }

  if (errorMessage && !campaign) {
    return (
      <div className="campaign-detail-page">
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <p style={{ color: '#b91c1c', fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>
            {errorMessage}
          </p>
          <button
            type="button"
            className="campaign-action-btn-secondary"
            onClick={() => onNavigate('campaigns')}
          >
            Back to Campaigns
          </button>
        </div>
      </div>
    );
  }

  const content = campaign?.content;
  const audience = campaign?.audience;

  return (
    <div className="campaign-detail-page">
      {/* 1. Breadcrumbs and Top Bar */}
      <div className="campaign-wizard-top" style={{ marginBottom: '16px' }}>
        <div className="campaign-top-bar">
          <nav aria-label="Breadcrumb" className="campaign-breadcrumb">
            <button
              type="button"
              onClick={() => onNavigate('campaigns')}
              className="campaign-breadcrumb-link"
            >
              Campaigns
            </button>
            <ChevronRight size={14} className="campaign-breadcrumb-separator" />
            <span className="campaign-breadcrumb-current" aria-current="page">
              {campaign.name}
            </span>
          </nav>

          <button
            type="button"
            onClick={() => onNavigate('campaigns')}
            className="campaign-back-btn"
            title="Return to campaigns list"
          >
            <ArrowLeft size={14} />
            <span>Back to Campaigns</span>
          </button>
        </div>
      </div>

      {/* 2. Campaign Header Card */}
      <div className="campaign-detail-header-card">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 className="campaign-page-title" style={{ fontSize: '22px' }}>
              {campaign.name}
            </h1>
            <StatusBadge status={campaign.status} />
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--camp-text-muted)' }}>
            Campaign ID: <strong>#{String(campaign.id).padStart(3, '0')}</strong> · Content Version: v{campaign.current_content_version || 1} · Created {campaign.created_at ? new Date(campaign.created_at).toLocaleDateString() : 'recently'}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {campaign.status === 'scheduled' && (
            <button
              type="button"
              className="campaign-action-btn-secondary"
              onClick={handlePause}
              disabled={actionLoading}
            >
              <Pause size={14} />
              <span>Pause Schedule</span>
            </button>
          )}
          {campaign.status === 'paused' && (
            <button
              type="button"
              className="campaign-action-btn-primary"
              onClick={handleResume}
              disabled={actionLoading}
            >
              <Play size={14} />
              <span>Resume Schedule</span>
            </button>
          )}
          <button
            type="button"
            onClick={fetchCampaign}
            className="campaign-back-btn"
            title="Refresh campaign data"
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 3. Top Key Metric Cards */}
      <div className="campaign-detail-kpi-grid">
        <div className="campaign-card campaign-card-padded" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--camp-text-muted)' }}>Total Enrolled</span>
            <Users size={16} color="#2563eb" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--camp-text-primary)' }}>
            {(campaign.total_recipients || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '11.5px', color: 'var(--camp-text-subtle)' }}>Total contacts enrolled</span>
        </div>

        <div className="campaign-card campaign-card-padded" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--camp-text-muted)' }}>Delivered</span>
            <CheckCircle2 size={16} color="#059669" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#059669' }}>
            {(campaign.delivered_count || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '11.5px', color: 'var(--camp-text-subtle)' }}>Accepted by mail servers</span>
        </div>

        <div className="campaign-card campaign-card-padded" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--camp-text-muted)' }}>Bounced / Suppressed</span>
            <AlertTriangle size={16} color="#dc2626" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: (campaign.bounced_count || 0) > 0 ? '#dc2626' : 'var(--camp-text-primary)' }}>
            {(campaign.bounced_count || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '11.5px', color: 'var(--camp-text-subtle)' }}>Failed delivery or opt-outs</span>
        </div>

        <div className="campaign-card campaign-card-padded" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--camp-text-muted)' }}>Lists Attached</span>
            <Layers size={16} color="#6366f1" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--camp-text-primary)' }}>
            {audience?.selected_list_ids?.length || 0}
          </div>
          <span style={{ fontSize: '11.5px', color: 'var(--camp-text-subtle)' }}>Targeted contact lists</span>
        </div>
      </div>

      {/* 4. Sub-Navigation Tabs */}
      <div className="campaign-detail-tabs-bar">
        {[
          { id: 'report', label: 'Campaign Report & Analytics', icon: BarChart2 },
          { id: 'overview', label: 'Overview & Email Content', icon: FileText },
          { id: 'deliverability', label: 'Spam Risk Analysis', icon: ShieldCheck },
          { id: 'placement', label: 'Controlled Placement Test', icon: Send },
          { id: 'ml', label: 'ML Placement Forecast', icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`campaign-detail-tab-btn ${isActive ? 'tab-active' : ''}`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 0: CAMPAIGN REPORT & ANALYTICS */}
      {activeTab === 'report' && (
        <CampaignReportDashboard
          campaignId={campaignId}
          campaignName={campaign.name}
          onNavigate={onNavigate}
        />
      )}

      {/* TAB 1: OVERVIEW & CONTENT */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {content && (
            <div className="campaign-card campaign-card-padded">
              <div className="campaign-section-header">
                <h3 className="campaign-section-title">
                  Email Content Snapshot (v{content.version || 1})
                </h3>
                <p className="campaign-section-subtitle">
                  Authorized snapshot of the email delivered to recipients.
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '12px',
                  marginBottom: '20px',
                  fontSize: '13px',
                  backgroundColor: '#f8fafc',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid var(--camp-border)',
                }}
              >
                <div>
                  <strong style={{ color: 'var(--camp-text-muted)' }}>Subject:</strong>{' '}
                  <span style={{ color: 'var(--camp-text-primary)', fontWeight: 600 }}>{content.subject}</span>
                </div>
                {content.preview_text && (
                  <div>
                    <strong style={{ color: 'var(--camp-text-muted)' }}>Preview Snippet:</strong>{' '}
                    <span style={{ fontStyle: 'italic' }}>{content.preview_text}</span>
                  </div>
                )}
                <div>
                  <strong style={{ color: 'var(--camp-text-muted)' }}>From:</strong>{' '}
                  <span>
                    {content.from_name} &lt;{content.from_email}&gt;
                  </span>
                </div>
                {content.reply_to && (
                  <div>
                    <strong style={{ color: 'var(--camp-text-muted)' }}>Reply-To:</strong>{' '}
                    <span>{content.reply_to}</span>
                  </div>
                )}
                {content.receiver_email && (
                  <div>
                    <strong style={{ color: 'var(--camp-text-muted)' }}>Default Receiver:</strong>{' '}
                    <span>
                      {content.receiver_name ? `${content.receiver_name} <${content.receiver_email}>` : content.receiver_email}
                    </span>
                  </div>
                )}
                {content.content_fingerprint && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong style={{ color: 'var(--camp-text-muted)' }}>Fingerprint:</strong>{' '}
                    <code style={{ fontSize: '11px', color: '#64748b' }}>{content.content_fingerprint}</code>
                  </div>
                )}
              </div>

              {/* Rendered Email Canvas in Desktop Frame */}
              <div
                className="campaign-card"
                style={{
                  border: '1px solid var(--camp-border)',
                  overflow: 'hidden',
                  backgroundColor: '#ffffff',
                }}
              >
                <div className="campaign-preview-toolbar">
                  <div className="campaign-preview-toolbar-title">
                    <div style={{ display: 'flex', gap: '5px', marginRight: '6px' }}>
                      <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                      <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                      <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                    </div>
                    <Eye size={14} color="#2563eb" />
                    <span>Rendered Email Body</span>
                  </div>
                </div>

                <div className="campaign-preview-body-wrapper" style={{ padding: '24px' }}>
                  <div className="campaign-device-frame-desktop">
                    <div
                      className="campaign-email-render-target"
                      dangerouslySetInnerHTML={{ __html: content.html_content }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DELIVERABILITY REPORT */}
      {activeTab === 'deliverability' && (
        <DeliverabilityPanel
          report={campaign.latest_deliverability_report}
          loading={loadingAnalysis}
          onRunAnalysis={handleRunAnalysis}
        />
      )}

      {/* TAB 3: PLACEMENT TEST */}
      {activeTab === 'placement' && (
        <PlacementTestPanel
          placementTest={campaign.latest_placement_test}
          loading={loadingPlacement}
          onRunTest={handleRunPlacementTest}
        />
      )}

      {/* TAB 4: ML PREDICTION */}
      {activeTab === 'ml' && (
        <MLPredictionPanel
          prediction={campaign.latest_ml_prediction}
          loading={loadingML}
          onRequestPrediction={handleRequestML}
        />
      )}

      {/* Centered Feedback Modal */}
      <ConfirmationModal
        isOpen={feedbackModal.isOpen}
        type={feedbackModal.type}
        title={feedbackModal.title}
        message={feedbackModal.message}
        confirmLabel="Dismiss"
        cancelLabel={null}
        confirmVariant="danger"
        onClose={() => setFeedbackModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={() => setFeedbackModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
