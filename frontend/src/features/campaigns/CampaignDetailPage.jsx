import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Send,
  Calendar,
  Users,
  FileText,
  ShieldCheck,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
} from 'lucide-react';
import { campaignsApi, deliverabilityApi } from '../../services/api-client';
import StatusBadge from '../../components/ui/StatusBadge';
import DeliverabilityPanel from './components/DeliverabilityPanel';
import PlacementTestPanel from './components/PlacementTestPanel';
import MLPredictionPanel from './components/MLPredictionPanel';
import './campaigns.css';

export default function CampaignDetailPage({ campaignId, onNavigate }) {
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview | deliverability | placement | ml
  const [errorMessage, setErrorMessage] = useState(null);

  // Deliverability sub-states
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingPlacement, setLoadingPlacement] = useState(false);
  const [loadingML, setLoadingML] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCampaign = () => {
    if (!campaignId) return;
    setLoading(true);
    campaignsApi
      .get(campaignId)
      .then((res) => {
        setCampaign(res);
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
      alert(err.message || 'Deliverability analysis failed.');
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
      alert(err.message || 'Placement test failed.');
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
      alert(err.message || 'ML prediction request failed.');
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
      alert(err.message || 'Failed to pause campaign.');
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
      alert(err.message || 'Failed to resume campaign.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !campaign) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading campaign workspace...</div>;
  }

  if (errorMessage && !campaign) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: '#b91c1c' }}>{errorMessage}</p>
        <button type="button" className="btn btn-secondary" onClick={() => onNavigate('campaigns')}>
          Back to Campaigns
        </button>
      </div>
    );
  }

  const content = campaign?.content;
  const audience = campaign?.audience;

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate('campaigns')}
            style={{ padding: '6px 10px' }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {campaign.name}
              </h2>
              <StatusBadge status={campaign.status} />
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              Campaign ID: #{String(campaign.id).padStart(3, '0')} · Content Version: v{campaign.current_content_version}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {campaign.status === 'scheduled' && (
            <button type="button" className="btn btn-secondary" onClick={handlePause} disabled={actionLoading}>
              <Pause size={15} /> Pause Schedule
            </button>
          )}
          {campaign.status === 'paused' && (
            <button type="button" className="btn btn-primary" onClick={handleResume} disabled={actionLoading}>
              <Play size={15} /> Resume Schedule
            </button>
          )}
        </div>
      </div>

      {/* Workspace Sub-Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '4px' }}>
        {[
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
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & CONTENT */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Audience Snapshot Card */}
          <div className="card" style={{ padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Recipient Audience Summary
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Enrolled</div>
                <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>{campaign.total_recipients}</div>
              </div>
              <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Delivered (Accepted)</div>
                <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>{campaign.delivered_count}</div>
              </div>
              <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Bounced / Suppressed</div>
                <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>{campaign.bounced_count}</div>
              </div>
              <div style={{ padding: '12px', background: 'var(--bg-subtle)', borderRadius: '6px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Lists Attached</div>
                <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '2px' }}>{audience?.selected_list_ids?.length || 0}</div>
              </div>
            </div>
          </div>

          {/* Email Content Details */}
          {content && (
            <div className="card" style={{ padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Email Content Snapshot (v{content.version})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', marginBottom: '20px' }}>
                <div><strong>Subject:</strong> {content.subject}</div>
                {content.preview_text && <div><strong>Preview Text:</strong> {content.preview_text}</div>}
                <div><strong>From:</strong> {content.from_name} &lt;{content.from_email}&gt;</div>
                {content.reply_to && <div><strong>Reply-To:</strong> {content.reply_to}</div>}
                <div><strong>Content Fingerprint:</strong> <code style={{ fontSize: '11px' }}>{content.content_fingerprint}</code></div>
              </div>

              {/* Rendered Preview */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ padding: '8px 16px', background: 'var(--bg-subtle)', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Email Preview
                </div>
                <div
                  style={{ padding: '24px', background: '#ffffff', minHeight: '180px', color: '#18181b', lineHeight: 1.6 }}
                  dangerouslySetInnerHTML={{ __html: content.html_content }}
                />
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
    </div>
  );
}
