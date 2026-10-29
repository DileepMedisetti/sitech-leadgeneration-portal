import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Search,
  Download,
  AlertTriangle,
  Mail,
  Send,
  Eye,
  MousePointer,
  MessageSquare,
  RotateCw,
  ArrowUpDown,
  ExternalLink,
} from 'lucide-react';
import { campaignTrackingApi } from '../../services/api-client';
import './campaign-tracking.css';

export default function CampaignTrackingDetailPage({ campaignId, onNavigate }) {
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [summaryData, setSummaryData] = useState(null);
  const [recipientsData, setRecipientsData] = useState({
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
    total_pages: 1,
    available_countries: [],
    available_professions: [],
    available_universities: [],
  });

  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('all');
  const [profession, setProfession] = useState('all');
  const [university, setUniversity] = useState('all');
  const [sortBy, setSortBy] = useState('opened_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);

  const fetchSummary = useCallback(async () => {
    if (!campaignId) return;
    setLoadingSummary(true);
    try {
      const data = await campaignTrackingApi.getCampaignSummary(campaignId);
      setSummaryData(data);
    } catch (err) {
      console.error('Failed to fetch campaign summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, [campaignId]);

  const fetchRecipients = useCallback(async () => {
    if (!campaignId) return;
    setLoadingRecipients(true);
    try {
      const res = await campaignTrackingApi.getOpenedRecipients(campaignId, {
        page,
        page_size: 20,
        search,
        country: country !== 'all' ? country : undefined,
        profession: profession !== 'all' ? profession : undefined,
        university: university !== 'all' ? university : undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setRecipientsData(res);
    } catch (err) {
      console.error('Failed to fetch opened recipients:', err);
    } finally {
      setLoadingRecipients(false);
    }
  }, [campaignId, page, search, country, profession, university, sortBy, sortOrder]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  const handleExportExcel = () => {
    const url = campaignTrackingApi.exportOpenedRecipientsUrl(campaignId, {
      search,
      country,
      profession,
      university,
    });
    window.open(url, '_blank');
  };

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const metrics = summaryData?.metrics || {};
  const campaignName = summaryData?.name || `Campaign #${campaignId}`;

  return (
    <div className="ct-page-container">
      {/* Header & Breadcrumb */}
      <div className="ct-header">
        <div className="ct-header-left">
          <div className="ct-breadcrumbs">
            <span
              className="ct-breadcrumb-link"
              onClick={() => onNavigate('campaign-tracking')}
            >
              Campaign Tracking
            </span>
            <span>&gt;</span>
            <span className="ct-breadcrumb-current">{campaignName}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="ct-btn ct-btn-secondary"
              onClick={() => onNavigate('campaign-tracking')}
              style={{ padding: '6px 12px', fontSize: '13px' }}
              title="Return to Campaign Tracking Overview"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <h1 className="ct-title">{campaignName}</h1>
            <span className="ct-badge ct-badge-completed">
              {summaryData?.status || 'sent'}
            </span>
          </div>

          <p className="ct-subtitle">
            Sender: <strong>{summaryData?.sender_name || 'Sitech Series'}</strong> ({summaryData?.sender_email || 'outreach@sitechseries.org'})
            {summaryData?.sent_at && (
              <span> &bull; Sent on {new Date(summaryData.sent_at).toLocaleString()}</span>
            )}
          </p>
        </div>

        <div className="ct-header-actions">
          {/* Prominent Bounced Mails Button */}
          <button
            type="button"
            className="ct-btn ct-btn-bounces-prominent"
            onClick={() => onNavigate('campaign-bounced-mails', campaignId)}
            title="Navigate to Bounced Mails Management"
          >
            <AlertTriangle size={16} />
            <span>Bounced Mails</span>
            <span className="ct-bounce-badge-count">
              {metrics.historical_bounced_count || 0}
            </span>
          </button>

          <button
            type="button"
            className="ct-btn ct-btn-secondary"
            onClick={() => {
              fetchSummary();
              fetchRecipients();
            }}
            disabled={loadingSummary || loadingRecipients}
            title="Refresh statistics"
          >
            <RotateCw size={15} className={loadingSummary || loadingRecipients ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Campaign Analytics Summary Cards */}
      <div className="ct-metrics-grid">
        <div className="ct-metric-card">
          <div className="ct-metric-header">
            <span className="ct-metric-title">Total Sent</span>
            <div className="ct-metric-icon-wrap" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <Send size={18} />
            </div>
          </div>
          <div className="ct-metric-value-row">
            <span className="ct-metric-value">{metrics.sent || 0}</span>
            <span className="ct-metric-rate-badge ct-rate-blue">
              {metrics.emails_attempted || metrics.sent || 0} Attempted
            </span>
          </div>
          <div className="ct-metric-hint">Eligible recipients processed</div>
        </div>

        <div className="ct-metric-card">
          <div className="ct-metric-header">
            <span className="ct-metric-title">Delivered</span>
            <div className="ct-metric-icon-wrap" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
              <Mail size={18} />
            </div>
          </div>
          <div className="ct-metric-value-row">
            <span className="ct-metric-value">{metrics.delivered || 0}</span>
            <span className="ct-metric-rate-badge ct-rate-green">
              {metrics.delivery_rate || 0}%
            </span>
          </div>
          <div className="ct-metric-hint">Accepted by recipient mail servers</div>
        </div>

        <div className="ct-metric-card">
          <div className="ct-metric-header">
            <span className="ct-metric-title">Opens (Unique)</span>
            <div className="ct-metric-icon-wrap" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
              <Eye size={18} />
            </div>
          </div>
          <div className="ct-metric-value-row">
            <span className="ct-metric-value">{metrics.unique_opens || 0}</span>
            <span className="ct-metric-rate-badge ct-rate-green">
              {metrics.open_rate || 0}% Rate
            </span>
          </div>
          <div className="ct-metric-hint">{metrics.total_opens || 0} total opens recorded</div>
        </div>

        <div className="ct-metric-card">
          <div className="ct-metric-header">
            <span className="ct-metric-title">Clicks (Unique)</span>
            <div className="ct-metric-icon-wrap" style={{ backgroundColor: '#eff6ff', color: '#3b82f6' }}>
              <MousePointer size={18} />
            </div>
          </div>
          <div className="ct-metric-value-row">
            <span className="ct-metric-value">{metrics.unique_clicks || 0}</span>
            <span className="ct-metric-rate-badge ct-rate-blue">
              {metrics.click_rate || 0}% Rate
            </span>
          </div>
          <div className="ct-metric-hint">{metrics.total_clicks || 0} total link clicks</div>
        </div>

        <div className="ct-metric-card">
          <div className="ct-metric-header">
            <span className="ct-metric-title">Historical Bounces</span>
            <div className="ct-metric-icon-wrap" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="ct-metric-value-row">
            <span className="ct-metric-value">{metrics.historical_bounced_count || 0}</span>
            <span className="ct-metric-rate-badge ct-rate-red">
              {metrics.historical_bounce_rate || 0}% Bounce Rate
            </span>
          </div>
          <div className="ct-metric-hint">
            {metrics.hard_bounces || 0} Hard &bull; {metrics.soft_bounces || 0} Soft
          </div>
        </div>

        <div className="ct-metric-card">
          <div className="ct-metric-header">
            <span className="ct-metric-title">Replies</span>
            <div className="ct-metric-icon-wrap" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
              <MessageSquare size={18} />
            </div>
          </div>
          <div className="ct-metric-value-row">
            <span className="ct-metric-value">{metrics.replies_count || 0}</span>
            <span className="ct-metric-rate-badge ct-rate-gray">Inbound</span>
          </div>
          <div className="ct-metric-hint">{metrics.unsubscribes_count || 0} unsubscribes</div>
        </div>
      </div>

      {/* Opened Email Recipients Section */}
      <div className="ct-card">
        <div className="ct-card-header">
          <div className="ct-card-title-group">
            <h2 className="ct-card-title">Opened Email Recipients</h2>
            <span className="ct-card-count">{recipientsData.total} verified opens</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="ct-btn ct-btn-secondary"
              onClick={handleExportExcel}
              disabled={recipientsData.total === 0 || loadingRecipients}
              title="Download Excel spreadsheet of opened recipients"
            >
              <Download size={15} />
              Export to Excel
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="ct-filters-bar">
          <div className="ct-filters-left">
            <div className="ct-search-box">
              <Search size={16} className="ct-search-icon" />
              <input
                type="text"
                className="ct-search-input"
                placeholder="Search recipient name or email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {recipientsData.available_countries?.length > 0 && (
              <select
                className="ct-select"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by Country"
              >
                <option value="all">All Countries</option>
                {recipientsData.available_countries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            {recipientsData.available_professions?.length > 0 && (
              <select
                className="ct-select"
                value={profession}
                onChange={(e) => {
                  setProfession(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by Profession"
              >
                <option value="all">All Professions</option>
                {recipientsData.available_professions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}

            {recipientsData.available_universities?.length > 0 && (
              <select
                className="ct-select"
                value={university}
                onChange={(e) => {
                  setUniversity(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by University"
              >
                <option value="all">All Universities</option>
                {recipientsData.available_universities.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            )}
          </div>

          <div className="ct-filters-right">
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Showing {recipientsData.items.length} of {recipientsData.total} recipients
            </span>
          </div>
        </div>

        {/* Recipients Table */}
        {loadingRecipients ? (
          <div className="ct-empty-state">
            <RotateCw size={36} className="animate-spin" style={{ color: '#3b82f6', marginBottom: '12px' }} />
            <div className="ct-empty-title">Loading Opened Recipients...</div>
          </div>
        ) : recipientsData.items.length === 0 ? (
          <div className="ct-empty-state">
            <div className="ct-empty-icon">
              <Eye size={28} />
            </div>
            <h3 className="ct-empty-title">No Opened Recipients Yet</h3>
            <p className="ct-empty-desc">
              When recipients open your outreach emails, their engagement telemetry and timestamps will appear here.
            </p>
          </div>
        ) : (
          <div className="ct-table-responsive">
            <table className="ct-table">
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>Recipient</span>
                      <ArrowUpDown size={13} />
                    </div>
                  </th>
                  <th>Country</th>
                  <th>Profession & University</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('opened_at')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>First Opened</span>
                      <ArrowUpDown size={13} />
                    </div>
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('open_count')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>Opens</span>
                      <ArrowUpDown size={13} />
                    </div>
                  </th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('click_count')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>Clicks</span>
                      <ArrowUpDown size={13} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {recipientsData.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.recipient_name}</div>
                      <div style={{ fontSize: '12.5px', color: '#64748b' }}>{item.email}</div>
                    </td>
                    <td>
                      <span style={{ fontSize: '13px', color: '#0f172a' }}>{item.country || '—'}</span>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', color: '#1e293b' }}>{item.profession || '—'}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{item.university || ''}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', color: '#334155' }}>
                        {item.first_opened_at ? new Date(item.first_opened_at).toLocaleDateString() : '—'}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                        {item.first_opened_at ? new Date(item.first_opened_at).toLocaleTimeString() : ''}
                      </div>
                    </td>
                    <td>
                      <span className="ct-badge ct-badge-sent">
                        {item.open_count} {item.open_count === 1 ? 'open' : 'opens'}
                      </span>
                    </td>
                    <td>
                      {item.click_count > 0 ? (
                        <span className="ct-badge ct-badge-sent" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' }}>
                          {item.click_count} {item.click_count === 1 ? 'click' : 'clicks'}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {recipientsData.total_pages > 1 && (
          <div className="ct-pagination">
            <div>
              Page {recipientsData.page} of {recipientsData.total_pages} ({recipientsData.total} total items)
            </div>
            <div className="ct-pagination-controls">
              <button
                className="ct-page-btn"
                disabled={recipientsData.page <= 1 || loadingRecipients}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              {Array.from({ length: recipientsData.total_pages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === recipientsData.total_pages || Math.abs(p - recipientsData.page) <= 2)
                .map((p, idx, arr) => (
                  <React.Fragment key={p}>
                    {idx > 0 && p - arr[idx - 1] > 1 && <span style={{ padding: '0 4px' }}>...</span>}
                    <button
                      className={`ct-page-btn ${p === recipientsData.page ? 'active' : ''}`}
                      onClick={() => setPage(p)}
                      disabled={loadingRecipients}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                ))}
              <button
                className="ct-page-btn"
                disabled={recipientsData.page >= recipientsData.total_pages || loadingRecipients}
                onClick={() => setPage((p) => Math.min(recipientsData.total_pages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

