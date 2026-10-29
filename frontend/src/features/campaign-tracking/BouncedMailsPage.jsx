import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Search,
  Download,
  Trash2,
  AlertTriangle,
  ShieldCheck,
  RotateCw,
  Info,
} from 'lucide-react';
import { campaignTrackingApi } from '../../services/api-client';
import DeleteBounceModal from './DeleteBounceModal';
import DeleteAllBouncesModal from './DeleteAllBouncesModal';
import './campaign-tracking.css';

export default function BouncedMailsPage({ campaignId, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [bouncedData, setBouncedData] = useState({
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
    total_pages: 1,
    summary: {
      total_historical_bounced: 0,
      historical_bounce_rate: 0.0,
      hard_bounces: 0,
      soft_bounces: 0,
      unknown_bounces: 0,
      active_listing_count: 0,
    },
    available_countries: [],
  });

  const [campaignSummary, setCampaignSummary] = useState(null);
  const [search, setSearch] = useState('');
  const [bounceType, setBounceType] = useState('all');
  const [country, setCountry] = useState('all');
  const [page, setPage] = useState(1);

  // Modals state
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [notification, setNotification] = useState(null);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  const fetchBounces = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    try {
      const [bouncesRes, summaryRes] = await Promise.all([
        campaignTrackingApi.getBouncedMails(campaignId, {
          page,
          page_size: 20,
          search,
          bounce_type: bounceType !== 'all' ? bounceType : undefined,
          country: country !== 'all' ? country : undefined,
        }),
        campaignTrackingApi.getCampaignSummary(campaignId).catch(() => null),
      ]);

      setBouncedData(bouncesRes);
      if (summaryRes) {
        setCampaignSummary(summaryRes);
      }
    } catch (err) {
      console.error('Failed to load bounced mails:', err);
      showToast('Error loading bounced emails data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [campaignId, page, search, bounceType, country]);

  useEffect(() => {
    fetchBounces();
  }, [fetchBounces]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleBounceTypeChange = (e) => {
    setBounceType(e.target.value);
    setPage(1);
  };

  const handleCountryChange = (e) => {
    setCountry(e.target.value);
    setPage(1);
  };

  const handleConfirmSingleDelete = async () => {
    if (!recordToDelete) return;
    setIsDeletingSingle(true);
    try {
      const res = await campaignTrackingApi.deleteBounceRecord(campaignId, recordToDelete.id);
      showToast(
        `Record removed. Historical bounce count (${res.historical_bounced_count}) and rate (${res.historical_bounce_rate}%) are permanently preserved.`,
      );
      setRecordToDelete(null);
      await fetchBounces();
    } catch (err) {
      console.error('Failed to delete bounce record:', err);
      showToast('Error removing bounced mail record.', 'error');
    } finally {
      setIsDeletingSingle(false);
    }
  };

  const handleConfirmDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
      const res = await campaignTrackingApi.deleteAllBounces(campaignId, {
        bounce_type: bounceType !== 'all' ? bounceType : undefined,
      });
      showToast(
        `All ${res.deleted_count} active records removed. Historical bounce rate (${res.historical_bounce_rate}%) remains intact.`,
      );
      setShowDeleteAllModal(false);
      setPage(1);
      await fetchBounces();
    } catch (err) {
      console.error('Failed to clear bounced records:', err);
      showToast('Error clearing bounced records.', 'error');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleExportExcel = () => {
    const url = campaignTrackingApi.exportBouncedMailsUrl(campaignId, {
      search,
      bounce_type: bounceType,
      country,
    });
    window.open(url, '_blank');
  };

  const campaignName = campaignSummary?.name || `Campaign #${campaignId}`;
  const summary = bouncedData.summary || {};

  return (
    <div className="ct-page-container">
      {/* Toast Notification */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 1100,
            padding: '12px 18px',
            borderRadius: '8px',
            backgroundColor: notification.type === 'error' ? '#fef2f2' : '#f0fdf4',
            color: notification.type === 'error' ? '#991b1b' : '#166534',
            border: `1px solid ${notification.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            fontSize: '13.5px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <ShieldCheck size={18} />
          {notification.message}
        </div>
      )}

      {/* Header and Breadcrumbs */}
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
            <span
              className="ct-breadcrumb-link"
              onClick={() => onNavigate('campaign-tracking-detail', campaignId)}
            >
              {campaignName}
            </span>
            <span>&gt;</span>
            <span className="ct-breadcrumb-current">Bounced Mails</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="ct-btn ct-btn-secondary"
              onClick={() => onNavigate('campaign-tracking-detail', campaignId)}
              style={{ padding: '6px 12px', fontSize: '13px' }}
              title="Return to Campaign Tracking Details"
            >
              <ArrowLeft size={16} /> Back to Details
            </button>
            <h1 className="ct-title">Bounced Mails Management</h1>
          </div>
          <p className="ct-subtitle">
            Inspect delivery failures for <strong>{campaignName}</strong>. Filter by failure mode, export to spreadsheet, and manage the active listing.
          </p>
        </div>

        <div className="ct-header-actions">
          <button
            type="button"
            className="ct-btn ct-btn-secondary"
            onClick={fetchBounces}
            disabled={loading}
            title="Refresh records"
          >
            <RotateCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            className="ct-btn ct-btn-secondary"
            onClick={handleExportExcel}
            title="Download Excel Workbook"
          >
            <Download size={15} />
            Export to Excel
          </button>
          <button
            type="button"
            className="ct-btn ct-btn-danger"
            onClick={() => setShowDeleteAllModal(true)}
            disabled={bouncedData.total === 0 || loading}
          >
            <Trash2 size={15} />
            Delete All
          </button>
        </div>
      </div>

      {/* Informational Banner */}
      <div className="ct-banner ct-banner-info">
        <Info size={20} style={{ flexShrink: 0, marginTop: '1px' }} />
        <div>
          <strong>Authoritative Historical Guarantee:</strong> Deleting bounced mail records from this active listing allows clean operational review without altering the campaign's historical bounce rate ({summary.historical_bounce_rate}%) or historical bounce count ({summary.total_historical_bounced}). Hard bounce suppression remains permanently enforced.
        </div>
      </div>

      {/* Bounce Summary Metrics Cards */}
      <div className="ct-metrics-grid">
        <div className="ct-metric-card">
          <div className="ct-metric-header">
            <span className="ct-metric-title">Historical Bounces</span>
            <div className="ct-metric-icon-wrap" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="ct-metric-value-row">
            <span className="ct-metric-value">{summary.total_historical_bounced || 0}</span>
            <span className="ct-metric-rate-badge ct-rate-red">
              {summary.historical_bounce_rate || 0}% Rate
            </span>
          </div>
          <div className="ct-metric-hint">Permanent historical aggregate</div>
        </div>

        <div className="ct-metric-card">
          <div className="ct-metric-header">
            <span className="ct-metric-title">Hard Bounces</span>
            <div className="ct-metric-icon-wrap" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="ct-metric-value-row">
            <span className="ct-metric-value">{summary.hard_bounces || 0}</span>
            <span className="ct-metric-rate-badge ct-rate-red">Permanent</span>
          </div>
          <div className="ct-metric-hint">5xx codes / non-existent mailboxes</div>
        </div>

        <div className="ct-metric-card">
          <div className="ct-metric-header">
            <span className="ct-metric-title">Soft Bounces</span>
            <div className="ct-metric-icon-wrap" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="ct-metric-value-row">
            <span className="ct-metric-value">{summary.soft_bounces || 0}</span>
            <span className="ct-metric-rate-badge ct-rate-amber">Temporary</span>
          </div>
          <div className="ct-metric-hint">4xx codes / mailbox full / deferred</div>
        </div>

        <div className="ct-metric-card">
          <div className="ct-metric-header">
            <span className="ct-metric-title">Unknown / Other</span>
            <div className="ct-metric-icon-wrap" style={{ backgroundColor: '#f1f5f9', color: '#64748b' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="ct-metric-value-row">
            <span className="ct-metric-value">{summary.unknown_bounces || 0}</span>
            <span className="ct-metric-rate-badge ct-rate-gray">Uncategorized</span>
          </div>
          <div className="ct-metric-hint">General delivery interruptions</div>
        </div>

        <div className="ct-metric-card">
          <div className="ct-metric-header">
            <span className="ct-metric-title">Active In Listing</span>
            <div className="ct-metric-icon-wrap" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="ct-metric-value-row">
            <span className="ct-metric-value">{summary.active_listing_count || 0}</span>
            <span className="ct-metric-rate-badge ct-rate-blue">Visible</span>
          </div>
          <div className="ct-metric-hint">Current non-deleted listing records</div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="ct-card">
        {/* Filters Bar */}
        <div className="ct-filters-bar">
          <div className="ct-filters-left">
            <div className="ct-search-box">
              <Search size={16} className="ct-search-icon" />
              <input
                type="text"
                className="ct-search-input"
                placeholder="Search email, recipient, or reason..."
                value={search}
                onChange={handleSearchChange}
              />
            </div>

            <select
              className="ct-select"
              value={bounceType}
              onChange={handleBounceTypeChange}
              aria-label="Filter by bounce category"
            >
              <option value="all">All Bounce Types</option>
              <option value="hard">Hard Bounces</option>
              <option value="soft">Soft Bounces</option>
              <option value="unknown">Unknown Bounces</option>
            </select>

            {bouncedData.available_countries?.length > 0 && (
              <select
                className="ct-select"
                value={country}
                onChange={handleCountryChange}
                aria-label="Filter by country"
              >
                <option value="all">All Countries</option>
                {bouncedData.available_countries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          <div className="ct-filters-right">
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Showing {bouncedData.items.length} of {bouncedData.total} records
            </span>
          </div>
        </div>

        {/* Table / Empty State */}
        {loading ? (
          <div className="ct-empty-state">
            <RotateCw size={36} className="animate-spin" style={{ color: '#3b82f6', marginBottom: '12px' }} />
            <div className="ct-empty-title">Loading Bounced Records...</div>
          </div>
        ) : bouncedData.items.length === 0 ? (
          <div className="ct-empty-state">
            <div className="ct-empty-icon">
              <ShieldCheck size={28} />
            </div>
            <h3 className="ct-empty-title">No Active Bounced Mails</h3>
            <p className="ct-empty-desc">
              {bouncedData.total === 0 && summary.total_historical_bounced > 0
                ? 'All bounced mail listing records have been cleared from this view. Historical statistics remain safely intact.'
                : 'No delivery failures match your current filters.'}
            </p>
          </div>
        ) : (
          <div className="ct-table-responsive">
            <table className="ct-table">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Bounce Type</th>
                  <th>Bounce Reason / Error Details</th>
                  <th>Bounced At</th>
                  <th>Country & Role</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {bouncedData.items.map((item) => {
                  const bType = (item.bounce_type || 'unknown').toLowerCase();
                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.recipient_name}</div>
                        <div style={{ fontSize: '12.5px', color: '#64748b' }}>{item.email}</div>
                      </td>
                      <td>
                        <span className={`ct-badge ct-badge-${bType}`}>
                          {bType === 'hard' && 'Hard Bounce'}
                          {bType === 'soft' && 'Soft Bounce'}
                          {bType === 'unknown' && 'Unknown'}
                        </span>
                      </td>
                      <td>
                        <div
                          style={{
                            maxWidth: '320px',
                            fontSize: '12.5px',
                            color: '#334155',
                            wordBreak: 'break-word',
                          }}
                        >
                          {item.bounce_reason || '—'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '13px', color: '#334155' }}>
                          {item.bounced_at ? new Date(item.bounced_at).toLocaleDateString() : '—'}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                          {item.bounced_at ? new Date(item.bounced_at).toLocaleTimeString() : ''}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '13px', color: '#0f172a' }}>{item.country || '—'}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {item.profession || item.university || ''}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="ct-delete-btn"
                          onClick={() => setRecordToDelete(item)}
                          title="Remove from listing"
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {bouncedData.total_pages > 1 && (
          <div className="ct-pagination">
            <div>
              Page {bouncedData.page} of {bouncedData.total_pages} ({bouncedData.total} total items)
            </div>
            <div className="ct-pagination-controls">
              <button
                className="ct-page-btn"
                disabled={bouncedData.page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              {Array.from({ length: bouncedData.total_pages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === bouncedData.total_pages || Math.abs(p - bouncedData.page) <= 2)
                .map((p, idx, arr) => (
                  <React.Fragment key={p}>
                    {idx > 0 && p - arr[idx - 1] > 1 && <span style={{ padding: '0 4px' }}>...</span>}
                    <button
                      className={`ct-page-btn ${p === bouncedData.page ? 'active' : ''}`}
                      onClick={() => setPage(p)}
                      disabled={loading}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                ))}
              <button
                className="ct-page-btn"
                disabled={bouncedData.page >= bouncedData.total_pages || loading}
                onClick={() => setPage((p) => Math.min(bouncedData.total_pages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Single Bounce Confirmation Modal */}
      <DeleteBounceModal
        isOpen={Boolean(recordToDelete)}
        record={recordToDelete}
        onClose={() => setRecordToDelete(null)}
        onConfirm={handleConfirmSingleDelete}
        isDeleting={isDeletingSingle}
      />

      {/* Delete All Bounces Confirmation Modal */}
      <DeleteAllBouncesModal
        isOpen={showDeleteAllModal}
        totalCount={bouncedData.total}
        onClose={() => setShowDeleteAllModal(false)}
        onConfirm={handleConfirmDeleteAll}
        isDeleting={isDeletingAll}
      />
    </div>
  );
}

