import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  RotateCw,
  Send,
  Eye,
  MousePointer,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { campaignTrackingApi } from '../../services/api-client';
import './campaign-tracking.css';

export default function CampaignTrackingPage({ onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [campaignsData, setCampaignsData] = useState({
    items: [],
    total: 0,
    page: 1,
    page_size: 10,
    total_pages: 1,
    overview_metrics: {
      completed_campaigns: 0,
      total_sent: 0,
      total_delivered: 0,
      total_opens: 0,
      unique_opened_recipients: 0,
      overall_open_rate: 0.0,
      total_bounces: 0,
      overall_bounce_rate: 0.0,
      total_clicks: 0,
      unique_clicks: 0,
      overall_click_rate: 0.0,
    },
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('completed_all');
  const [dateRange, setDateRange] = useState('all');
  const [page, setPage] = useState(1);

  const calculateDateRange = (rangeKey) => {
    if (rangeKey === 'all') return { startDate: undefined, endDate: undefined };
    const now = new Date();
    let pastDays = 30;
    if (rangeKey === '7d') pastDays = 7;
    if (rangeKey === '30d') pastDays = 30;
    if (rangeKey === '90d') pastDays = 90;

    const start = new Date(now.getTime() - pastDays * 24 * 60 * 60 * 1000);
    return {
      startDate: start.toISOString(),
      endDate: now.toISOString(),
    };
  };

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    const { startDate, endDate } = calculateDateRange(dateRange);

    try {
      const res = await campaignTrackingApi.getCompletedCampaigns({
        page,
        page_size: 10,
        search,
        status: statusFilter,
        start_date: startDate,
        end_date: endDate,
      });
      setCampaignsData(res);
    } catch (err) {
      console.error('Failed to load tracking campaigns:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, dateRange]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const metrics = campaignsData.overview_metrics || {};

  return (
    <div className="ct-page-container">
      {/* Page Header */}
      <div className="ct-header">
        <div className="ct-header-left">
          <h1 className="ct-title">Campaign Tracking</h1>
          <p className="ct-subtitle">
            Comprehensive analytics and delivery intelligence across completed email outreach campaigns. Monitor engagement, inspect opened recipients, and track authoritative bounce metrics.
          </p>
        </div>

        <div className="ct-header-actions">
          <button
            type="button"
            className="ct-btn ct-btn-secondary"
            onClick={fetchCampaigns}
            disabled={loading}
            title="Refresh tracking data"
          >
            <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Aggregate Overview Metrics Cards */}
      <div className="ct-metrics-grid">
        <div className="ct-metric-card">
          <div className="ct-metric-header">
            <span className="ct-metric-title">Completed Campaigns</span>
            <div className="ct-metric-icon-wrap" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="ct-metric-value-row">
            <span className="ct-metric-value">{metrics.completed_campaigns || 0}</span>
            <span className="ct-metric-rate-badge ct-rate-blue">Dispatched</span>
          </div>
          <div className="ct-metric-hint">Campaigns successfully executed</div>
        </div>

        <div className="ct-metric-card">
          <div className="ct-metric-header">
            <span className="ct-metric-title">Total Emails Sent</span>
            <div className="ct-metric-icon-wrap" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <Send size={18} />
            </div>
          </div>
          <div className="ct-metric-value-row">
            <span className="ct-metric-value">{metrics.total_sent || 0}</span>
            <span className="ct-metric-rate-badge ct-rate-blue">
              {metrics.total_delivered || 0} Delivered
            </span>
          </div>
          <div className="ct-metric-hint">Across all matching campaigns</div>
        </div>

        <div className="ct-metric-card">
          <div className="ct-metric-header">
            <span className="ct-metric-title">Total Opens</span>
            <div className="ct-metric-icon-wrap" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
              <Eye size={18} />
            </div>
          </div>
          <div className="ct-metric-value-row">
            <span className="ct-metric-value">{metrics.total_opens || 0}</span>
            <span className="ct-metric-rate-badge ct-rate-green">
              {metrics.unique_opened_recipients || 0} Unique
            </span>
          </div>
          <div className="ct-metric-hint">Verified tracking pixel events</div>
        </div>

        <div className="ct-metric-card">
          <div className="ct-metric-header">
            <span className="ct-metric-title">Overall Open Rate</span>
            <div className="ct-metric-icon-wrap" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="ct-metric-value-row">
            <span className="ct-metric-value">{metrics.overall_open_rate || 0}%</span>
            <span className="ct-metric-rate-badge ct-rate-green">Aggregated</span>
          </div>
          <div className="ct-metric-hint">Unique opens / delivered messages</div>
        </div>

        <div className="ct-metric-card">
          <div className="ct-metric-header">
            <span className="ct-metric-title">Overall Bounce Rate</span>
            <div className="ct-metric-icon-wrap" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="ct-metric-value-row">
            <span className="ct-metric-value">{metrics.overall_bounce_rate || 0}%</span>
            <span className="ct-metric-rate-badge ct-rate-red">
              {metrics.total_bounces || 0} Bounces
            </span>
          </div>
          <div className="ct-metric-hint">Immutable historical calculation</div>
        </div>

        <div className="ct-metric-card">
          <div className="ct-metric-header">
            <span className="ct-metric-title">Total Clicks</span>
            <div className="ct-metric-icon-wrap" style={{ backgroundColor: '#eff6ff', color: '#3b82f6' }}>
              <MousePointer size={18} />
            </div>
          </div>
          <div className="ct-metric-value-row">
            <span className="ct-metric-value">{metrics.total_clicks || 0}</span>
            <span className="ct-metric-rate-badge ct-rate-blue">
              {metrics.overall_click_rate || 0}% Rate
            </span>
          </div>
          <div className="ct-metric-hint">{metrics.unique_clicks || 0} unique clickers</div>
        </div>
      </div>

      {/* Main Card with Completed Campaigns Table */}
      <div className="ct-card">
        {/* Filter Controls Bar */}
        <div className="ct-filters-bar">
          <div className="ct-filters-left">
            <div className="ct-search-box">
              <Search size={16} className="ct-search-icon" />
              <input
                type="text"
                className="ct-search-input"
                placeholder="Search campaign by name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <select
              className="ct-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by campaign status"
            >
              <option value="completed_all">Status: Sent & Completed</option>
              <option value="sent">Status: Sent Only</option>
              <option value="completed">Status: Completed Only</option>
              <option value="all">Status: All Statuses</option>
            </select>

            <select
              className="ct-select"
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by date range"
            >
              <option value="all">Date: All Time</option>
              <option value="7d">Date: Last 7 Days</option>
              <option value="30d">Date: Last 30 Days</option>
              <option value="90d">Date: Last 90 Days</option>
            </select>
          </div>

          <div className="ct-filters-right">
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              {campaignsData.total} completed campaign{campaignsData.total === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Table / Loading / Empty State */}
        {loading ? (
          <div className="ct-empty-state">
            <RotateCw size={36} className="animate-spin" style={{ color: '#3b82f6', marginBottom: '12px' }} />
            <div className="ct-empty-title">Loading Completed Campaigns...</div>
          </div>
        ) : campaignsData.items.length === 0 ? (
          <div className="ct-empty-state">
            <div className="ct-empty-icon">
              <CheckCircle2 size={28} />
            </div>
            <h3 className="ct-empty-title">No Completed Campaigns Found</h3>
            <p className="ct-empty-desc">
              Only completed and dispatched campaigns are listed here. Send a campaign from the Campaigns section to track opens, clicks, and deliverability.
            </p>
          </div>
        ) : (
          <div className="ct-table-responsive">
            <table className="ct-table">
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Sent Date</th>
                  <th>Sent</th>
                  <th>Opens & Rate</th>
                  <th>Clicks & Rate</th>
                  <th>Bounces & Rate</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {campaignsData.items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {c.sender_email || c.owner_name || `ID #${c.id}`}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', color: '#334155' }}>
                        {c.sent_at ? new Date(c.sent_at).toLocaleDateString() : '—'}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                        {c.sent_at ? new Date(c.sent_at).toLocaleTimeString() : ''}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.sent_count}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {c.delivered_count} delivered
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#059669' }}>
                        {c.unique_opens} ({c.open_rate}%)
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {c.opened_count} total opens
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#2563eb' }}>
                        {c.unique_clicks} ({c.click_rate}%)
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {c.clicked_count} total clicks
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: c.bounced_count > 0 ? '#dc2626' : '#64748b' }}>
                        {c.bounced_count} ({c.bounce_rate}%)
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>historical</div>
                    </td>
                    <td>
                      <span className="ct-badge ct-badge-completed">
                        {c.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="ct-action-btn"
                        onClick={() => onNavigate('campaign-tracking-detail', c.id)}
                        title="View tracking report for this campaign"
                      >
                        <span>View</span>
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {campaignsData.total_pages > 1 && (
          <div className="ct-pagination">
            <div>
              Page {campaignsData.page} of {campaignsData.total_pages} ({campaignsData.total} campaigns)
            </div>
            <div className="ct-pagination-controls">
              <button
                className="ct-page-btn"
                disabled={campaignsData.page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              {Array.from({ length: campaignsData.total_pages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === campaignsData.total_pages || Math.abs(p - campaignsData.page) <= 2)
                .map((p, idx, arr) => (
                  <React.Fragment key={p}>
                    {idx > 0 && p - arr[idx - 1] > 1 && <span style={{ padding: '0 4px' }}>...</span>}
                    <button
                      className={`ct-page-btn ${p === campaignsData.page ? 'active' : ''}`}
                      onClick={() => setPage(p)}
                      disabled={loading}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                ))}
              <button
                className="ct-page-btn"
                disabled={campaignsData.page >= campaignsData.total_pages || loading}
                onClick={() => setPage((p) => Math.min(campaignsData.total_pages, p + 1))}
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

