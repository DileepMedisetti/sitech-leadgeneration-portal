import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Send,
  CheckCircle2,
  AlertTriangle,
  Eye,
  MousePointer,
  MessageSquare,
  Download,
  RefreshCw,
  Search,
  Filter,
  Info,
  Clock,
  HelpCircle,
  X,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  Check,
  ChevronRight,
  CornerDownLeft,
} from 'lucide-react';
import { campaignsApi } from '../../../services/api-client';
import Pagination from '../../../components/ui/Pagination';

export default function CampaignReportDashboard({ campaignId, campaignName, onNavigate }) {
  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(true);
  const [reportError, setReportError] = useState(null);

  // Recipient table state
  const [recipients, setRecipients] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecipients, setTotalRecipients] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // Reply preview modal
  const [selectedReply, setSelectedReply] = useState(null);

  // Inbound reply simulation modal
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
  const [simulateSenderEmail, setSimulateSenderEmail] = useState('');
  const [simulateSubject, setSimulateSubject] = useState('');
  const [simulateBody, setSimulateBody] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [simulateResult, setSimulateResult] = useState(null);

  const fetchReport = useCallback(async () => {
    if (!campaignId) return;
    setLoadingReport(true);
    setReportError(null);
    try {
      const data = await campaignsApi.getReport(campaignId);
      setReport(data);
    } catch (err) {
      setReportError(err.message || 'Failed to load campaign analytics.');
    } finally {
      setLoadingReport(false);
    }
  }, [campaignId]);

  const fetchRecipients = useCallback(async () => {
    if (!campaignId) return;
    setLoadingRecipients(true);
    try {
      const data = await campaignsApi.getRecipientsReport(campaignId, {
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setRecipients(data.items || []);
      setTotalPages(data.total_pages || 1);
      setTotalRecipients(data.total || 0);
    } catch (err) {
      console.error('Failed to load recipients report:', err);
    } finally {
      setLoadingRecipients(false);
    }
  }, [campaignId, page, pageSize, search, statusFilter]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  const handleSimulateReply = async (e) => {
    e.preventDefault();
    if (!simulateSenderEmail.trim()) return;
    setSimulating(true);
    setSimulateResult(null);
    try {
      const res = await campaignsApi.submitInboundReply(campaignId, {
        sender_email: simulateSenderEmail.trim(),
        subject: simulateSubject.trim() || 'Re: Collaborative Research Inquiry',
        body_snippet: simulateBody.trim() || 'Thank you for reaching out. I would be interested in discussing this proposal.',
      });
      setSimulateResult({ success: true, data: res });
      await fetchReport();
      await fetchRecipients();
    } catch (err) {
      setSimulateResult({ success: false, error: err.message || 'Failed to simulate inbound reply.' });
    } finally {
      setSimulating(false);
    }
  };

  const handleExportCsv = () => {
    if (!campaignId) return;
    const url = campaignsApi.exportRecipientsCsvUrl(campaignId);
    window.open(url, '_blank');
  };

  if (loadingReport && !report) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
        <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
        <p style={{ fontSize: '14px', fontWeight: 600 }}>Loading campaign delivery analytics and engagement data...</p>
      </div>
    );
  }

  if (reportError && !report) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <p style={{ color: '#dc2626', fontSize: '15px', fontWeight: 600 }}>{reportError}</p>
        <button
          type="button"
          onClick={fetchReport}
          style={{
            marginTop: '12px',
            padding: '8px 16px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Retry Loading Report
        </button>
      </div>
    );
  }

  const m = report?.metrics || {};
  const avail = report?.metric_availability || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Dashboard Sub-Header with Freshness and Export */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '16px 20px',
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>
            Campaign Performance and Delivery Analytics
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Real-time delivery verification, tracked opens, click engagements, and inbound replies.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setIsSimulateModalOpen(true)}
            style={{
              padding: '7px 14px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Simulate or test inbound reply ingestion"
          >
            <CornerDownLeft size={14} /> Test Reply Ingestion
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            style={{
              padding: '7px 14px',
              backgroundColor: '#ffffff',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Download size={14} /> Export CSV
          </button>

          <button
            type="button"
            onClick={() => {
              fetchReport();
              fetchRecipients();
            }}
            style={{
              padding: '7px 12px',
              backgroundColor: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={14} className={loadingReport ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Delivered Messages */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748b' }}>Delivered Messages</span>
            <CheckCircle2 size={16} color="#059669" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#059669' }}>
            {(m.delivered_messages || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
            {m.emails_attempted > 0 ? `${Math.round((m.delivered_messages / m.emails_attempted) * 100)}% of attempted` : '-'}
          </div>
        </div>

        {/* Unique Opens */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748b' }}>Tracked Opens</span>
            <Eye size={16} color="#2563eb" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#2563eb' }}>
            {m.unique_opens || 0}
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748b', marginLeft: '6px' }}>
              ({m.open_rate || 0}%)
            </span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
            {m.total_tracked_opens || 0} total open events
          </div>
        </div>

        {/* Unique Clicks */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748b' }}>Tracked Clicks</span>
            <MousePointer size={16} color="#7c3aed" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#7c3aed' }}>
            {m.unique_clickers || 0}
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748b', marginLeft: '6px' }}>
              ({m.click_rate || 0}%)
            </span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
            {m.total_tracked_clicks || 0} total link clicks
          </div>
        </div>

        {/* Replies Received */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748b' }}>Replies Received</span>
            <MessageSquare size={16} color="#0284c7" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#0284c7' }}>
            {m.replies_received || 0}
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
            Matched via In-Reply-To / sender
          </div>
        </div>

        {/* Bounces and Failures */}
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748b' }}>Bounces / Failures</span>
            <AlertTriangle size={16} color={m.bounced_messages > 0 ? '#dc2626' : '#94a3b8'} />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: m.bounced_messages > 0 ? '#dc2626' : '#1e293b' }}>
            {m.bounced_messages || 0}
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748b', marginLeft: '6px' }}>
              ({m.bounce_rate || 0}%)
            </span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
            {m.failed_messages || 0} delivery failures
          </div>
        </div>
      </div>

      {/* 3. Deliverability Funnel and Metric Disclaimers */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          padding: '20px 24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 14px 0' }}>
          Comprehensive Metric Breakdown and Denominators
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '16px',
            fontSize: '13px',
          }}
        >
          <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>Open Rate: {m.open_rate}%</div>
            <div style={{ color: '#64748b', fontSize: '12px', lineHeight: 1.5 }}>
              Formula: <code>Unique Opens ({m.unique_opens}) / Delivered Messages ({m.delivered_messages})</code> * 100.
              Note: Automated mail protection (e.g. Apple Mail Privacy Protection) may prefetch tracking pixels.
            </div>
          </div>

          <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>Click Rate: {m.click_rate}%</div>
            <div style={{ color: '#64748b', fontSize: '12px', lineHeight: 1.5 }}>
              Formula: <code>Unique Clickers ({m.unique_clickers}) / Delivered Messages ({m.delivered_messages})</code> * 100.
              Measures recipients who clicked at least one link.
            </div>
          </div>

          <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>Bounce Rate: {m.bounce_rate}%</div>
            <div style={{ color: '#64748b', fontSize: '12px', lineHeight: 1.5 }}>
              Formula: <code>Bounced Messages ({m.bounced_messages}) / Attempted ({m.emails_attempted})</code> * 100.
              Low bounce rates (&lt; 2%) protect sender reputation.
            </div>
          </div>

          <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>Unavailable Metrics</div>
            <div style={{ color: '#64748b', fontSize: '12px', lineHeight: 1.5 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
                - Deferred delivery events: <em>Unavailable (generic SMTP)</em>
              </span>
              <br />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
                - Spam complaints: <em>Requires ESP Feedback Loop webhook (e.g. SendGrid/Postmark)</em>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Recipient-Level Engagement Table */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Table Filters Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: '#f8fafc',
          }}
        >
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Recipient Engagement Activity ({totalRecipients})
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '240px' }}>
              <Search
                size={14}
                color="#94a3b8"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Search recipient name/email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 30px',
                  fontSize: '12.5px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '6px 12px',
                fontSize: '12.5px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="delivered">Delivered</option>
              <option value="opened">Opened</option>
              <option value="clicked">Clicked</option>
              <option value="replied">Replied</option>
              <option value="bounced">Bounced</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Table Rows */}
        {loadingRecipients ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', fontSize: '13.5px' }}>
            Loading recipient engagement records...
          </div>
        ) : recipients.length === 0 ? (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
            No recipients match the current filter criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 16px', fontWeight: 700, color: '#475569' }}>Recipient</th>
                  <th style={{ padding: '10px 16px', fontWeight: 700, color: '#475569' }}>Delivery Status</th>
                  <th style={{ padding: '10px 16px', fontWeight: 700, color: '#475569' }}>Opens</th>
                  <th style={{ padding: '10px 16px', fontWeight: 700, color: '#475569' }}>Clicks</th>
                  <th style={{ padding: '10px 16px', fontWeight: 700, color: '#475569' }}>Reply Status</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                  >
                    {/* Name and Email */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{r.name}</div>
                      <div style={{ color: '#64748b', fontSize: '12px', fontFamily: 'monospace' }}>{r.email}</div>
                    </td>

                    {/* Delivery Status */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          backgroundColor:
                            r.bounce_status === 'bounced'
                              ? '#fef2f2'
                              : r.provider_delivery_status === 'accepted'
                              ? '#ecfdf5'
                              : '#f1f5f9',
                          color:
                            r.bounce_status === 'bounced'
                              ? '#dc2626'
                              : r.provider_delivery_status === 'accepted'
                              ? '#059669'
                              : '#475569',
                          border:
                            r.bounce_status === 'bounced'
                              ? '1px solid #fecaca'
                              : r.provider_delivery_status === 'accepted'
                              ? '1px solid #a7f3d0'
                              : '1px solid #e2e8f0',
                        }}
                      >
                        {r.bounce_status === 'bounced' ? 'Bounced' : r.provider_delivery_status === 'accepted' ? 'Accepted / Sent' : r.provider_delivery_status}
                      </span>
                      {r.dispatch_attempt_at && (
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                          {new Date(r.dispatch_attempt_at).toLocaleTimeString()}
                        </div>
                      )}
                    </td>

                    {/* Opens */}
                    <td style={{ padding: '12px 16px' }}>
                      {r.open_count > 0 ? (
                        <div>
                          <span style={{ fontWeight: 700, color: '#2563eb' }}>
                            {r.open_count} open{r.open_count !== 1 ? 's' : ''}
                          </span>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {new Date(r.first_open_timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      )}
                    </td>

                    {/* Clicks */}
                    <td style={{ padding: '12px 16px' }}>
                      {r.click_count > 0 ? (
                        <div>
                          <span style={{ fontWeight: 700, color: '#7c3aed' }}>
                            {r.click_count} click{r.click_count !== 1 ? 's' : ''}
                          </span>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {new Date(r.clicked_at).toLocaleTimeString()}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      )}
                    </td>

                    {/* Replies */}
                    <td style={{ padding: '12px 16px' }}>
                      {r.reply_status === 'Replied' ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              backgroundColor: '#e0f2fe',
                              color: '#0284c7',
                              border: '1px solid #bae6fd',
                            }}
                          >
                            <MessageSquare size={12} /> Replied
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedReply(r)}
                            style={{
                              padding: '3px 8px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              color: '#334155',
                            }}
                          >
                            View
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>No reply observed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </div>

      {/* VIEW REPLY SNIPPET MODAL */}
      {selectedReply && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '540px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={18} color="#0284c7" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Inbound Reply Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReply(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>From:</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                  {selectedReply.name} &lt;{selectedReply.email}&gt;
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Subject:</div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#1e293b' }}>
                  {selectedReply.reply_subject || 'No subject'}
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Received At:</div>
                <div style={{ fontSize: '13px', color: '#475569' }}>
                  {selectedReply.reply_timestamp ? new Date(selectedReply.reply_timestamp).toLocaleString() : '-'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>
                  Reply Content / Body Snippet:
                </div>
                <div
                  style={{
                    padding: '12px 14px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: '#1e293b',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}
                >
                  {selectedReply.reply_snippet || '(Empty reply snippet)'}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                backgroundColor: '#f8fafc',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedReply(null)}
                style={{
                  padding: '7px 16px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEST INBOUND REPLY SIMULATION MODAL */}
      {isSimulateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#f8fafc',
              }}
            >
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Test Inbound Reply Ingestion
                </h3>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                  Simulates a recipient reply webhook to test campaign matching.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSimulateModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSimulateReply} style={{ padding: '24px' }}>
              {simulateResult && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    fontSize: '12.5px',
                    backgroundColor: simulateResult.success ? '#ecfdf5' : '#fef2f2',
                    border: simulateResult.success ? '1px solid #a7f3d0' : '1px solid #fecaca',
                    color: simulateResult.success ? '#065f46' : '#991b1b',
                  }}
                >
                  {simulateResult.success
                    ? `Reply matched successfully via ${simulateResult.data.match_type}!`
                    : simulateResult.error}
                </div>
              )}

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                  Sender Email (Recipient Address) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. m.hamilton@mit.edu"
                  value={simulateSenderEmail}
                  onChange={(e) => setSimulateSenderEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                  Reply Subject
                </label>
                <input
                  type="text"
                  placeholder="e.g. Re: Cross-Institutional Research Initiative"
                  value={simulateSubject}
                  onChange={(e) => setSimulateSubject(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                  Reply Body / Content Snippet
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Thank you for the invitation. I would be glad to participate in the keynote session."
                  value={simulateBody}
                  onChange={(e) => setSimulateBody(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsSimulateModalOpen(false)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={simulating}
                  style={{
                    padding: '8px 20px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: simulating ? 'not-allowed' : 'pointer',
                  }}
                >
                  {simulating ? 'Ingesting...' : 'Submit Inbound Reply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
